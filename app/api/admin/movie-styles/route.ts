export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { movieStyles as defaultStyles } from '@/lib/data/movie-styles';
import { invalidateMovieStyleCache } from '@/lib/movie-style-ref';

const OVERRIDES_KEY = 'movie_style_overrides';
const SETTINGS_KEY = 'movie_style_settings';
const CUSTOM_STYLES_KEY = 'movie_style_custom';
const HIDDEN_STYLES_KEY = 'movie_style_hidden';

interface MovieStyleOverride {
  image?: string;
  description?: string;
}

interface MovieStyleSettings {
  useImageAsReference: boolean;
}

interface CustomMovieStyle {
  id: string;
  name: string;
  description: string;
  style: string;
  image?: string;
}

async function getOverrides(): Promise<Record<string, MovieStyleOverride>> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: OVERRIDES_KEY } });
    return config?.value ? JSON.parse(config.value) : {};
  } catch {
    return {};
  }
}

async function getSettings(): Promise<MovieStyleSettings> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: SETTINGS_KEY } });
    return config?.value ? JSON.parse(config.value) : { useImageAsReference: false };
  } catch {
    return { useImageAsReference: false };
  }
}

async function getCustomStyles(): Promise<CustomMovieStyle[]> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: CUSTOM_STYLES_KEY } });
    return config?.value ? JSON.parse(config.value) : [];
  } catch {
    return [];
  }
}

async function getHiddenIds(): Promise<string[]> {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: HIDDEN_STYLES_KEY } });
    return config?.value ? JSON.parse(config.value) : [];
  } catch {
    return [];
  }
}

