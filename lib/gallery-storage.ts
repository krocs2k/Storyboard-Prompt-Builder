import fs from 'fs';
import path from 'path';
import { isBunnyStorageReady, uploadToBunny, readFromBunny, deleteFromBunny, bunnyCdnUrl } from '@/lib/bunny-storage';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const GALLERY_DIR = path.join(DATA_DIR, 'gallery');

function mimeFor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  return 'image/png';
}

/**
 * Ensure the gallery directory exists for a given project
 */
function ensureProjectGalleryDir(projectId: string): string {
  const dir = path.join(GALLERY_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Save an image buffer to the gallery (disk + BunnyCDN when configured).
 */
export async function saveGalleryImage(
  projectId: string,
  imageBuffer: Buffer,
  extension: string = 'png'
): Promise<{ filePath: string; fileName: string; relativePath: string }> {
  const dir = ensureProjectGalleryDir(projectId);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `gallery_${timestamp}_${random}.${extension}`;
  const filePath = path.join(dir, fileName);
  const relativePath = path.join('gallery', projectId, fileName);
  try {
    fs.writeFileSync(filePath, imageBuffer);
  } catch (e) {
    console.warn('[gallery-storage] disk write failed:', e);
  }
  try {
    if (await isBunnyStorageReady()) {
      await uploadToBunny(relativePath.split(path.sep).join('/'), imageBuffer, mimeFor(extension));
    }
  } catch (e) {
    console.warn('[gallery-storage] Bunny upload failed:', e);
  }
  return { filePath, fileName, relativePath };
}

/**
 * Read a gallery image from disk, falling back to BunnyCDN.
 */
export async function readGalleryImage(relativePath: string): Promise<Buffer | null> {
  const filePath = path.join(DATA_DIR, relativePath);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
  return await readFromBunny(relativePath.split(path.sep).join('/'));
}

/**
 * Delete a gallery image file from disk and BunnyCDN.
 */
export async function deleteGalleryImageFile(relativePath: string): Promise<boolean> {
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
 * Delete all gallery images for a project (disk + BunnyCDN folder).
 */
export async function deleteProjectGalleryImages(projectId: string): Promise<void> {
  const dir = path.join(GALLERY_DIR, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  try { await deleteFromBunny(`gallery/${projectId}/`); } catch {}
}

/**
 * Resolve the public CDN url for a gallery object key, when BunnyCDN is configured.
 */
export async function galleryCdnUrl(relativePath: string): Promise<string | null> {
  if (!(await isBunnyStorageReady())) return null;
  return bunnyCdnUrl(relativePath.split(path.sep).join('/'));
}
