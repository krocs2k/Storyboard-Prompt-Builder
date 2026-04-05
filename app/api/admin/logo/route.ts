import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Icon sizes needed for PWA
const ICON_SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
];

// Apple splash screen sizes (device: width x height)
const SPLASH_SCREENS = [
  { name: 'splash-640x1136.png', width: 640, height: 1136, label: 'iPhone SE' },
  { name: 'splash-750x1334.png', width: 750, height: 1334, label: 'iPhone 8' },
  { name: 'splash-828x1792.png', width: 828, height: 1792, label: 'iPhone XR' },
  { name: 'splash-1125x2436.png', width: 1125, height: 2436, label: 'iPhone X/XS' },
  { name: 'splash-1170x2532.png', width: 1170, height: 2532, label: 'iPhone 12/13' },
  { name: 'splash-1179x2556.png', width: 1179, height: 2556, label: 'iPhone 14/15 Pro' },
  { name: 'splash-1242x2208.png', width: 1242, height: 2208, label: 'iPhone 8 Plus' },
  { name: 'splash-1284x2778.png', width: 1284, height: 2778, label: 'iPhone 12/13 Pro Max' },
  { name: 'splash-1290x2796.png', width: 1290, height: 2796, label: 'iPhone 14/15 Pro Max' },
  { name: 'splash-1536x2048.png', width: 1536, height: 2048, label: 'iPad Mini/Air' },
  { name: 'splash-1668x2224.png', width: 1668, height: 2224, label: 'iPad Pro 10.5' },
  { name: 'splash-2048x2732.png', width: 2048, height: 2732, label: 'iPad Pro 12.9' },
];

// GET: Return current logo info
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const icons: { name: string; size: number; exists: boolean }[] = [];
  for (const icon of ICON_SIZES) {
    const exists = await fs.access(path.join(PUBLIC_DIR, icon.name)).then(() => true).catch(() => false);
    icons.push({ ...icon, exists });
  }

  const splashScreens: { name: string; width: number; height: number; label: string; exists: boolean }[] = [];
  for (const splash of SPLASH_SCREENS) {
    const exists = await fs.access(path.join(PUBLIC_DIR, splash.name)).then(() => true).catch(() => false);
    splashScreens.push({ ...splash, exists });
  }

  const hasFavicon = await fs.access(path.join(PUBLIC_DIR, 'favicon.svg')).then(() => true).catch(() => false);

  return NextResponse.json({
    icons,
    splashScreens,
    hasFavicon,
    hasLogo: icons.every(i => i.exists),
  });
}

// POST: Upload new logo and generate all PWA assets
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Validate it's an image
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    const results: { name: string; success: boolean; error?: string }[] = [];

    // Generate all icon sizes
    for (const icon of ICON_SIZES) {
      try {
        await sharp(buffer)
          .resize(icon.size, icon.size, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
          .png()
          .toFile(path.join(PUBLIC_DIR, icon.name));
        results.push({ name: icon.name, success: true });
      } catch (err) {
        results.push({ name: icon.name, success: false, error: String(err) });
      }
    }

    // Generate splash screens with centered logo on dark background
    for (const splash of SPLASH_SCREENS) {
      try {
        // Logo should be ~30% of the smaller dimension
        const logoSize = Math.round(Math.min(splash.width, splash.height) * 0.3);
        const resizedLogo = await sharp(buffer)
          .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        await sharp({
          create: {
            width: splash.width,
            height: splash.height,
            channels: 4,
            background: { r: 15, g: 23, b: 42, alpha: 255 },
          },
        })
          .composite([{
            input: resizedLogo,
            gravity: 'centre',
          }])
          .png()
          .toFile(path.join(PUBLIC_DIR, splash.name));
        results.push({ name: splash.name, success: true });
      } catch (err) {
        results.push({ name: splash.name, success: false, error: String(err) });
      }
    }

    // Generate SVG favicon from the logo (simplified square with embedded image)
    try {
      const pngBase64 = (await sharp(buffer).resize(256, 256, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } }).png().toBuffer()).toString('base64');
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#0f172a" rx="32"/>
  <image href="data:image/png;base64,${pngBase64}" x="0" y="0" width="256" height="256"/>
</svg>`;
      await fs.writeFile(path.join(PUBLIC_DIR, 'favicon.svg'), svgContent, 'utf-8');
      results.push({ name: 'favicon.svg', success: true });
    } catch (err) {
      results.push({ name: 'favicon.svg', success: false, error: String(err) });
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Generated ${successCount} assets${failCount > 0 ? ` (${failCount} failed)` : ''}`,
      results,
      totalGenerated: successCount,
      totalFailed: failCount,
    });
  } catch (err) {
    console.error('Logo upload error:', err);
    return NextResponse.json({ error: 'Failed to process logo' }, { status: 500 });
  }
}