/**
 * GET - List all movie styles (merged defaults + custom, minus hidden, with overrides) and settings
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = (session.user as any)?.role === 'admin';
  const [overrides, settings, customStyles, hiddenIds] = await Promise.all([
    getOverrides(),
    getSettings(),
    getCustomStyles(),
    getHiddenIds(),
  ]);

  const hiddenSet = new Set(hiddenIds);

  // Merge defaults (non-hidden) with overrides
  const styles = defaultStyles
    .filter(s => !hiddenSet.has(s.id))
    .map(s => {
      const override = overrides[s.id];
      return {
        ...s,
        image: override?.image ?? s.image,
        description: override?.description ?? s.description,
        hasOverride: !!override,
        isCustom: false,
      };
    });

  // Add custom styles
  for (const cs of customStyles) {
    styles.push({
      ...cs,
      image: cs.image ?? undefined,
      hasOverride: false,
      isCustom: true,
    });
  }

  // Sort alphabetically by name
  styles.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  // Rewrite /images/... paths to /api/category-images/... for Docker/production compatibility
  const rewrittenStyles = styles.map(s => ({
    ...s,
    image: rewriteImagePath(s.image),
  }));

  return NextResponse.json({ styles: rewrittenStyles, settings, isAdmin });
}

/**
 * POST - Add a new custom movie style (admin only)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, style, image } = await req.json();

    if (!name || !description || !style) {
      return NextResponse.json({ error: 'Name, description, and style are required' }, { status: 400 });
    }

    // Generate a slug id
    const id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    const customStyles = await getCustomStyles();

    customStyles.push({ id, name, description, style, image: image || undefined });

    await prisma.systemConfig.upsert({
      where: { key: CUSTOM_STYLES_KEY },
      update: { value: JSON.stringify(customStyles) },
      create: { key: CUSTOM_STYLES_KEY, value: JSON.stringify(customStyles) },
    });

    invalidateMovieStyleCache();
    return NextResponse.json({ success: true, style: { id, name, description, style, image } });
  } catch (err) {
    console.error('Failed to add custom movie style:', err);
    return NextResponse.json({ error: 'Failed to add style' }, { status: 500 });
  }
}

/**
 * PUT - Update a movie style override (admin only)
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, image, description } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Style ID is required' }, { status: 400 });
    }

    // Check if it's a custom style
    const customStyles = await getCustomStyles();
    const customIdx = customStyles.findIndex(s => s.id === id);

    if (customIdx >= 0) {
      // Update custom style directly
      if (image !== undefined) customStyles[customIdx].image = image;
      if (description !== undefined) customStyles[customIdx].description = description;

      await prisma.systemConfig.upsert({
        where: { key: CUSTOM_STYLES_KEY },
        update: { value: JSON.stringify(customStyles) },
        create: { key: CUSTOM_STYLES_KEY, value: JSON.stringify(customStyles) },
      });

      invalidateMovieStyleCache();
      return NextResponse.json({ success: true, override: null });
    }

    // Default style — use overrides
    const defaultStyle = defaultStyles.find(s => s.id === id);
    if (!defaultStyle) {
      return NextResponse.json({ error: 'Style not found' }, { status: 404 });
    }

    const overrides = await getOverrides();

    const override: MovieStyleOverride = overrides[id] || {};
    if (image !== undefined) {
      override.image = image;
    }
    if (description !== undefined && description !== defaultStyle.description) {
      override.description = description;
    }

    if (override.image || override.description) {
      overrides[id] = override;
    } else {
      delete overrides[id];
    }

    await prisma.systemConfig.upsert({
      where: { key: OVERRIDES_KEY },
      update: { value: JSON.stringify(overrides) },
      create: { key: OVERRIDES_KEY, value: JSON.stringify(overrides) },
    });

    invalidateMovieStyleCache();
    return NextResponse.json({ success: true, override: overrides[id] || null });
  } catch (err) {
    console.error('Failed to update movie style:', err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

/**
 * PATCH - Update settings (admin only)
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { useImageAsReference } = await req.json();
    const settings = await getSettings();

    if (useImageAsReference !== undefined) {
      settings.useImageAsReference = useImageAsReference;
    }

    await prisma.systemConfig.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(settings) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(settings) },
    });

    invalidateMovieStyleCache();
    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('Failed to update settings:', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

/**
 * DELETE - Delete a style (admin only)
 * For custom styles: removes from custom list
 * For default styles: adds to hidden list (and removes any overrides)
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, resetOnly } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Style ID is required' }, { status: 400 });
    }

    // If resetOnly, just reset overrides (existing behavior)
    if (resetOnly) {
      const overrides = await getOverrides();
      delete overrides[id];
      await prisma.systemConfig.upsert({
        where: { key: OVERRIDES_KEY },
        update: { value: JSON.stringify(overrides) },
        create: { key: OVERRIDES_KEY, value: JSON.stringify(overrides) },
      });
      invalidateMovieStyleCache();
      return NextResponse.json({ success: true });
    }

    // Check if it's a custom style
    const customStyles = await getCustomStyles();
    const customIdx = customStyles.findIndex(s => s.id === id);

    if (customIdx >= 0) {
      customStyles.splice(customIdx, 1);
      await prisma.systemConfig.upsert({
        where: { key: CUSTOM_STYLES_KEY },
        update: { value: JSON.stringify(customStyles) },
        create: { key: CUSTOM_STYLES_KEY, value: JSON.stringify(customStyles) },
      });
      invalidateMovieStyleCache();
      return NextResponse.json({ success: true });
    }

    // Default style — hide it
    const defaultStyle = defaultStyles.find(s => s.id === id);
    if (!defaultStyle) {
      return NextResponse.json({ error: 'Style not found' }, { status: 404 });
    }

    const hiddenIds = await getHiddenIds();
    if (!hiddenIds.includes(id)) {
      hiddenIds.push(id);
    }

    await prisma.systemConfig.upsert({
      where: { key: HIDDEN_STYLES_KEY },
      update: { value: JSON.stringify(hiddenIds) },
      create: { key: HIDDEN_STYLES_KEY, value: JSON.stringify(hiddenIds) },
    });

    // Also clean up any overrides for the hidden style
    const overrides = await getOverrides();
    if (overrides[id]) {
      delete overrides[id];
      await prisma.systemConfig.upsert({
        where: { key: OVERRIDES_KEY },
        update: { value: JSON.stringify(overrides) },
        create: { key: OVERRIDES_KEY, value: JSON.stringify(overrides) },
      });
    }

    invalidateMovieStyleCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete movie style:', err);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

/** Rewrite static /images/... paths to go through the dynamic API route */
function rewriteImagePath(img?: string): string | undefined {
  if (!img) return img;
  if (img.startsWith('/api/category-images/')) return img;
  if (img.startsWith('/images/')) {
    return '/api/category-images/' + img.slice('/images/'.length);
  }
  return img;
}