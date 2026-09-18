import { prisma } from '@/lib/db';
import {
  isBunnyStorageReady,
  uploadToBunny,
  deleteFromBunny,
  listBunnyObjects,
} from '@/lib/bunny-storage';

/**
 * Persistent storage for generated project documents (screenplay / novel /
 * audio-drama / voiceover DOCX + storyboard PDF) on BunnyCDN.
 *
 * Every document gets a permanent, shareable CDN link. When a document of the
 * same (projectId, docType, format) is regenerated, the previous Bunny object
 * is deleted first so copies never accumulate. All functions no-op gracefully
 * when BunnyCDN is not configured (returning null), so downloads keep working
 * exactly as before.
 */

export type DocType =
  | 'screenplay'
  | 'novel'
  | 'audio-drama'
  | 'voiceover'
  | 'storyboard-pdf';

export interface PersistedDocument {
  cdnUrl: string;
  cloudStoragePath: string;
  fileName: string;
  docType: string;
  format: string;
  sizeBytes: number;
}

function sanitize(name: string): string {
  return (name || 'document')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'document';
}

/**
 * Persist a generated document buffer to BunnyCDN and upsert its DB record.
 * Deletes the previous object for the same (projectId, docType, format).
 * Returns null when Bunny is not configured or projectId is missing/invalid.
 */
export async function persistProjectDocument(
  projectId: string | undefined | null,
  docType: DocType,
  format: string,
  baseName: string,
  buffer: Buffer,
  contentType: string,
): Promise<PersistedDocument | null> {
  if (!projectId) return null;
  if (!(await isBunnyStorageReady())) return null;

  // Confirm the project exists (avoids orphan rows / FK errors).
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return null;

  const fileName = `${sanitize(baseName)}-${docType}.${format}`;
  const objectKey = `documents/${projectId}/${docType}-${Date.now()}.${format}`;

  try {
    // Remove any previous stored copy for this doc slot.
    const existing = await prisma.projectDocument.findUnique({
      where: { projectId_docType_format: { projectId, docType, format } },
    });
    if (existing?.cloudStoragePath && existing.cloudStoragePath !== objectKey) {
      await deleteFromBunny(existing.cloudStoragePath).catch(() => {});
    }

    const cdnUrl = await uploadToBunny(objectKey, buffer, contentType);

    const row = await prisma.projectDocument.upsert({
      where: { projectId_docType_format: { projectId, docType, format } },
      create: {
        projectId, docType, format, fileName,
        cloudStoragePath: objectKey, cdnUrl, sizeBytes: buffer.length,
      },
      update: {
        fileName, cloudStoragePath: objectKey, cdnUrl, sizeBytes: buffer.length,
      },
    });

    return {
      cdnUrl: row.cdnUrl,
      cloudStoragePath: row.cloudStoragePath,
      fileName: row.fileName,
      docType: row.docType,
      format: row.format,
      sizeBytes: row.sizeBytes,
    };
  } catch (e) {
    console.warn('[document-storage] persist failed for', projectId, docType, e);
    return null;
  }
}

/** List saved documents for a project. */
export async function listProjectDocuments(projectId: string) {
  try {
    return await prisma.projectDocument.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  } catch {
    return [];
  }
}

/**
 * Delete every stored document for a project: removes the whole
 * documents/{projectId}/ folder from Bunny and the DB rows.
 * Best-effort; safe to call even when Bunny is not configured.
 */
export async function deleteProjectDocuments(projectId: string): Promise<void> {
  try {
    // Delete each known object, then the folder for good measure.
    const rows = await prisma.projectDocument.findMany({ where: { projectId } });
    for (const r of rows) {
      if (r.cloudStoragePath) await deleteFromBunny(r.cloudStoragePath).catch(() => {});
    }
    await deleteFromBunny(`documents/${projectId}/`).catch(() => {});
  } catch (e) {
    console.warn('[document-storage] delete folder failed for', projectId, e);
  }
  // DB rows cascade-delete with the project, but clear them proactively too.
  try {
    await prisma.projectDocument.deleteMany({ where: { projectId } });
  } catch {
    /* ignore – rows may already be gone via cascade */
  }
}

