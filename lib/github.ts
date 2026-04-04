/**
 * GitHub Integration Utility
 * Handles INCREMENTAL backup of application code to GitHub using Personal Access Token.
 * Only uploads files that have changed or been added since the last backup.
 * Applies GitHub Readiness transformations before backup (v11 architecture):
 *   1. Prisma schema: remove Abacus output, add generic output path, add Docker binary targets
 *   2. Layout: remove entire Abacus.AI chatllm conditional block
 *   3. next.config.js: remove outputFileTracingRoot & distDir (Docker uses next.config.docker.js)
 *   4. Docker files: Dockerfile, .dockerignore, server.js, docker-entrypoint.sh, docker-compose.yml
 *   5. Lock files: yarn.lock.bak included for Docker builds
 */
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { updateProgress } from './github-progress';

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

/**
 * Compute the Git blob SHA for content (same algorithm Git uses).
 * Git blob SHA = SHA-1("blob {size}\0{content}")
 */
function computeGitBlobSha(content: Buffer): string {
  const header = `blob ${content.length}\0`;
  const hash = crypto.createHash('sha1');
  hash.update(header);
  hash.update(content);
  return hash.digest('hex');
}

const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  '.build',
  'out',
  'dist',
  'build',
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'yarn.lock',
  'package-lock.json',
  '.DS_Store',
  '*.log',
  '.vscode',
  '.idea',
  '__pycache__',
  '*.pyc',
  '.pytest_cache',
  'tsconfig.tsbuildinfo',
  'uploads',
  'core',
  '*.core',
  '*.dump',
  '*.dmp',
];

// Paths excluded from backup (relative to project root)
// ALL images are managed separately via Admin > Image Library export/import (ZIP download)
const EXCLUDE_PATHS = [
  'public/images',
];

const INCLUDE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css',
  '.prisma', '.env.example', '.gitignore', '.txt', '.yaml', '.yml',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.html', '.xml', '.webmanifest',
  '.sh', '.bak',
];

export interface GitHubConfig {
  username: string;
  repository: string;
  token: string;
}

export interface BackupResult {
  success: boolean;
  commitSha?: string;
  filesUploaded: number;
  message: string;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  repoExists: boolean;
  hasWriteAccess: boolean;
}

/**
 * Apply GitHub Readiness transformations to the project files.
 * Modifies file content in-memory before pushing to GitHub to ensure
 * Docker/VPS deployment compatibility.
 *
 * Transforms:
 *   1. Prisma schema: remove Abacus output path, add generic output, ensure Docker binary targets
 *   2. layout.tsx: remove entire Abacus.AI chatllm conditional block
 *   3. next.config.js: remove Abacus-specific settings (outputFileTracingRoot, distDir)
 */
function applyGitHubReadiness(filePath: string, content: string): string {
  const fileName = path.basename(filePath);

  // Fix Prisma schema
  if (fileName === 'schema.prisma') {
    // Remove the Abacus-specific hardcoded output line
    content = content.replace(/^\s*output\s*=\s*"[^"]*"\s*\n/m, '');
    // Add explicit generic output path (suppresses Prisma 7 deprecation warning)
    if (!/^\s*output\s*=/m.test(content)) {
      content = content.replace(
        /(provider\s*=\s*"prisma-client-js")/,
        '$1\n    output = "../node_modules/.prisma/client"'
      );
    }
    // Replace binaryTargets line with Docker-compatible ones (both Debian and Alpine)
    content = content.replace(
      /binaryTargets\s*=\s*\[[^\]]*\]/,
      'binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x", "debian-openssl-3.0.x"]'
    );
  }

  // Remove Abacus.AI chatllm script block from layout (not needed in self-hosted)
  if (fileName === 'layout.tsx') {
    // Remove the full conditional block: comment + env check + script tag
    content = content.replace(
      /\s*\{\/\*.*?Chatbot.*?\*\/\}\s*\{process\.env\.ABACUSAI_API_KEY\s*&&\s*\(\s*<script\s+src="https:\/\/apps\.abacus\.ai\/chatllm\/appllm-lib\.js"><\/script>\s*\)\}/gs,
      ''
    );
    // Fallback: also remove bare script tag if present without conditional wrapper
    content = content.replace(
      /\s*<script\s+src="https:\/\/apps\.abacus\.ai\/chatllm\/appllm-lib\.js"><\/script>\s*/g,
      '\n'
    );
  }

  // Fix next.config.js for Docker/VPS builds (v11 architecture)
  if (fileName === 'next.config.js') {
    // Remove the require('path') line (only needed for Abacus outputFileTracingRoot)
    content = content.replace(/^const path = require\('path'\);\s*\n/m, '');
    // Remove experimental outputFileTracingRoot (Abacus-specific nested dir)
    content = content.replace(/\s*experimental:\s*\{[^}]*outputFileTracingRoot[^}]*\},?\s*/g, '\n');
    // Remove distDir env var (Docker uses default .next)
    content = content.replace(/\s*distDir:\s*process\.env\.[^,]*,?\s*\n/g, '\n');
    // Keep output as env var only — do NOT default to standalone
    // v11 architecture uses next.config.docker.js + server.js + next start
  }

  return content;
}

