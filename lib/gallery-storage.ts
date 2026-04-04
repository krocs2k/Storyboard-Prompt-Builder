import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const GALLERY_DIR = path.join(DATA_DIR, 'gallery');

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
 * Save an image buffer to the gallery
 */
export function saveGalleryImage(
  projectId: string,
  imageBuffer: Buffer,
  extension: string = 'png'
): { filePath: string; fileName: string; relativePath: string } {
  const dir = ensureProjectGalleryDir(projectId);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const fileName = `gallery_${timestamp}_${random}.${extension}`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, imageBuffer);
  const relativePath = path.join('gallery', projectId, fileName);
  return { filePath, fileName, relativePath };
}

/**
 * Read a gallery image from disk
 */
export function readGalleryImage(relativePath: string): Buffer | null {
  const filePath = path.join(DATA_DIR, relativePath);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Delete a gallery image file from disk
 */
export function deleteGalleryImageFile(relativePath: string): boolean {
  const filePath = path.join(DATA_DIR, relativePath);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Delete all gallery images for a project
 */
export function deleteProjectGalleryImages(projectId: string): void {
  const dir = path.join(GALLERY_DIR, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
