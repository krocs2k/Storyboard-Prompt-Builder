import { prisma } from '@/lib/db';
import { movieStyles } from '@/lib/data/movie-styles';
import * as fs from 'fs';
import * as path from 'path';

const OVERRIDES_KEY = 'movie_style_overrides';
const SETTINGS_KEY = 'movie_style_settings';
const CUSTOM_STYLES_KEY = 'movie_style_custom';

interface MovieStyleSettings {
  useImageAsReference: boolean;
}

interface MovieStyleOverride {
  image?: string;
  description?: string;
}

// Cache settings for 60s
let cachedSettings: { data: MovieStyleSettings | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const CACHE_TTL = 60_000;

/** Immediately bust movie-style caches so next call re-reads from DB */
export function invalidateMovieStyleCache() {
  cachedSettings.fetchedAt = 0;
  cachedOverrides.fetchedAt = 0;
}

export async function getMovieStyleSettings(): Promise<MovieStyleSettings> {
  const now = Date.now();
  if (now - cachedSettings.fetchedAt < CACHE_TTL && cachedSettings.data) {
    return cachedSettings.data;
  }
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: SETTINGS_KEY } });
    const settings = config?.value ? JSON.parse(config.value) : { useImageAsReference: false };
    cachedSettings = { data: settings, fetchedAt: now };
    return settings;
  } catch {
    return { useImageAsReference: false };
  }
}

// Cache overrides for 60s
let cachedOverrides: { data: Record<string, MovieStyleOverride> | null; fetchedAt: number } = { data: null, fetchedAt: 0 };

async function getOverrides(): Promise<Record<string, MovieStyleOverride>> {
  const now = Date.now();
  if (now - cachedOverrides.fetchedAt < CACHE_TTL && cachedOverrides.data) {
    return cachedOverrides.data;
  }
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: OVERRIDES_KEY } });
    const overrides = config?.value ? JSON.parse(config.value) : {};
    cachedOverrides = { data: overrides, fetchedAt: now };
    return overrides;
  } catch {
    return {};
  }
}

async function getCustomStyles(): Promise<Array<{ id: string; image?: string }>> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: CUSTOM_STYLES_KEY } });
    return config?.value ? JSON.parse(config.value) : [];
  } catch {
    return [];
  }
}

/**
 * Get the resolved image path for a movie style (applying overrides, checking custom styles).
 */
export async function getResolvedMovieStyleImage(styleId: string): Promise<string | undefined> {
  const overrides = await getOverrides();
  const override = overrides[styleId];
  if (override?.image) return override.image;

  const defaultStyle = movieStyles.find(s => s.id === styleId);
  if (defaultStyle?.image) return defaultStyle.image;

  // Check custom styles
  const customStyles = await getCustomStyles();
  const customStyle = customStyles.find(s => s.id === styleId);
  return customStyle?.image;
}

/**
 * Load a style reference image as base64 for use with Gemini.
 * Returns null if the image can't be loaded.
 */
export async function loadStyleReferenceImage(
  styleId: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const imagePath = await getResolvedMovieStyleImage(styleId);
    if (!imagePath) return null;

    // Handle local file paths (e.g., /images/movie-styles/xxx.jpg or /images/movie-styles/xxx.jpg?v=123)
    if (imagePath.startsWith('/')) {
      // Strip query params (cache-busting) before filesystem access
      const cleanPath = imagePath.split('?')[0];
      const fullPath = path.join(process.cwd(), 'public', cleanPath);
      if (!fs.existsSync(fullPath)) {
        console.warn(`Style reference image not found: ${fullPath}`);
        return null;
      }
      const buffer = fs.readFileSync(fullPath);
      const ext = path.extname(cleanPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { base64: buffer.toString('base64'), mimeType };
    }

    // Handle remote URLs
    if (imagePath.startsWith('http')) {
      const response = await fetch(imagePath);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { base64: buffer.toString('base64'), mimeType: contentType };
    }

    return null;
  } catch (err) {
    console.error(`Failed to load style reference for ${styleId}:`, err);
    return null;
  }
}
