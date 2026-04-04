import fs from 'fs';
import path from 'path';

// In Docker deployment, this directory should be mounted as a volume
// e.g., docker run -v /host/data:/app/data ...
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

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
 * Save an image buffer to disk
 */
export function saveImage(
  projectId: string,
  blockNumber: number,
  imageBuffer: Buffer,
  extension: string = 'png'
): { filePath: string; fileName: string; relativePath: string } {
  const dir = ensureProjectImageDir(projectId);
  const fileName = `block_${blockNumber.toString().padStart(3, '0')}.${extension}`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, imageBuffer);
  const relativePath = path.join('images', projectId, fileName);
  return { filePath, fileName, relativePath };
}

/**
 * Read an image from disk
 */
export function readImage(relativePath: string): Buffer | null {
  const filePath = path.join(DATA_DIR, relativePath);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Delete an image from disk
 */
export function deleteImage(relativePath: string): boolean {
  const filePath = path.join(DATA_DIR, relativePath);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Delete all images for a project
 */
export function deleteProjectImages(projectId: string): void {
  const dir = path.join(IMAGES_DIR, projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Get the absolute path for a relative image path
 */
export function getAbsoluteImagePath(relativePath: string): string {
  return path.join(DATA_DIR, relativePath);
}

/**
 * Check if an image exists
 */
export function imageExists(relativePath: string): boolean {
  return fs.existsSync(path.join(DATA_DIR, relativePath));
}
