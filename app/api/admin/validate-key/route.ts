export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { type ApiProviderType } from '@/lib/data/provider-models';

/**
 * Validates an API key by making a lightweight test request to the provider.
 * POST { provider: 'gemini'|'openai'|'abacus', apiKey: string }
 * Returns { valid: boolean, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, apiKey } = await request.json();
    if (!provider) {
      return NextResponse.json({ valid: false, error: 'Provider is required' });
    }

    let keyToValidate = apiKey?.trim();

    // If no key provided (or sentinel), read from DB
    if (!keyToValidate || keyToValidate === '__stored__') {
      const { prisma } = await import('@/lib/db');
      const { PROVIDERS } = await import('@/lib/data/provider-models');
      const provInfo = PROVIDERS[provider as ApiProviderType];
      if (!provInfo) return NextResponse.json({ valid: false, error: 'Unknown provider' });

      const config = await prisma.systemConfig.findUnique({ where: { key: provInfo.keyConfigKey } });
      keyToValidate = config?.value || process.env[provInfo.envFallbackKey] || '';
    }

    if (!keyToValidate) {
      return NextResponse.json({ valid: false, error: 'No API key found' });
    }

    const result = await validateKey(provider as ApiProviderType, keyToValidate);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Key validation error:', error);
    return NextResponse.json({ valid: false, error: 'Validation failed' });
  }
}

async function validateKey(provider: ApiProviderType, apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    switch (provider) {
      case 'gemini': {
        // List models endpoint — lightweight auth check
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`,
          { signal: controller.signal }
        );
        if (res.ok) return { valid: true };
        if (res.status === 400 || res.status === 403) return { valid: false, error: 'Invalid API key' };
        return { valid: false, error: `API returned ${res.status}` };
      }
      case 'openai': {
        // List models endpoint — lightweight auth check
        const res = await fetch('https://api.openai.com/v1/models?limit=1', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (res.ok) return { valid: true };
        if (res.status === 401) return { valid: false, error: 'Invalid API key' };
        return { valid: false, error: `API returned ${res.status}` };
      }
      case 'abacus': {
        const res = await fetch('https://apps.abacus.ai/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (res.ok) return { valid: true };
        if (res.status === 401 || res.status === 403) return { valid: false, error: 'Invalid API key' };
        return { valid: false, error: `API returned ${res.status}` };
      }
      default:
        return { valid: false, error: 'Unknown provider' };
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { valid: false, error: 'Request timed out' };
    }
    return { valid: false, error: 'Connection failed' };
  } finally {
    clearTimeout(timeout);
  }
}