export async function testGitHubConnection(config: GitHubConfig): Promise<TestConnectionResult> {
  try {
    const octokit = new Octokit({ auth: config.token });

    try {
      await octokit.users.getAuthenticated();
    } catch {
      return {
        success: false,
        message: 'Invalid GitHub token or authentication failed',
        repoExists: false,
        hasWriteAccess: false,
      };
    }

    try {
      const { data: repo } = await octokit.repos.get({
        owner: config.username,
        repo: config.repository,
      });
      return {
        success: true,
        message: `Connected successfully. Repository "${repo.full_name}" found.`,
        repoExists: true,
        hasWriteAccess: repo.permissions?.push || false,
      };
    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status === 404) {
        return {
          success: true,
          message: 'Repository not found. It will be created during the first backup.',
          repoExists: false,
          hasWriteAccess: true,
        };
      }
      throw error;
    }
  } catch (error: unknown) {
    const err = error as { message?: string };
    return {
      success: false,
      message: `Connection test failed: ${err.message || 'Unknown error'}`,
      repoExists: false,
      hasWriteAccess: false,
    };
  }
}

/**
 * Check if a path matches any exclusion pattern.
 * Used for BOTH files and directories.
 */
function isExcluded(relativePath: string, name: string): boolean {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(name)) return true;
    } else if (name === pattern || relativePath.includes(`/${pattern}/`) || relativePath.startsWith(`${pattern}/`)) {
      return true;
    }
  }
  // Check explicit path exclusions (e.g. public/images/data)
  for (const excludedPath of EXCLUDE_PATHS) {
    if (relativePath === excludedPath || relativePath.startsWith(excludedPath + '/') || relativePath.startsWith(excludedPath + '\\')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a FILE (not directory) should be included based on its extension.
 */
function shouldIncludeFile(relativePath: string, fileName: string): boolean {
  if (isExcluded(relativePath, fileName)) return false;

  const ext = path.extname(fileName);
  // Include files without extension that might be config files (Dockerfile, .dockerignore etc)
  if (!ext) {
    const configFiles = ['Dockerfile', '.dockerignore', '.gitignore', 'Makefile'];
    return configFiles.includes(fileName);
  }
  if (!INCLUDE_EXTENSIONS.includes(ext)) {
    return false;
  }
  return true;
}

async function getAllFiles(
  dirPath: string,
  baseDir: string,
  files: string[] = [],
  sessionId?: string,
  onProgress?: (progress: Record<string, unknown>) => void
): Promise<string[]> {
  const entries = await readdir(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const relativePath = path.relative(baseDir, fullPath);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      if (!isExcluded(relativePath, entry)) {
        await getAllFiles(fullPath, baseDir, files, sessionId, onProgress);
      }
    } else if (shouldIncludeFile(relativePath, entry)) {
      files.push(relativePath);
      if (files.length % 10 === 0) {
        const progress = { status: 'scanning', message: `Scanning files... (${files.length} found)`, filesScanned: files.length, currentFile: relativePath };
        if (onProgress) onProgress(progress);
        if (sessionId) updateProgress(sessionId, progress as Partial<import('./github-progress').BackupProgress>);
      }
    }
  }
  return files;
}

async function ensureRepository(octokit: Octokit, config: GitHubConfig): Promise<void> {
  try {
    await octokit.repos.get({
      owner: config.username,
      repo: config.repository,
    });
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status === 404) {
      await octokit.repos.createForAuthenticatedUser({
        name: config.repository,
        description: 'Application Backup',
        private: true,
        auto_init: true,
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      throw error;
    }
  }
}

const BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.eot'];

/**
 * Recursively fetch the full tree from the remote repo (flattened path→sha map).
 */
async function getRemoteTreeMap(
  octokit: Octokit,
  config: GitHubConfig,
  commitSha: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data: commitData } = await octokit.git.getCommit({
      owner: config.username,
      repo: config.repository,
      commit_sha: commitSha,
    });
    const { data: treeData } = await octokit.git.getTree({
      owner: config.username,
      repo: config.repository,
      tree_sha: commitData.tree.sha,
      recursive: 'true',
    });
    for (const item of treeData.tree) {
      if (item.type === 'blob' && item.path && item.sha) {
        map.set(item.path, item.sha);
      }
    }
  } catch (error) {
    console.warn('Could not fetch remote tree (first backup?):', (error as Error).message);
  }
  return map;
}

