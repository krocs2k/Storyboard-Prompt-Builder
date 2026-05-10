/**
 * Global Concurrency Manager
 * 
 * Manages system-wide and per-user concurrent API job execution.
 * Dynamically adapts concurrency based on system load and provider rate limits.
 * 
 * Architecture:
 * - System-wide semaphore limits total concurrent API calls across all users
 * - Per-user semaphore ensures fair distribution of slots
 * - Per-provider limits respect external API rate limits
 * - Adaptive throttling reduces concurrency on 429/rate-limit responses
 * - Admin-configurable limits via SystemConfig DB table
 */

import { prisma } from '@/lib/db';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type JobType = 'video' | 'image' | 'llm' | 'generic';
export type Provider = 'gemini' | 'openai' | 'abacus' | 'generic';

interface QueuedJob<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  userId: string;
  jobType: JobType;
  provider: Provider;
  priority: number; // lower = higher priority
  enqueueTime: number;
}

interface ConcurrencyLimits {
  // System-wide maximums
  maxSystemConcurrent: number;      // Total concurrent jobs across all users
  maxPerUser: number;               // Max concurrent jobs per single user
  // Per-provider limits (respect external API rate limits)
  maxPerProvider: Record<Provider, number>;
  // Per-job-type limits
  maxPerJobType: Record<JobType, number>;
  // Adaptive throttling
  backoffMultiplier: number;        // How much to reduce on rate limit (0.5 = halve)
  recoveryRateMs: number;           // How fast to recover after backoff
}

interface SystemStats {
  totalActive: number;
  totalQueued: number;
  activeByUser: Record<string, number>;
  activeByProvider: Record<string, number>;
  activeByJobType: Record<string, number>;
  rateLimitEvents: number;
  effectiveLimits: ConcurrencyLimits;
}

// ────────────────────────────────────────────────────────────
// Default Limits
// ────────────────────────────────────────────────────────────

const DEFAULT_LIMITS: ConcurrencyLimits = {
  maxSystemConcurrent: 20,
  maxPerUser: 10,
  maxPerProvider: {
    gemini: 8,      // Gemini is generous with rate limits
    openai: 5,      // OpenAI is stricter
    abacus: 6,
    generic: 4,
  },
  maxPerJobType: {
    video: 4,       // Video gen is heavy — limit concurrent
    image: 10,      // Image gen can run more in parallel
    llm: 8,         // Text LLM calls are fast
    generic: 6,
  },
  backoffMultiplier: 0.5,
  recoveryRateMs: 30000, // 30s recovery
};

// SystemConfig DB key for persisted limits
const CONFIG_KEY = 'CONCURRENCY_LIMITS';

// ────────────────────────────────────────────────────────────
// Concurrency Manager (Singleton)
// ────────────────────────────────────────────────────────────

class ConcurrencyManager {
  private queue: QueuedJob<unknown>[] = [];
  private activeJobs = new Set<symbol>();
  private activeByUser = new Map<string, number>();
  private activeByProvider = new Map<Provider, number>();
  private activeByJobType = new Map<JobType, number>();
  private limits: ConcurrencyLimits = { ...DEFAULT_LIMITS };
  private rateLimitBackoffs = new Map<Provider, { factor: number; until: number }>();
  private rateLimitEventCount = 0;
  private configLoaded = false;
  private configLoadPromise: Promise<void> | null = null;
  private lastConfigLoad = 0;
  private readonly CONFIG_CACHE_MS = 60000; // Reload config every 60s

  /**
   * Load limits from database (cached for 60s)
   */
  private async loadConfig(): Promise<void> {
    const now = Date.now();
    if (this.configLoaded && now - this.lastConfigLoad < this.CONFIG_CACHE_MS) return;

    if (this.configLoadPromise) {
      await this.configLoadPromise;
      return;
    }

    this.configLoadPromise = (async () => {
      try {
        const row = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
        if (row?.value) {
          const parsed = JSON.parse(row.value);
          this.limits = {
            ...DEFAULT_LIMITS,
            ...parsed,
            maxPerProvider: { ...DEFAULT_LIMITS.maxPerProvider, ...(parsed.maxPerProvider || {}) },
            maxPerJobType: { ...DEFAULT_LIMITS.maxPerJobType, ...(parsed.maxPerJobType || {}) },
          };
        }
      } catch (e) {
        console.warn('[concurrency] Failed to load config from DB, using defaults:', e);
      }
      this.configLoaded = true;
      this.lastConfigLoad = Date.now();
      this.configLoadPromise = null;
    })();

    await this.configLoadPromise;
  }

