'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
  Loader2, ArrowLeft, Download, Upload, Image as ImageIcon,
  AlertCircle, CheckCircle, HardDrive, FileArchive, Trash2,
  Shrink, Zap
} from 'lucide-react';
import Link from 'next/link';
import JSZip from 'jszip';

interface ResizePreview {
  totalFiles: number;
  alreadyOptimized: number;
  toProcess: number;
  currentSizeMB: number;
  targetSize: number;
  quality: number;
}

interface ResizeResult {
  totalFiles: number;
  alreadyOptimized: number;
  processed: number;
  failed: number;
  savedMB: number;
  originalSizeMB: number;
  newSizeMB: number;
  targetSize: number;
  quality: number;
  errors?: string[];
}

export default function ImagesAdminPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ fileCount: number; totalSizeMB: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize worker state
  const [resizing, setResizing] = useState(false);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const [resizeResult, setResizeResult] = useState<ResizeResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && session?.user?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/images/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch image stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.role === 'admin') fetchStats();
  }, [session]);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/images/export');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyshot-images-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Images exported successfully. Check your downloads.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const [importProgress, setImportProgress] = useState('');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setMessage({ type: 'error', text: 'Please select a ZIP file.' });
      return;
    }

    if (!confirm(
      `Import "${file.name}"?\n\nThis will DELETE all existing dropdown images and replace them with the contents of this ZIP file. This action cannot be undone.\n\nContinue?`
    )) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    setMessage(null);
    setImportProgress('Reading ZIP file...');

    try {
      // Extract ZIP client-side
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Collect image entries
      const entries: Array<{ path: string; zipObj: JSZip.JSZipObject }> = [];
      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        if (relativePath === 'manifest.json') return;
        if (relativePath.startsWith('images/')) {
          const subPath = relativePath.slice('images/'.length);
          if (subPath) entries.push({ path: subPath, zipObj: zipEntry });
        }
      });

      if (entries.length === 0) {
        throw new Error('No image files found in ZIP. Expected files in an "images/" folder.');
      }

      // Determine subdirs to clear
      const subdirs = new Set<string>();
      for (const { path: p } of entries) {
        const parts = p.split('/');
        if (parts.length > 1) subdirs.add(parts[0]);
      }
      // If flat structure, clear data/
      const subdirsStr = subdirs.size > 0 ? [...subdirs].join(',') : 'data';

      // Build batches (~3 MB each to stay under proxy limits)
      const MAX_BATCH_BYTES = 3 * 1024 * 1024;
      const batches: Array<Array<{ path: string; blob: Blob }>> = [];
      let currentBatch: Array<{ path: string; blob: Blob }> = [];
      let currentSize = 0;

      setImportProgress(`Extracting ${entries.length} files...`);

      for (let i = 0; i < entries.length; i++) {
        const data = await entries[i].zipObj.async('blob');
        let destPath = entries[i].path;
        // Flat ZIP → prefix with data/
        if (subdirs.size === 0 && !destPath.includes('/')) {
          destPath = `data/${destPath}`;
        }
        currentBatch.push({ path: destPath, blob: data });
        currentSize += data.size;

        if (currentSize >= MAX_BATCH_BYTES || i === entries.length - 1) {
          batches.push(currentBatch);
          currentBatch = [];
          currentSize = 0;
        }
      }

      // Upload batches
      let totalImported = 0;
      let totalResized = 0;

      for (let b = 0; b < batches.length; b++) {
        const batch = batches[b];
        setImportProgress(`Uploading batch ${b + 1}/${batches.length} (${batch.length} files)...`);

        const formData = new FormData();
        formData.append('action', b === 0 ? 'init' : 'append');
        if (b === 0) formData.append('subdirs', subdirsStr);

        for (const item of batch) {
          formData.append('files[]', item.blob, item.path.split('/').pop() || 'image');
          formData.append('paths[]', item.path);
        }

        const res = await fetch('/api/admin/images/import', {
          method: 'POST',
          body: formData,
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(`Server error on batch ${b + 1} (HTTP ${res.status}). Try re-importing.`);
        }

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || `Batch ${b + 1} failed`);
        }
        totalImported += data.imported || 0;
        totalResized += data.resized || 0;
      }

      const subdirList = subdirs.size > 0 ? ` across ${subdirs.size} directories (${[...subdirs].join(', ')})` : '';
      setMessage({
        type: 'success',
        text: `Successfully imported ${totalImported} images${subdirList} (${totalResized} auto-resized to 384×384). They are now active in the system.`
      });
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
      setImportProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResizePreview = async () => {
    setPreviewLoading(true);
    setResizeResult(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/images/resize?dryRun=true&size=384&quality=80', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResizePreview(data as ResizePreview);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to analyze images' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleResize = async () => {
    if (!confirm(
      'Resize all oversized images to 384×384?\n\nThis will overwrite the original files in-place. Make sure you have exported a backup first.\n\nContinue?'
    )) return;

    setResizing(true);
    setMessage(null);
    setResizeResult(null);
    try {
      const res = await fetch('/api/admin/images/resize?size=384&quality=80', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResizeResult(data as ResizeResult);
      setResizePreview(null);
      setMessage({
        type: 'success',
        text: `Resized ${data.processed} images. Saved ${data.savedMB} MB (${data.originalSizeMB} MB → ${data.newSizeMB} MB).`
      });
      fetchStats();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Resize failed' });
    } finally {
      setResizing(false);
    }
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || session?.user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen ">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dropdown Image Library</h1>
          <p className="text-gray-500">Export and import the thumbnail images used in selection dropdowns</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                Current Library
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{stats?.fileCount ?? 0}</div>
                  <div className="text-gray-400 text-sm mt-1">Image Files</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{stats?.totalSizeMB ?? 0} MB</div>
                  <div className="text-gray-400 text-sm mt-1">Total Size</div>
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                These images are used as thumbnails in the selection modals (Image Types, Shot Types, Lighting, Cameras, Lenses, Film Stocks, Photographers, Movies, Filters, Focal Lengths).
              </p>
            </div>

            {/* Export */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                Export Images
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Download all dropdown images as a ZIP archive. Includes a manifest.json mapping each image to its category and item.
              </p>
              <button
                onClick={handleExport}
                disabled={exporting || !stats?.fileCount}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                {exporting ? 'Creating ZIP...' : `Export ${stats?.fileCount ?? 0} Images as ZIP`}
              </button>
            </div>

            {/* Import */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-400" />
                Import Images
              </h2>
              <p className="text-gray-400 text-sm mb-2">
                Upload a ZIP file to replace all existing dropdown images. The ZIP should contain an <code className="text-amber-400 bg-gray-900 px-1 rounded">images/</code> folder with the image files.
              </p>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Trash2 className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400/80 text-xs"><strong>Warning:</strong> Importing will delete all existing images first, then replace them with the ZIP contents. Make sure to export a backup before importing.</p>
                </div>
              </div>
              <label className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium cursor-pointer"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? (importProgress || 'Importing...') : 'Select ZIP to Import'}
                </button>
              </label>
              {importing && importProgress && (
                <p className="text-xs text-gray-400 mt-1">{importProgress}</p>
              )}
            </div>

            {/* Resize Worker */}
            <div className="bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Shrink className="w-5 h-5 text-violet-400" />
                Optimize Images
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Resize all oversized images to <strong className="text-white">384×384px</strong> thumbnails to reduce storage size and improve load times. 
                Images already at or below this size are skipped.
              </p>

              {/* Dry-run preview */}
              {resizePreview && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-4 mb-4">
                  <h3 className="text-violet-400 font-medium text-sm mb-2 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> Analysis Result
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">{resizePreview.toProcess}</div>
                      <div className="text-gray-400 text-xs mt-0.5">Need Resizing</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">{resizePreview.alreadyOptimized}</div>
                      <div className="text-gray-400 text-xs mt-0.5">Already Optimal</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">{resizePreview.currentSizeMB} MB</div>
                      <div className="text-gray-400 text-xs mt-0.5">Current Size</div>
                    </div>
                  </div>
                  {resizePreview.toProcess > 0 && (
                    <button
                      onClick={handleResize}
                      disabled={resizing}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
                    >
                      {resizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shrink className="w-4 h-4" />}
                      {resizing ? 'Resizing...' : `Resize ${resizePreview.toProcess} Images Now`}
                    </button>
                  )}
                  {resizePreview.toProcess === 0 && (
                    <p className="mt-3 text-green-400 text-sm text-center">✓ All images are already optimized!</p>
                  )}
                </div>
              )}

              {/* Resize result */}
              {resizeResult && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
                  <h3 className="text-green-400 font-medium text-sm mb-2">Resize Complete</h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">{resizeResult.processed}</div>
                      <div className="text-gray-400 text-xs mt-0.5">Resized</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">{resizeResult.savedMB} MB</div>
                      <div className="text-gray-400 text-xs mt-0.5">Saved</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-white">{resizeResult.newSizeMB} MB</div>
                      <div className="text-gray-400 text-xs mt-0.5">New Total</div>
                    </div>
                  </div>
                  {resizeResult.failed > 0 && (
                    <p className="text-amber-400 text-xs mt-2">{resizeResult.failed} file(s) failed to resize.</p>
                  )}
                </div>
              )}

              {!resizePreview && !resizeResult && (
                <button
                  onClick={handleResizePreview}
                  disabled={previewLoading || !stats?.fileCount}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors font-medium"
                >
                  {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {previewLoading ? 'Analyzing...' : 'Analyze & Preview'}
                </button>
              )}

              {resizeResult && (
                <button
                  onClick={() => { setResizeResult(null); handleResizePreview(); }}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Re-analyze
                </button>
              )}
            </div>

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <span>{message.text}</span>
              </div>
            )}

            {/* Info */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5">
              <h3 className="text-cyan-400 font-medium mb-2">ZIP File Format</h3>
              <div className="text-gray-400 text-sm space-y-1">
                <p>The exported ZIP contains:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><code className="text-cyan-400 bg-gray-900 px-1 rounded">manifest.json</code> — Maps each image file to its category and item ID</li>
                  <li><code className="text-cyan-400 bg-gray-900 px-1 rounded">images/</code> — All image files (PNG, JPG, etc.)</li>
                </ul>
                <p className="text-gray-500 text-xs mt-2">When importing, the filenames must match those referenced in the data files (lib/data/*.ts). The easiest approach is to export first, modify the images, then re-import.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
