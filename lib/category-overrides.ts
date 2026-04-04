/**
 * Generic category image override system.
 * Each category stores overrides in SystemConfig with key `{category}_overrides`.
 * Override shape: Record<itemId, { image?: string; description?: string }>
 */
import { prisma } from '@/lib/db';

export interface CategoryOverride {
  image?: string;
  description?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  style?: string;
  image?: string;
}

const OVERRIDE_SUFFIX = '_overrides';

// In-memory cache per category (60s TTL)
const cache: Record<string, { data: Record<string, CategoryOverride>; fetchedAt: number }> = {};
const CACHE_TTL = 60_000;

export function overrideKey(category: string): string {
  return `${category}${OVERRIDE_SUFFIX}`;
}

export function invalidateCategoryCache(category: string) {
  delete cache[category];
}

export function invalidateAllCategoryCaches() {
  Object.keys(cache).forEach(k => delete cache[k]);
}

export async function getCategoryOverrides(category: string): Promise<Record<string, CategoryOverride>> {
  const now = Date.now();
  if (cache[category] && now - cache[category].fetchedAt < CACHE_TTL) {
    return cache[category].data;
  }
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: overrideKey(category) } });
    const data = config?.value ? JSON.parse(config.value) : {};
    cache[category] = { data, fetchedAt: now };
    return data;
  } catch {
    return {};
  }
}

export async function saveCategoryOverrides(category: string, overrides: Record<string, CategoryOverride>): Promise<void> {
  const key = overrideKey(category);
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: JSON.stringify(overrides) },
    update: { value: JSON.stringify(overrides) },
  });
  invalidateCategoryCache(category);
}

/**
 * Merge default items with overrides. Returns items with overrides applied.
 */
export function mergeWithOverrides<T extends CategoryItem>(
  items: T[],
  overrides: Record<string, CategoryOverride>
): (T & { hasOverride: boolean })[] {
  return items.map(item => {
    const ov = overrides[item.id];
    if (!ov) return { ...item, hasOverride: false };
    return {
      ...item,
      image: ov.image ?? item.image,
      description: ov.description ?? item.description,
      hasOverride: true,
    };
  });
}

/** All supported category keys and their data module paths */
export const CATEGORY_CONFIG: Record<string, {
  label: string;
  section: string;
  dataExport: string;  // named export from data file
  dataFile: string;    // path relative to lib/data/
  imageDir?: string;   // subdirectory in public/images/ for name-based matching
}> = {
  'image-types': { label: 'Image Types', section: 'Section 1', dataExport: 'imageTypes', dataFile: 'image-types' },
  'movie-styles': { label: 'Movie Styles', section: 'Section 1', dataExport: 'movieStyles', dataFile: 'movie-styles', imageDir: 'movie-styles' },
  'shot-types': { label: 'Shot Types', section: 'Section 2', dataExport: 'shotTypes', dataFile: 'shot-types' },
  'lighting-sources': { label: 'Lighting Sources', section: 'Section 3', dataExport: 'lightingSources', dataFile: 'lighting-sources' },
  'camera-bodies': { label: 'Camera Bodies', section: 'Section 4', dataExport: 'cameraBodies', dataFile: 'camera-bodies' },
  'focal-lengths': { label: 'Focal Lengths', section: 'Section 4', dataExport: 'focalLengths', dataFile: 'focal-lengths' },
  'lens-types': { label: 'Lens Types', section: 'Section 4', dataExport: 'lensTypes', dataFile: 'lens-types' },
  'film-stocks': { label: 'Film Stocks', section: 'Section 4', dataExport: 'filmStocks', dataFile: 'film-stocks' },
  'photographer-styles': { label: 'Photographer Styles', section: 'Section 5', dataExport: 'photographerStyles', dataFile: 'photographer-styles', imageDir: 'photographer-styles' },
  'filter-effects': { label: 'Filter Effects', section: 'Section 5', dataExport: 'filterEffects', dataFile: 'filter-effects', imageDir: 'filter-effects' },
};

/** Load raw items for a given category key */
export async function loadCategoryItems(category: string): Promise<CategoryItem[]> {
  const config = CATEGORY_CONFIG[category];
  if (!config) return [];
  try {
    const mod = await import(`@/lib/data/${config.dataFile}`);
    return (mod[config.dataExport] || []) as CategoryItem[];
  } catch {
    return [];
  }
}