  /**
   * Get the effective max for a provider considering backoff
   */
  private getEffectiveProviderLimit(provider: Provider): number {
    const baseLimit = this.limits.maxPerProvider[provider] || DEFAULT_LIMITS.maxPerProvider.generic;
    const backoff = this.rateLimitBackoffs.get(provider);
    if (backoff && Date.now() < backoff.until) {
      return Math.max(1, Math.floor(baseLimit * backoff.factor));
    }
    // Clear expired backoff
    if (backoff && Date.now() >= backoff.until) {
      this.rateLimitBackoffs.delete(provider);
    }
    return baseLimit;
  }

  /**
   * Check if a job can start right now
   */
  private canStart(userId: string, jobType: JobType, provider: Provider): boolean {
    // System-wide limit
    if (this.activeJobs.size >= this.limits.maxSystemConcurrent) return false;

    // Per-user limit
    const userActive = this.activeByUser.get(userId) || 0;
    if (userActive >= this.limits.maxPerUser) return false;

    // Per-provider limit (with backoff)
    const providerActive = this.activeByProvider.get(provider) || 0;
    if (providerActive >= this.getEffectiveProviderLimit(provider)) return false;

    // Per-job-type limit
    const jobTypeActive = this.activeByJobType.get(jobType) || 0;
    if (jobTypeActive >= this.limits.maxPerJobType[jobType]) return false;

    return true;
  }

  /**
   * Try to dequeue and start the next eligible job(s)
   */
  private processQueue(): void {
    // Sort queue by priority, then by enqueue time (FIFO within same priority)
    this.queue.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : a.enqueueTime - b.enqueueTime);

