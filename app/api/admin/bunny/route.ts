import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  BUNNY_CONFIG_KEYS,
  getBunnyConfig,
  invalidateBunnyCache,
  provisionBunny,
  uploadToBunny,
  isBunnyStorageReady,
} from '@/lib/bunny-storage';
import { scanOrphanedProjectFolders, scanOrphanedVideos } from '@/lib/document-storage';
import { migrateStaticImagesToBunny } from '@/lib/image-storage';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') return null;
  return session;
}

async function upsert(key: string, value: string) {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

function mask(v: string | null | undefined) {
  if (!v) return null;
  if (v.length <= 10) return '****';
  return v.slice(0, 6) + '...' + v.slice(-4);
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const cfg = await getBunnyConfig();
    const provisioned = await isBunnyStorageReady();
    return NextResponse.json({
      hasApiKey: !!cfg.apiKey,
      maskedKey: mask(cfg.apiKey),
      provisioned,
      storageZone: cfg.storageZone,
      pullZone: cfg.pullZone,
      cdnUrl: cfg.cdnUrl,
      region: cfg.region,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load BunnyCDN status' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string;

    if (action === 'saveKey') {
      const apiKey = (body?.apiKey || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return NextResponse.json({ error: 'Please provide a valid BunnyCDN Account API key.' }, { status: 400 });
      }
      await upsert('BUNNY_API_KEY', apiKey);
      invalidateBunnyCache();
      return NextResponse.json({ success: true, message: 'BunnyCDN API key saved.' });
    }

    if (action === 'provision') {
      const cfg = await getBunnyConfig();
      const apiKey = (body?.apiKey || cfg.apiKey || '').trim();
      if (!apiKey || apiKey.length < 10) {
        return NextResponse.json({ error: 'Save a BunnyCDN Account API key first.' }, { status: 400 });
      }
      const region = (body?.region || 'DE').toString();
      // Persist the key too (in case it was passed inline and not yet saved).
      await upsert('BUNNY_API_KEY', apiKey);

      const result = await provisionBunny(apiKey, region);
      await upsert('BUNNY_STORAGE_ZONE', result.storageZone);
      await upsert('BUNNY_STORAGE_PASSWORD', result.storagePassword);
      await upsert('BUNNY_STORAGE_HOST', result.storageHost);
      await upsert('BUNNY_PULL_ZONE', result.pullZone);
      await upsert('BUNNY_CDN_URL', result.cdnUrl);
      await upsert('BUNNY_STORAGE_REGION', result.region);
      invalidateBunnyCache();

      return NextResponse.json({
        success: true,
        message: 'CDN & Cloud Storage set up successfully.',
        storageZone: result.storageZone,
        pullZone: result.pullZone,
        cdnUrl: result.cdnUrl,
        region: result.region,
      });
    }

    if (action === 'test') {
      const ready = await isBunnyStorageReady();
      if (!ready) {
        return NextResponse.json({ error: 'BunnyCDN storage is not set up yet.' }, { status: 400 });
      }
      const key = `._healthcheck/test-${Date.now()}.txt`;
      const payload = Buffer.from(`storyshots healthcheck ${new Date().toISOString()}`);
      let cdnUrl = '';
      try {
        cdnUrl = await uploadToBunny(key, payload, 'text/plain');
      } catch (e: any) {
        return NextResponse.json({ error: `Upload failed: ${e?.message || e}` }, { status: 502 });
      }
      // CDN propagation can lag a moment; try a couple of times.
      let served = false;
      for (let i = 0; i < 3 && !served; i++) {
        try {
          const r = await fetch(cdnUrl, { cache: 'no-store' });
          served = r.ok;
        } catch {}
        if (!served) await new Promise(res => setTimeout(res, 1200));
      }
      return NextResponse.json({
        success: true,
        uploaded: true,
        served,
        cdnUrl,
        message: served
          ? 'Upload and CDN delivery both verified.'
          : 'Upload succeeded; CDN delivery is still propagating (this is normal for a brand-new zone).',
      });
    }

    if (action === 'cleanup') {
      const ready = await isBunnyStorageReady();
      if (!ready) {
        return NextResponse.json({ error: 'BunnyCDN storage is not set up yet.' }, { status: 400 });
      }
      // dryRun defaults to true so admins can preview before deleting.
      const dryRun = body?.dryRun !== false;
      const prefixes = ['documents/', 'images/', 'gallery/', 'category-images/pool/'];
      const folders: Record<string, any> = {};
      let totalFreed = 0;
      let totalOrphans = 0;
      let totalDeleted = 0;
      for (const p of prefixes) {
        const r = await scanOrphanedProjectFolders(p, dryRun);
        folders[p] = r;
        totalFreed += r.freedBytes;
        totalOrphans += r.orphanedFolders.length;
        totalDeleted += r.deletedFolders.length;
      }
      const videos = await scanOrphanedVideos(dryRun);
      totalFreed += videos.freedBytes;
      totalOrphans += videos.orphanedKeys.length;
      totalDeleted += videos.deletedKeys.length;

      return NextResponse.json({
        success: true,
        dryRun,
        folders,
        videos,
        totalOrphans,
        totalDeleted,
        freedBytes: totalFreed,
        message: dryRun
          ? `Found ${totalOrphans} orphaned item(s) (~${(totalFreed / 1048576).toFixed(1)} MB). Run again to delete.`
          : `Deleted ${totalDeleted} orphaned item(s), freeing ~${(totalFreed / 1048576).toFixed(1)} MB.`,
      });
    }

    if (action === 'migrate-static') {
      const ready = await isBunnyStorageReady();
      if (!ready) {
        return NextResponse.json({ error: 'BunnyCDN storage is not set up yet.' }, { status: 400 });
      }
      // dryRun defaults to true so admins preview the count before uploading.
      const dryRun = body?.dryRun !== false;
      const r = await migrateStaticImagesToBunny(dryRun);
      const mb = (r.bytes / 1048576).toFixed(1);
      return NextResponse.json({
        success: true,
        ...r,
        message: dryRun
          ? `Found ${r.scanned} bundled image(s); ${r.alreadyOnCdn} already on the CDN, ${r.toUpload} to upload (~${mb} MB). Run again to upload.`
          : `Uploaded ${r.uploaded} image(s) (~${mb} MB) to the CDN. ${r.alreadyOnCdn} were already present, ${r.failed} failed.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'BunnyCDN operation failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.systemConfig.deleteMany({ where: { key: { in: BUNNY_CONFIG_KEYS } } });
    invalidateBunnyCache();
    return NextResponse.json({ success: true, message: 'BunnyCDN configuration removed.' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to remove BunnyCDN configuration' }, { status: 500 });
  }
}