/**
 * Get the final content buffer for a file (with GitHub Readiness transformations applied).
 */
function getFileContent(fullPath: string, relativePath: string): Buffer {
  const ext = path.extname(relativePath).toLowerCase();
  const isBinary = BINARY_EXTENSIONS.includes(ext);

  if (isBinary) {
    return fs.readFileSync(fullPath);
  } else {
    let content = fs.readFileSync(fullPath, 'utf-8');
    content = applyGitHubReadiness(relativePath, content);
    return Buffer.from(content);
  }
}

interface TreeBuildResult {
  treeSha: string;
  uploaded: number;
  skipped: number;
  deleted: number;
}

/**
 * Build an incremental git tree: only upload blobs for changed/added files.
 * Reuse the existing blob SHA for unchanged files.
 * Files present in remote but missing locally are deleted (not included in new tree).
 */
async function createIncrementalGitTree(
  octokit: Octokit,
  config: GitHubConfig,
  localFiles: string[],
  baseDir: string,
  remoteTree: Map<string, string>,
  sessionId?: string,
  onProgress?: (progress: Record<string, unknown>) => void
): Promise<TreeBuildResult> {
  const tree: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  const totalFiles = localFiles.length;
  let uploaded = 0;
  let skipped = 0;

  // Track which remote files are still present locally
  const localFileSet = new Set(localFiles);
  const deleted = [...remoteTree.keys()].filter(f => !localFileSet.has(f)).length;

  for (let i = 0; i < localFiles.length; i++) {
    const file = localFiles[i];
    const fullPath = path.join(baseDir, file);

    // Get transformed content and compute its Git blob SHA locally
    const contentBuffer = getFileContent(fullPath, file);
    const localSha = computeGitBlobSha(contentBuffer);

    const remoteSha = remoteTree.get(file);

    if (remoteSha && remoteSha === localSha) {
      // File unchanged — reuse existing blob SHA (no upload needed)
      tree.push({ path: file, mode: '100644' as const, type: 'blob' as const, sha: remoteSha });
      skipped++;
    } else {
      // File is new or changed — upload blob
      const blob = await octokit.git.createBlob({
        owner: config.username,
        repo: config.repository,
        content: contentBuffer.toString('base64'),
        encoding: 'base64',
      });
      tree.push({ path: file, mode: '100644' as const, type: 'blob' as const, sha: blob.data.sha });
      uploaded++;
    }

    const processed = i + 1;
    const statusMsg = uploaded > 0
      ? `Processing files... (${processed}/${totalFiles}) — ${uploaded} changed, ${skipped} unchanged`
      : `Processing files... (${processed}/${totalFiles}) — checking for changes...`;
    const uploadProgress = { status: 'uploading', message: statusMsg, filesUploaded: uploaded, filesSkipped: skipped, totalFiles, currentFile: file };
    if (onProgress) onProgress(uploadProgress);
    if (sessionId) updateProgress(sessionId, uploadProgress as Partial<import('./github-progress').BackupProgress>);
  }

  {
    const commitProgress = { status: 'committing' as const, message: 'Creating commit...', filesUploaded: uploaded, totalFiles };
    if (onProgress) onProgress(commitProgress);
    if (sessionId) updateProgress(sessionId, commitProgress as Partial<import('./github-progress').BackupProgress>);
  }

  const { data: treeData } = await octokit.git.createTree({
    owner: config.username,
    repo: config.repository,
    tree,
  });

  return { treeSha: treeData.sha, uploaded, skipped, deleted };
}

export type ProgressCallback = (progress: Record<string, unknown>) => void;