export interface OrphanScanResult {
  scanned: number;
  orphanedFolders: string[];
  deletedFolders: string[];
  freedBytes: number;
  bunnyReady: boolean;
}

/**
 * Scan a per-project Bunny prefix (e.g. "documents/", "images/", "gallery/")
 * whose immediate children are project-id folders, and delete any folder whose
 * projectId no longer exists in the database. When dryRun is true, nothing is
 * deleted – it only reports what would be removed.
 */
export async function scanOrphanedProjectFolders(
  prefix: string,
  dryRun = true,
): Promise<OrphanScanResult> {
  const result: OrphanScanResult = {
    scanned: 0, orphanedFolders: [], deletedFolders: [], freedBytes: 0,
    bunnyReady: await isBunnyStorageReady(),
  };
  if (!result.bunnyReady) return result;

  const entries = await listBunnyObjects(prefix);
  const dirs = entries.filter(e => e.isDirectory && e.objectName);
  result.scanned = dirs.length;
  if (dirs.length === 0) return result;

  const ids = dirs.map(d => d.objectName);
  const existing = await prisma.project.findMany({
    where: { id: { in: ids } }, select: { id: true },
  });
  const existingSet = new Set(existing.map(p => p.id));

  for (const d of dirs) {
    if (existingSet.has(d.objectName)) continue;
    const folderKey = `${prefix.replace(/\/+$/, '')}/${d.objectName}/`;
    result.orphanedFolders.push(folderKey);
    // Sum sizes of the folder contents for reporting.
    const children = await listBunnyObjects(folderKey);
    result.freedBytes += children.reduce((s, c) => s + (c.length || 0), 0);
    if (!dryRun) {
      const ok = await deleteFromBunny(folderKey).catch(() => false);
      if (ok) result.deletedFolders.push(folderKey);
    }
  }
  return result;
}

export interface OrphanVideoResult {
  scanned: number;
  orphanedKeys: string[];
  deletedKeys: string[];
  freedBytes: number;
  bunnyReady: boolean;
}

/**
 * Videos are stored per-file under "videos/{uuid}.mp4" (not namespaced by
 * project), so orphan detection compares each object against the set of keys
 * still referenced by any DirectorVideo row. Anything not referenced is orphaned.
 */
export async function scanOrphanedVideos(dryRun = true): Promise<OrphanVideoResult> {
  const result: OrphanVideoResult = {
    scanned: 0, orphanedKeys: [], deletedKeys: [], freedBytes: 0,
    bunnyReady: await isBunnyStorageReady(),
  };
  if (!result.bunnyReady) return result;

  const objects = (await listBunnyObjects('videos/')).filter(o => !o.isDirectory && o.objectName);
  result.scanned = objects.length;
  if (objects.length === 0) return result;

  // Collect every video-object key referenced anywhere in the DB.
  const rows = await prisma.directorVideo.findMany({
    select: { videoUrl: true, thumbnailUrl: true, startFrameUrl: true, endFrameUrl: true },
  });
  const referenced = new Set<string>();
  for (const r of rows) {
    for (const url of [r.videoUrl, r.thumbnailUrl, r.startFrameUrl, r.endFrameUrl]) {
      if (!url) continue;
      const m = url.match(/\/(videos\/[^?]+)/);
      if (m) referenced.add(m[1]);
    }
  }

  for (const o of objects) {
    const key = `videos/${o.objectName}`;
    if (referenced.has(key)) continue;
    result.orphanedKeys.push(key);
    result.freedBytes += o.length || 0;
    if (!dryRun) {
      const ok = await deleteFromBunny(key).catch(() => false);
      if (ok) result.deletedKeys.push(key);
    }
  }
  return result;
}