    let i = 0;
    while (i < this.queue.length) {
      const job = this.queue[i];
      if (this.canStart(job.userId, job.jobType, job.provider)) {
        this.queue.splice(i, 1);
        this.startJob(job);
      } else {
        i++;
      }
    }
  }

  /**
   * Start executing a job
   */
  private startJob<T>(job: QueuedJob<T>): void {
    const token = Symbol('job');
    this.activeJobs.add(token);
    this.activeByUser.set(job.userId, (this.activeByUser.get(job.userId) || 0) + 1);
    this.activeByProvider.set(job.provider, (this.activeByProvider.get(job.provider) || 0) + 1);
    this.activeByJobType.set(job.jobType, (this.activeByJobType.get(job.jobType) || 0) + 1);

    const cleanup = () => {
      this.activeJobs.delete(token);
      const userCount = (this.activeByUser.get(job.userId) || 1) - 1;
      if (userCount <= 0) this.activeByUser.delete(job.userId); else this.activeByUser.set(job.userId, userCount);
      const provCount = (this.activeByProvider.get(job.provider) || 1) - 1;
      if (provCount <= 0) this.activeByProvider.delete(job.provider); else this.activeByProvider.set(job.provider, provCount);
      const jtCount = (this.activeByJobType.get(job.jobType) || 1) - 1;
      if (jtCount <= 0) this.activeByJobType.delete(job.jobType); else this.activeByJobType.set(job.jobType, jtCount);
      // Process queue to start next jobs
      this.processQueue();
    };

    job.fn()
      .then((result) => {
        cleanup();
        job.resolve(result as T);
      })
      .catch((err) => {
        // Check for rate limit errors
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRateLimit = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit') ||
          errMsg.toLowerCase().includes('too many requests') || errMsg.toLowerCase().includes('quota');

        if (isRateLimit) {
          this.handleRateLimit(job.provider);
        }

        cleanup();
        job.reject(err);
      });
  }

  /**
   * Handle a rate limit event — reduce effective concurrency for the provider
   */
  private handleRateLimit(provider: Provider): void {
    this.rateLimitEventCount++;
    const existing = this.rateLimitBackoffs.get(provider);
    const currentFactor = existing?.factor || 1;
    const newFactor = Math.max(0.2, currentFactor * this.limits.backoffMultiplier);

    this.rateLimitBackoffs.set(provider, {
      factor: newFactor,
      until: Date.now() + this.limits.recoveryRateMs,
    });

    console.warn(`[concurrency] Rate limit on ${provider}. Reducing effective limit to ${Math.floor(newFactor * 100)}% for ${this.limits.recoveryRateMs / 1000}s`);
  }

  /**
   * Submit a job to the concurrency manager.
   * Returns a promise that resolves when the job completes.
   */
  async submit<T>(opts: {
    fn: () => Promise<T>;
    userId?: string;
    jobType?: JobType;
    provider?: Provider;
    priority?: number; // 0 = highest, 10 = lowest
  }): Promise<T> {
    await this.loadConfig();

    return new Promise<T>((resolve, reject) => {
      const job: QueuedJob<T> = {
        fn: opts.fn,
        resolve,
        reject,
        userId: opts.userId || 'system',
        jobType: opts.jobType || 'generic',
        provider: opts.provider || 'generic',
        priority: opts.priority ?? 5,
        enqueueTime: Date.now(),
      };

      this.queue.push(job as QueuedJob<unknown>);
      this.processQueue();
    });
  }

  /**
   * Run multiple jobs concurrently, respecting all limits.
   * Like Promise.all but throttled through the concurrency manager.
   */
  async submitAll<T>(jobs: Array<{
    fn: () => Promise<T>;
    userId?: string;
    jobType?: JobType;
    provider?: Provider;
    priority?: number;
  }>): Promise<PromiseSettledResult<T>[]> {
    const promises = jobs.map(job => 
      this.submit(job).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason) => ({ status: 'rejected' as const, reason }),
      )
    );
    return Promise.all(promises);
  }

  /**
   * Run multiple jobs with a callback per completion (for progress reporting).
   */
  async submitAllWithProgress<T>(opts: {
    jobs: Array<{
      id: string;
      fn: () => Promise<T>;
      userId?: string;
      jobType?: JobType;
      provider?: Provider;
      priority?: number;
    }>;
    onProgress?: (completed: number, total: number, id: string, result: PromiseSettledResult<T>) => void;
  }): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(opts.jobs.length);
    let completed = 0;

    const promises = opts.jobs.map((job, idx) =>
      this.submit(job).then(
        (value) => {
          const result: PromiseSettledResult<T> = { status: 'fulfilled', value };
          results[idx] = result;
          completed++;
          opts.onProgress?.(completed, opts.jobs.length, job.id, result);
          return result;
        },
        (reason) => {
          const result: PromiseSettledResult<T> = { status: 'rejected', reason };
          results[idx] = result;
          completed++;
          opts.onProgress?.(completed, opts.jobs.length, job.id, result);
          return result;
        },
      )
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get current system stats
   */
  getStats(): SystemStats {
    return {
      totalActive: this.activeJobs.size,
      totalQueued: this.queue.length,
      activeByUser: Object.fromEntries(this.activeByUser),
      activeByProvider: Object.fromEntries(this.activeByProvider),
      activeByJobType: Object.fromEntries(this.activeByJobType),
      rateLimitEvents: this.rateLimitEventCount,
      effectiveLimits: {
        ...this.limits,
        maxPerProvider: {
          ...this.limits.maxPerProvider,
          gemini: this.getEffectiveProviderLimit('gemini'),
          openai: this.getEffectiveProviderLimit('openai'),
          abacus: this.getEffectiveProviderLimit('abacus'),
          generic: this.getEffectiveProviderLimit('generic'),
        },
      },
    };
  }

  /**
   * Force reload config from DB
   */
  async reloadConfig(): Promise<void> {
    this.configLoaded = false;
    this.lastConfigLoad = 0;
    await this.loadConfig();
  }

  /**
   * Update limits in DB and reload
   */
  async updateLimits(newLimits: Partial<ConcurrencyLimits>): Promise<void> {
    const merged = {
      ...this.limits,
      ...newLimits,
      maxPerProvider: { ...this.limits.maxPerProvider, ...(newLimits.maxPerProvider || {}) },
      maxPerJobType: { ...this.limits.maxPerJobType, ...(newLimits.maxPerJobType || {}) },
    };

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(merged) },
      create: { key: CONFIG_KEY, value: JSON.stringify(merged) },
    });

    this.limits = merged;
    this.configLoaded = true;
    this.lastConfigLoad = Date.now();
  }
}

// Singleton instance
const manager = new ConcurrencyManager();
export default manager;

// Named exports for convenience
export const submitJob = manager.submit.bind(manager);
export const submitAll = manager.submitAll.bind(manager);
export const submitAllWithProgress = manager.submitAllWithProgress.bind(manager);
export const getConcurrencyStats = manager.getStats.bind(manager);
export const updateConcurrencyLimits = manager.updateLimits.bind(manager);
export const reloadConcurrencyConfig = manager.reloadConfig.bind(manager);
