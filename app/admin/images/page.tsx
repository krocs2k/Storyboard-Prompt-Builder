'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
  Loader2, ArrowLeft, Download, Upload, Image as ImageIcon,
  AlertCircle, CheckCircle, HardDrive, FileArchive, Trash2,
  Shrink, Zap, Link2, FolderOpen, BarChart3, Wand2
} from 'lucide-react';
import Link from 'next/link';
import JSZip from 'jszip';

interface CategoryStats {
  label: string;
  section: string;
  stats: {
    total: number;
    withImage: number;
    localFound: number;
    missing: number;
    externalCount: number;
  };
}

interface SubdirStats {
  fileCount: number;
  sizeMB: number;
}

interface StatsData {
  fileCount: number;
  totalSizeMB: number;
  categories: Record<string, CategoryStats>;
  subdirs: Record<string, SubdirStats>;
}

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

interface AssociateResult {
  totalStyles: number;
  summary: { alreadyCorrectCount: number; toAssociateCount: number; noMatchCount: number };
  toAssociate: Array<{ styleId: string; styleName: string; currentImage: string; newImage: string; matchType: string }>;
  alreadyCorrect: Array<{ styleId: string; styleName: string; image: string }>;
  noMatch: Array<{ styleId: string; styleName: string; currentImage: string }>;
  message?: string;
}

