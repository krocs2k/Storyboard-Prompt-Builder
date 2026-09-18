/**
 * Managed Image-Model Registry (Gemini-native "Nano Banana" family)
 *
 * The list of usable image models — the exact API name to call, a friendly
 * display name, and the per-image price used for margin/cost decisions — lives
 * in the database (SystemConfig) so an admin can refresh and manage it in-app
 * WITHOUT a code change or redeploy.
 *
 * This is the single source of truth used by:
 *   - lib/imagen.ts routing (which model names are valid → generateContent)
 *   - the auto-recovery flow (pick the CHEAPEST valid model, never an upgrade)
 *   - the admin management UI
 *
 * NOTE: Google's ListModels API returns the current valid model *names* but
 * does NOT return prices, so price is admin-managed here. "Refresh from
 * provider" reconciles the registry names against what Google currently serves.
 */

import { prisma } from '@/lib/db';

export const IMAGE_MODEL_REGISTRY_KEY = 'GEMINI_IMAGE_MODEL_REGISTRY';

export interface ImageModelEntry {
  /** Exact model id passed to the Gemini generateContent API call */
  apiName: string;
  /** Friendly label shown in the UI */
  displayName: string;
  /** Price per generated image in USD (used to pick the cheapest valid model) */
  pricePerImage: number;
  /** Whether this model may be selected/used */
  active: boolean;
}

/**
 * Seed registry. Only currently-valid Gemini-native image models. Prices are
 * best-known public list prices (USD/image) and are fully editable in Admin.
 * gemini-2.5-flash-image is the cheapest generally-available option, so it is
 * the safe default — chosen to protect margin, not because it is the newest.
 */
export const DEFAULT_IMAGE_MODEL_REGISTRY: ImageModelEntry[] = [
  { apiName: 'gemini-2.5-flash-image',         displayName: 'Nano Banana (2.5 Flash Image)', pricePerImage: 0.039, active: true },
  { apiName: 'gemini-3.1-flash-image-preview', displayName: 'Nano Banana 2 (3.1 Flash Image Preview)', pricePerImage: 0.066, active: true },
  { apiName: 'gemini-3.1-flash-image',         displayName: 'Nano Banana 2 (3.1 Flash Image)', pricePerImage: 0.066, active: false },
  { apiName: 'gemini-3.1-flash-lite-image',    displayName: 'Nano Banana Lite (3.1 Flash-Lite Image)', pricePerImage: 0, active: false },
  { apiName: 'gemini-3-pro-image',             displayName: 'Nano Banana Pro (3 Pro Image)', pricePerImage: 0, active: false },
];

function sanitizeEntry(raw: any): ImageModelEntry | null {
  if (!raw || typeof raw.apiName !== 'string' || !raw.apiName.trim()) return null;
  const price = Number(raw.pricePerImage);
  return {
    apiName: raw.apiName.trim(),
    displayName: typeof raw.displayName === 'string' && raw.displayName.trim()
      ? raw.displayName.trim()
      : raw.apiName.trim(),
    pricePerImage: Number.isFinite(price) && price >= 0 ? price : 0,
    active: raw.active !== false,
  };
}

/** Read the managed registry from the DB, falling back to the seed defaults. */
export async function getImageModelRegistry(): Promise<ImageModelEntry[]> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: IMAGE_MODEL_REGISTRY_KEY } });
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map(sanitizeEntry).filter(Boolean) as ImageModelEntry[];
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch (e) {
    console.warn('[image-model-registry] Failed to read registry, using defaults:', e);
  }
  return DEFAULT_IMAGE_MODEL_REGISTRY.map(m => ({ ...m }));
}

/** Persist the managed registry to the DB (upsert; no destructive deletes). */
export async function saveImageModelRegistry(models: any[]): Promise<ImageModelEntry[]> {
  const cleaned = (Array.isArray(models) ? models : [])
    .map(sanitizeEntry)
    .filter(Boolean) as ImageModelEntry[];
  // De-dup by apiName (last wins)
  const byName = new Map<string, ImageModelEntry>();
  for (const m of cleaned) byName.set(m.apiName, m);
  const finalList = Array.from(byName.values());
  await prisma.systemConfig.upsert({
    where: { key: IMAGE_MODEL_REGISTRY_KEY },
    update: { value: JSON.stringify(finalList) },
    create: { key: IMAGE_MODEL_REGISTRY_KEY, value: JSON.stringify(finalList) },
  });
  return finalList;
}

/** Active model API names (those routed through generateContent). */
export function activeModelNames(registry: ImageModelEntry[]): string[] {
  return registry.filter(m => m.active).map(m => m.apiName);
}

/**
 * Pick the cheapest ACTIVE model. Optionally restrict to a set of model names
 * that the provider currently reports as valid (from ListModels). Models with
 * an unknown price (<= 0) are only used when no priced option is available.
 * Returns null when there is nothing usable.
 */
export function cheapestActiveModel(
  registry: ImageModelEntry[],
  validNames?: Set<string>,
): ImageModelEntry | null {
  let candidates = registry.filter(m => m.active);
  if (validNames && validNames.size > 0) {
    const restricted = candidates.filter(m => validNames.has(m.apiName));
    if (restricted.length > 0) candidates = restricted;
  }
  if (candidates.length === 0) return null;
  const priced = candidates.filter(m => m.pricePerImage > 0);
  const pool = priced.length > 0 ? priced : candidates;
  return pool.reduce((best, m) => (m.pricePerImage < best.pricePerImage ? m : best), pool[0]);
}

/** Price lookup for a given model name (0 when unknown). */
export function priceForModel(registry: ImageModelEntry[], apiName: string): number {
  const m = registry.find(x => x.apiName === apiName);
  return m ? m.pricePerImage : 0;
}

/**
 * Fetch the list of image-capable model ids that Google currently serves for
 * this API key. Filters to models that support generateContent and are image
 * models (name contains "image"). Returns [] on any error (caller decides).
 */
export async function fetchLiveGeminiImageModels(apiKey: string): Promise<{ ids: string[]; error?: string }> {
  if (!apiKey) return { ids: [], error: 'No Gemini API key configured' };
  try {
    const ids: string[] = [];
    let pageToken: string | undefined;
    // Paginate to be safe (Google returns up to 50/page).
    for (let i = 0; i < 10; i++) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text();
        let msg = `Provider returned ${res.status}`;
        try { msg = JSON.parse(txt)?.error?.message || msg; } catch { /* ignore */ }
        return { ids: [], error: msg };
      }
      const data = await res.json();
      for (const m of data.models || []) {
        const name: string = (m.name || '').replace(/^models\//, '');
        const methods: string[] = m.supportedGenerationMethods || [];
        if (name.toLowerCase().includes('image') && methods.includes('generateContent')) {
          ids.push(name);
        }
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return { ids: Array.from(new Set(ids)) };
  } catch (e: any) {
    return { ids: [], error: e?.message || 'Failed to reach provider' };
  }
}

/** Detect a "model name is not valid / not found" style provider error. */
export function isInvalidModelError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('not found for api version') ||
    msg.includes('is not found') ||
    msg.includes('not supported for') ||
    msg.includes('not_found') ||
    (msg.includes('model') && msg.includes('not found')) ||
    (msg.includes('404') && msg.includes('model'))
  );
}