export async function backupToGitHub(
  config: GitHubConfig,
  projectPath: string,
  sessionId?: string,
  onProgress?: ProgressCallback
): Promise<BackupResult> {
  // Helper: report progress via callback or in-memory store
  const report = (data: Record<string, unknown>) => {
    if (onProgress) {
      onProgress(data);
    }
    if (sessionId) {
      updateProgress(sessionId, data as Partial<import('./github-progress').BackupProgress>);
    }
  };

  try {
    report({ status: 'scanning', message: 'Initializing backup...', filesScanned: 0, filesUploaded: 0, totalFiles: 0 });

    const octokit = new Octokit({ auth: config.token });
    await ensureRepository(octokit, config);

    report({ status: 'scanning', message: 'Scanning project files...', filesScanned: 0 });

    const files = await getAllFiles(projectPath, projectPath, [], sessionId, onProgress);

    if (files.length === 0) {
      report({ status: 'error', message: 'No files found to backup', error: 'No files found to backup' });
      return { success: false, filesUploaded: 0, message: 'No files found to backup' };
    }

    // Get the latest commit on main/master branch
    let parentCommitSha: string | undefined;
    try {
      const { data: ref } = await octokit.git.getRef({ owner: config.username, repo: config.repository, ref: 'heads/main' });
      parentCommitSha = ref.object.sha;
    } catch {
      try {
        const { data: ref } = await octokit.git.getRef({ owner: config.username, repo: config.repository, ref: 'heads/master' });
        parentCommitSha = ref.object.sha;
      } catch {
        // No existing branch — first backup
      }
    }

    // Fetch remote tree for incremental diff
    let remoteTree = new Map<string, string>();
    if (parentCommitSha) {
      report({ status: 'uploading', message: 'Fetching remote tree for incremental diff...', filesScanned: files.length, totalFiles: files.length, filesUploaded: 0 });
      remoteTree = await getRemoteTreeMap(octokit, config, parentCommitSha);
      report({ status: 'uploading', message: `Found ${files.length} local files, ${remoteTree.size} remote files. Comparing...`, filesScanned: files.length, totalFiles: files.length, filesUploaded: 0 });
    } else {
      report({ status: 'uploading', message: `First backup — uploading all ${files.length} files...`, filesScanned: files.length, totalFiles: files.length, filesUploaded: 0 });
    }

    const { treeSha, uploaded, skipped, deleted } = await createIncrementalGitTree(
      octokit, config, files, projectPath, remoteTree, sessionId, onProgress
    );

    // Skip commit if nothing changed
    if (uploaded === 0 && deleted === 0) {
      report({ status: 'complete', message: `No changes detected. All ${skipped} files are up to date.`, filesUploaded: 0, totalFiles: files.length });
      return { success: true, filesUploaded: 0, message: `No changes detected. All ${skipped} files are up to date.` };
    }

    report({ status: 'committing', message: `Creating commit... (${uploaded} changed, ${deleted} deleted, ${skipped} unchanged)`, filesUploaded: uploaded, totalFiles: files.length });

    const timestamp = new Date().toISOString();
    const parts: string[] = [];
    if (uploaded > 0) parts.push(`${uploaded} files updated`);
    if (deleted > 0) parts.push(`${deleted} files removed`);
    const commitMessage = `Backup: ${timestamp} — ${parts.join(', ')}`;

    const { data: commit } = await octokit.git.createCommit({
      owner: config.username,
      repo: config.repository,
      message: commitMessage,
      tree: treeSha,
      parents: parentCommitSha ? [parentCommitSha] : [],
    });

    report({ status: 'committing', message: 'Finalizing commit...' });

    try {
      await octokit.git.updateRef({ owner: config.username, repo: config.repository, ref: 'heads/main', sha: commit.sha });
    } catch {
      await octokit.git.createRef({ owner: config.username, repo: config.repository, ref: 'refs/heads/main', sha: commit.sha });
    }

    const summary = `Backed up to GitHub: ${uploaded} changed, ${skipped} unchanged, ${deleted} deleted`;
    report({ status: 'complete', message: summary, filesUploaded: uploaded, totalFiles: files.length });

    return { success: true, commitSha: commit.sha, filesUploaded: uploaded, message: summary };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('GitHub backup error:', err);
    report({ status: 'error', message: 'Backup failed', error: err.message || 'Unknown error' });
    return { success: false, filesUploaded: 0, message: 'Backup failed', error: err.message || 'Unknown error' };
  }
}