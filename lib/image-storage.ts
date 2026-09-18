import fs from 'fs';
import path from 'path';
import { isBunnyStorageReady, uploadToBunny, readFromBunny, deleteFromBunny, bunnyCdnUrl, listBunnyObjects } from '@/lib/bunny-storage';

// In Docker deployment, this directory should be mounted as a volume
// e.g., docker run -v /host/data:/app/data ...
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

function mimeFor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/png';
}

/**
 * Ensure the images directory exists for a given project
 */
export function ensureProjectImageDir(projectId: string): string {
  const dir = path.join(IMAGES_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save an image buffer. Writes to local disk (fallback) and, when BunnyCDN
 * storage is configured, uploads the same object to the CDN. The returned
 * relativePath is used both as the on-disk path and the BunnyCDN object key.
 */
export async function saveImage(
  projectId: string,
  blockNumber: number,
  imageBuffer: Buffer,
  extension: string = 'png'
): Promise<{ filePath: string; fileName: string; relativePath: string }> {
  const dir = ensureProjectImageDir(projectId);
  const fileName = `block_${blockNumber.toString().padStart(3, '0')}.${extension}`;
  const filePath = path.join(dir, fileName);
  const relativePath = path.join('images', projectId, fileName);
  try {
    fs.writeFileSync(filePath, imageBuffer);
  } catch (e) {
    // Disk may be read-only in some deployments; that's fine when Bunny is configured.
    console.warn('[image-storage] disk write failed:', e);
  }
  try {
    if (await isBunnyStorageReady()) {
      await uploadToBunny(relativePath.split(path.sep).join('/'), imageBuffer, mimeFor(extension));
    }
  } catch (e) {
    console.warn('[image-storage] Bunny upload failed:', e);
  }
  return { filePath, fileName, relativePath };
}

/**
 * Read an image from disk, falling back to BunnyCDN when not present locally.
 */
export async function readImage(relativePath: string): Promise<Buffer | null> {
  const filePath = path.join(DATA_DIR, relativePath);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
  return await readFromBunny(relativePath.split(path.sep).join('/'));
}

/**
 * Delete an image from disk and BunnyCDN.
 */
export async function deleteImage(relativePath: string): Promise<boolean> {
  const filePath = path.join(DATA_DIR, relativePath);
  let ok = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    ok = true;
  }
  try { await deleteFromBunny(relativePath.split(path.sep).join('/')); } catch {}
  return ok;
}

/**
 * Delete all images for a project (disk + BunnyCDN folder).
 */
export async function deleteProjectImages(projectId: string): Promise<void> {
  const dir = path.join(IMAGES_DIR, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  try { await deleteFromBunny(`images/${projectId}/`); } catch {}
}

/**
 * Get the absolute path for a relative image path
 */
export function getAbsoluteImagePath(relativePath: string): string {
  return path.join(DATA_DIR, relativePath);
}

/**
 * Check if an image exists on local disk.
 */
export function imageExists(relativePath: string): boolean {
  return fs.existsSync(path.join(DATA_DIR, relativePath));
}

/**
 * Resolve the public CDN url for an image object key, when BunnyCDN is configured.
 */
export async function imageCdnUrl(relativePath: string): Promise<string | null> {
  if (!(await isBunnyStorageReady())) return null;
  return bunnyCdnUrl(relativePath.split(path.sep).join('/'));
}

// ── Bulk migration of bundled/default static images to BunnyCDN ──────────────
// The app ships hundreds of default category images under public/images/** and
// admin-uploaded ones under data/category-images/**. These are normally served
// as static files, which some self-hosted builds strip. Mirroring them to
// BunnyCDN (under the "category-images/<relpath>" key, matching the
// /api/category-images serving route) lets them be served from the CDN when the
// local file is missing.

export interface StaticMigrationResult {
  dryRun: boolean;
  scanned: number;
  alreadyOnCdn: number;
  toUpload: number;
  uploaded: number;
  failed: number;
  bytes: number;
  errors: string[];
}

const IMG_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

function walkFiles(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkFiles(full, out);
    } else if (e.isFile()) {
      const ext = e.name.split('.').pop()?.toLowerCase() || '';
      if (IMG_EXTS.has(ext)) out.push(full);
    }
  }
}

function svgMime(ext: string): string {
  return ext === 'svg' ? 'image/svg+xml' : mimeFor(ext);
}

/**
 * Upload all bundled/default static images to BunnyCDN under the
 * "category-images/<relpath>" key. Idempotent: files already present on the CDN
 * are skipped, so it converges across repeated runs. No-op (returns zeros) when
 * BunnyCDN is not configured.
 */
export async function migrateStaticImagesToBunny(dryRun = true): Promise<StaticMigrationResult> {
  const result: StaticMigrationResult = {
    dryRun, scanned: 0, alreadyOnCdn: 0, toUpload: 0, uploaded: 0, failed: 0, bytes: 0, errors: [],
  };
  if (!(await isBunnyStorageReady())) {
    result.errors.push('BunnyCDN storage is not configured.');
    return result;
  }

  const cwd = process.cwd();
  const dataDir = process.env.DATA_DIR || path.join(cwd, 'data');
  const bases = [
    path.join(cwd, 'public', 'images'),
    path.join(cwd, 'app', 'public', 'images'),
    path.join(cwd, '.build', 'standalone', 'app', 'public', 'images'),
    path.join(dataDir, 'category-images'),
  ];

  // key -> absolute local path (first occurrence wins, dedups across bases)
  const targets = new Map<string, string>();
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    const files: string[] = [];
    walkFiles(base, files);
    for (const abs of files) {
      const rel = path.relative(base, abs).split(path.sep).join('/');
      const key = `category-images/${rel}`;
      if (!targets.has(key)) targets.set(key, abs);
    }
  }
  result.scanned = targets.size;

  // Build set of keys already on the CDN by listing each distinct parent folder.
  const dirPrefixes = new Set<string>();
  for (const key of Array.from(targets.keys())) {
    const idx = key.lastIndexOf('/');
    dirPrefixes.add(key.slice(0, idx + 1));
  }
  const existing = new Set<string>();
  for (const prefix of Array.from(dirPrefixes)) {
    const objs = await listBunnyObjects(prefix);
    for (const o of objs) {
      if (!o.isDirectory) existing.add(prefix + o.objectName);
    }
  }

  const missing: Array<{ key: string; abs: string }> = [];
  for (const [key, abs] of Array.from(targets.entries())) {
    if (existing.has(key)) result.alreadyOnCdn++;
    else missing.push({ key, abs });
  }
  result.toUpload = missing.length;

  if (dryRun) {
    for (const m of missing) {
      try { result.bytes += fs.statSync(m.abs).size; } catch {}
    }
    return result;
  }

  // Upload missing files with limited concurrency.
  const CONCURRENCY = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < missing.length) {
      const i = cursor++;
      const { key, abs } = missing[i];
      try {
        const buf = fs.readFileSync(abs);
        const ext = abs.split('.').pop()?.toLowerCase() || 'png';
        await uploadToBunny(key, buf, svgMime(ext));
        result.uploaded++;
        result.bytes += buf.length;
      } catch (e: any) {
        result.failed++;
        if (result.errors.length < 10) result.errors.push(`${key}: ${e?.message || e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () => worker()));
  return result;
}