export default function ImagesAdminPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resize state
  const [resizing, setResizing] = useState(false);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const [resizeResult, setResizeResult] = useState<ResizeResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Associate state
  const [associating, setAssociating] = useState(false);
  const [associatePreview, setAssociatePreview] = useState<AssociateResult | null>(null);
  const [associateLoading, setAssociateLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && (session?.user as any)?.role !== 'admin') router.replace('/');
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
    if (session?.user && (session.user as any).role === 'admin') fetchStats();
  }, [session]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/images/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `images-export-${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('success', 'Images exported successfully');
    } catch (err: any) {
      showMsg('error', err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/images/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      showMsg('success', `Imported ${data.imported} images (${data.skipped} skipped, ${data.resized} auto-resized)`);
      fetchStats();
    } catch (err: any) {
      showMsg('error', err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResizePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/admin/images/resize?preview=true');
      const data = await res.json();
      setResizePreview(data);
    } catch (err) {
      showMsg('error', 'Failed to preview resize');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleResize = async () => {
    setResizing(true);
    try {
      const res = await fetch('/api/admin/images/resize', { method: 'POST' });
      const data = await res.json();
      setResizeResult(data);
      setResizePreview(null);
      showMsg('success', `Resized ${data.processed} images, saved ${data.savedMB}MB`);
      fetchStats();
    } catch (err) {
      showMsg('error', 'Resize failed');
    } finally {
      setResizing(false);
    }
  };

  // Auto-associate movie style images
  const handleAssociatePreview = async () => {
    setAssociateLoading(true);
    try {
      const res = await fetch('/api/admin/images/associate');
      const data = await res.json();
      setAssociatePreview(data);
    } catch (err) {
      showMsg('error', 'Failed to preview associations');
    } finally {
      setAssociateLoading(false);
    }
  };

  const handleAssociate = async () => {
    setAssociating(true);
    try {
      const res = await fetch('/api/admin/images/associate', { method: 'POST' });
      const data = await res.json();
      showMsg('success', data.message || `Associated ${data.summary?.toAssociateCount || 0} styles`);
      setAssociatePreview(null);
      fetchStats();
    } catch (err) {
      showMsg('error', 'Association failed');
    } finally {
      setAssociating(false);
    }
  };

  const getCategoryHealth = (cat: CategoryStats) => {
    const { total, withImage, localFound, externalCount } = cat.stats;
    const covered = localFound + externalCount;
    if (total === 0) return { color: 'gray', label: 'Empty' };
    const pct = covered / total;
    if (pct >= 0.95) return { color: 'emerald', label: 'Complete' };
    if (pct >= 0.5) return { color: 'amber', label: 'Partial' };
    return { color: 'red', label: 'Missing' };
  };

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || (session?.user as any)?.role !== 'admin') return null;

  const sectionOrder = ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Section 5'];

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Image Management</h1>
                <p className="text-gray-600">Manage images across all prompt builder categories</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : stats ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Total Images on Disk</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.fileCount}</p>
                <p className="text-gray-500 text-xs mt-1">{stats.totalSizeMB} MB total</p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <FolderOpen className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Directories</span>
                </div>
                <p className="text-3xl font-bold text-white">{Object.keys(stats.subdirs).length}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {Object.entries(stats.subdirs).map(([name, s]) => `${name}: ${s.fileCount}`).join(', ')}
                </p>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-gray-400 text-sm">Categories</span>
                </div>
                <p className="text-3xl font-bold text-white">{Object.keys(stats.categories).length}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {Object.values(stats.categories).reduce((a, c) => a + c.stats.total, 0)} total items
                </p>
              </div>
            </div>

            {/* Per-Category Cards by Section */}
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              Category Breakdown
            </h2>

            {sectionOrder.map(section => {
              const cats = Object.entries(stats.categories).filter(([, c]) => c.section === section);
              if (cats.length === 0) return null;
              return (
                <div key={section} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">{section}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {cats.map(([key, cat]) => {
                      const health = getCategoryHealth(cat);
                      const { total, withImage, localFound, missing, externalCount } = cat.stats;
                      const covered = localFound + externalCount;
                      const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
                      const manageHref = key === 'movie-styles' ? '/admin/movie-styles' : `/admin/categories/${key}`;
                      return (
                        <Link key={key} href={manageHref} className="block">
                          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all cursor-pointer group">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-white font-semibold text-sm group-hover:text-amber-300 transition-colors">{cat.label}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                health.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                                health.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                                health.color === 'red' ? 'bg-red-500/20 text-red-400' :
                                'bg-gray-600/20 text-gray-500'
                              }`}>{health.label}</span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 bg-gray-700 rounded-full mb-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  health.color === 'emerald' ? 'bg-emerald-500' :
                                  health.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="text-gray-500">Total items</div>
                              <div className="text-gray-300 text-right">{total}</div>
                              <div className="text-gray-500">With image field</div>
                              <div className="text-gray-300 text-right">{withImage}</div>
                              <div className="text-gray-500">Local files found</div>
                              <div className="text-emerald-400 text-right">{localFound}</div>
                              {externalCount > 0 && (
                                <>
                                  <div className="text-gray-500">External URLs</div>
                                  <div className="text-cyan-400 text-right">{externalCount}</div>
                                </>
                              )}
                              {missing > 0 && (
                                <>
                                  <div className="text-gray-500">Missing files</div>
                                  <div className="text-red-400 text-right">{missing}</div>
                                </>
                              )}
                            </div>

                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <span className="text-xs text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
                                <Wand2 className="w-3 h-3" /> Manage {cat.label} →
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Auto-Associate Movie Styles */}
            <div className="mt-8 bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-cyan-400" />
                Auto-Associate Movie Style Images
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Scans the <code className="text-cyan-400/80 bg-gray-900 px-1.5 py-0.5 rounded text-xs">/images/movie-styles/</code> directory
                and matches image filenames to movie style IDs. Creates database overrides so styles show their correct images.
              </p>

              {associatePreview && (
                <div className="mb-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                  <div className="grid grid-cols-3 gap-4 text-center mb-4">
                    <div>
                      <div className="text-2xl font-bold text-emerald-400">{associatePreview.summary.alreadyCorrectCount}</div>
                      <div className="text-xs text-gray-500">Already Correct</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-400">{associatePreview.summary.toAssociateCount}</div>
                      <div className="text-xs text-gray-500">To Associate</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-500">{associatePreview.summary.noMatchCount}</div>
                      <div className="text-xs text-gray-500">No Match</div>
                    </div>
                  </div>
                  {associatePreview.toAssociate.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {associatePreview.toAssociate.map(a => (
                        <div key={a.styleId} className="flex items-center justify-between text-xs py-1 px-2 bg-gray-800 rounded">
                          <span className="text-white">{a.styleName}</span>
                          <span className="text-gray-500">{a.matchType}</span>
                          <span className="text-cyan-400 truncate max-w-[200px]">{a.newImage}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAssociatePreview}
                  disabled={associateLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {associateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                  Preview
                </button>
                <button
                  onClick={handleAssociate}
                  disabled={associating || !!(associatePreview && associatePreview.summary.toAssociateCount === 0)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {associating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Associate Images
                </button>
              </div>
            </div>

            {/* Import / Export / Resize */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Export */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Download className="w-4 h-4 text-amber-400" />
                  Export Images
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Download all images as a ZIP archive for backup or transfer.
                </p>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                  {exporting ? 'Exporting...' : 'Export ZIP'}
                </button>
              </div>

              {/* Import */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Import Images
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Upload a ZIP of images. Matching directory structure preserved.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleImport}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importing...' : 'Import ZIP'}
                </button>
              </div>

              {/* Resize */}
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Shrink className="w-4 h-4 text-purple-400" />
                  Optimize Images
                </h3>
                <p className="text-gray-500 text-xs mb-4">
                  Resize large images to save disk space and improve load times.
                </p>
                {resizePreview && (
                  <div className="mb-3 p-3 bg-gray-900 rounded-lg text-xs">
                    <div className="flex justify-between text-gray-400 mb-1">
                      <span>To process</span>
                      <span className="text-amber-400">{resizePreview.toProcess}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Already optimized</span>
                      <span className="text-emerald-400">{resizePreview.alreadyOptimized}</span>
                    </div>
                  </div>
                )}
                {resizeResult && (
                  <div className="mb-3 p-3 bg-gray-900 rounded-lg text-xs">
                    <div className="flex justify-between text-gray-400 mb-1">
                      <span>Processed</span>
                      <span className="text-emerald-400">{resizeResult.processed}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Saved</span>
                      <span className="text-emerald-400">{resizeResult.savedMB} MB</span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleResizePreview}
                    disabled={previewLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                    Preview
                  </button>
                  <button
                    onClick={handleResize}
                    disabled={resizing}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {resizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shrink className="w-3.5 h-3.5" />}
                    Resize
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-500">
            Failed to load image statistics
          </div>
        )}
      </div>
    </div>
  );
}
