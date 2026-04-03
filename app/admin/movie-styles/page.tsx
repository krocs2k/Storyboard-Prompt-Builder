'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, ArrowLeft, Search, Save, RotateCcw, Image as ImageIcon, FileText, Edit3, Check, X, ToggleLeft, ToggleRight, Upload, Link2, Download, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface MovieStyleItem {
  id: string;
  name: string;
  description: string;
  style: string;
  image?: string;
  hasOverride: boolean;
  isCustom: boolean;
}

interface Settings {
  useImageAsReference: boolean;
}

export default function MovieStylesAdmin() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [styles, setStyles] = useState<MovieStyleItem[]>([]);
  const [settings, setSettings] = useState<Settings>({ useImageAsReference: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editImage, setEditImage] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingRef, setTogglingRef] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'photorealistic' | 'anime'>('all');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addStyle, setAddStyle] = useState<'Photorealistic' | 'Anime cel-shading style'>('Photorealistic');
  const [addImage, setAddImage] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && (session?.user as any)?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/movie-styles');
      const data = await res.json();
      if (data.styles) setStyles(data.styles);
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      console.error('Failed to fetch styles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user && (session.user as any).role === 'admin') {
      fetchStyles();
    }
  }, [session, fetchStyles]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleToggleReference = async () => {
    setTogglingRef(true);
    try {
      const res = await fetch('/api/admin/movie-styles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useImageAsReference: !settings.useImageAsReference }),
      });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        showSuccess(data.settings.useImageAsReference ? 'Style reference images enabled' : 'Text prompts mode enabled');
      }
    } catch (err) {
      console.error('Failed to toggle:', err);
    } finally {
      setTogglingRef(false);
    }
  };

  const startEdit = (style: MovieStyleItem) => {
    setEditingId(style.id);
    setEditImage(style.image || '');
    setEditDescription(style.description);
    setUploadError(null);
    setImageMode('url');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditImage('');
    setEditDescription('');
    setUploadError(null);
    setImageMode('url');
  };

  const downloadUrlToLocal = async (url: string, styleId: string): Promise<string> => {
    // If already a local path, return as-is
    if (url.startsWith('/images/')) return url;
    
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/admin/movie-styles/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, styleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download failed');
      return data.path;
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!editingId) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be under 10MB');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('styleId', editingId);
      const res = await fetch('/api/admin/movie-styles/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setEditImage(data.path);
      showSuccess('Image uploaded successfully');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadUrl = async () => {
    if (!editingId || !editImage) return;
    try {
      const localPath = await downloadUrlToLocal(editImage, editingId);
      setEditImage(localPath);
      showSuccess('Image downloaded & saved locally');
    } catch (err: any) {
      setUploadError(err.message || 'Download failed');
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setUploadError(null);
    try {
      // If external URL, download first
      let finalImage = editImage;
      if (editImage && !editImage.startsWith('/images/') && editImage.startsWith('http')) {
        try {
          finalImage = await downloadUrlToLocal(editImage, editingId);
        } catch (err: any) {
          setUploadError('Failed to download image: ' + (err.message || 'Unknown error'));
          setSaving(false);
          return;
        }
      }
      const res = await fetch('/api/admin/movie-styles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, image: finalImage, description: editDescription }),
      });
      if (res.ok) {
        await fetchStyles();
        showSuccess('Style updated successfully');
        cancelEdit();
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetStyle = async (id: string) => {
    try {
      const res = await fetch('/api/admin/movie-styles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resetOnly: true }),
      });
      if (res.ok) {
        await fetchStyles();
        showSuccess('Style reset to defaults');
        if (editingId === id) cancelEdit();
      }
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const handleAddStyle = async () => {
    if (!addName.trim() || !addDescription.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch('/api/admin/movie-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), description: addDescription.trim(), style: addStyle, image: addImage.trim() || undefined }),
      });
      if (res.ok) {
        await fetchStyles();
        showSuccess('Style added successfully');
        setAddName('');
        setAddDescription('');
        setAddImage('');
        setAddStyle('Photorealistic');
        setShowAddForm(false);
      } else {
        const data = await res.json();
        setUploadError(data.error || 'Failed to add style');
      }
    } catch (err) {
      console.error('Add failed:', err);
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteStyle = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch('/api/admin/movie-styles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchStyles();
        showSuccess('Style deleted');
        if (editingId === id) cancelEdit();
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = styles.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' ||
      (filterType === 'photorealistic' && s.style === 'Photorealistic') ||
      (filterType === 'anime' && s.style === 'Anime cel-shading style');
    return matchesSearch && matchesType;
  });

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || (session?.user as any)?.role !== 'admin') return null;

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
                <h1 className="text-3xl font-bold text-gray-900 mb-1">Movie Styles</h1>
                <p className="text-gray-600">Manage style images, prompts, and reference settings</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">{styles.length} styles</span>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Style
              </button>
            </div>
          </div>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="mb-6 px-4 py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {/* Add Style Form */}
        {showAddForm && (
          <div className="mb-8 bg-gray-800 border border-emerald-500/30 shadow-lg rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Add New Movie Style
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. Oppenheimer (2023)"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category *</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddStyle('Photorealistic')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addStyle === 'Photorealistic'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-gray-900 text-gray-400 border border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    Live Action
                  </button>
                  <button
                    onClick={() => setAddStyle('Anime cel-shading style')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addStyle === 'Anime cel-shading style'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'bg-gray-900 text-gray-400 border border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    Animation
                  </button>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Description / Prompt *</label>
              <textarea
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                rows={2}
                placeholder="Describe the visual style, color palette, mood, and aesthetic..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">Image URL (optional)</label>
              <input
                type="text"
                value={addImage}
                onChange={(e) => setAddImage(e.target.value)}
                placeholder="https://example.com/image.jpg or /images/..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            {addImage && (
              <div className="relative w-full max-w-xs aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4">
                <Image
                  src={addImage}
                  alt="Preview"
                  fill
                  className="object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleAddStyle}
                disabled={addSaving || !addName.trim() || !addDescription.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Style
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddName(''); setAddDescription(''); setAddImage(''); }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Settings Card */}
        <div className="mb-8 bg-gray-800 border border-gray-700 shadow-lg rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-amber-400" />
            Style Reference Mode
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-gray-300 mb-1">
                {settings.useImageAsReference
                  ? 'Images are sent as style references to the AI during image generation'
                  : 'Text descriptions are used in prompts for image generation'}
              </p>
              <p className="text-gray-500 text-sm">
                {settings.useImageAsReference
                  ? 'The movie style thumbnail will be passed to Gemini as a visual reference alongside the text prompt. This gives more visually accurate results but requires the Gemini image model.'
                  : 'The movie style description text is appended to the generation prompt. This works with all models (Imagen & Gemini).'}
              </p>
            </div>
            <button
              onClick={handleToggleReference}
              disabled={togglingRef}
              className="ml-6 flex items-center gap-3 px-5 py-3 rounded-lg border transition-all"
              style={{
                backgroundColor: settings.useImageAsReference ? 'rgba(245, 158, 11, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                borderColor: settings.useImageAsReference ? 'rgba(245, 158, 11, 0.4)' : 'rgba(107, 114, 128, 0.4)',
              }}
            >
              {togglingRef ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : settings.useImageAsReference ? (
                <ToggleRight className="w-6 h-6 text-amber-400" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-gray-400" />
              )}
              <span className={settings.useImageAsReference ? 'text-amber-300 font-medium' : 'text-gray-400'}>
                {settings.useImageAsReference ? 'Image References' : 'Text Prompts'}
              </span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search styles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'photorealistic', 'anime'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                }`}
              >
                {type === 'all' ? 'All' : type === 'photorealistic' ? 'Live Action' : 'Animation'}
              </button>
            ))}
          </div>
        </div>

        {/* Styles Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(style => (
              <div
                key={style.id}
                className={`bg-gray-800 border rounded-xl shadow-lg overflow-hidden transition-all ${
                  editingId === style.id ? 'border-amber-500/50 ring-1 ring-amber-500/20' :
                  style.hasOverride ? 'border-cyan-500/30' : 'border-gray-700'
                }`}
              >
                {editingId === style.id ? (
                  /* Edit Mode */
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-semibold">{style.name}</h3>
                      <div className="flex gap-2">
                        <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Image Source Tabs */}
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => setImageMode('url')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          imageMode === 'url' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Link2 className="w-3 h-3" /> Paste URL
                      </button>
                      <button
                        onClick={() => setImageMode('upload')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          imageMode === 'upload' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Upload className="w-3 h-3" /> Upload File
                      </button>
                    </div>

                    {imageMode === 'url' ? (
                      /* URL Input Mode */
                      <div className="mb-3">
                        <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editImage}
                            onChange={(e) => setEditImage(e.target.value)}
                            placeholder="https://example.com/image.jpg or /images/..."
                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                          />
                          {editImage && editImage.startsWith('http') && (
                            <button
                              onClick={handleDownloadUrl}
                              disabled={uploading}
                              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                              title="Download & save image locally"
                            >
                              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              Save Local
                            </button>
                          )}
                        </div>
                        {editImage.startsWith('/images/') && (
                          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Stored locally
                          </p>
                        )}
                      </div>
                    ) : (
                      /* File Upload Mode */
                      <div className="mb-3">
                        <label className="block text-sm text-gray-400 mb-1">Upload Image</label>
                        <div
                          className="relative border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-amber-500/50 transition-colors cursor-pointer"
                          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500'); }}
                          onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-amber-500'); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('border-amber-500');
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleFileUpload(file);
                            };
                            input.click();
                          }}
                        >
                          {uploading ? (
                            <div className="flex flex-col items-center gap-2 py-2">
                              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                              <span className="text-xs text-gray-400">Uploading...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 py-2">
                              <Upload className="w-6 h-6 text-gray-500" />
                              <span className="text-xs text-gray-400">
                                Click or drag & drop an image here
                              </span>
                              <span className="text-xs text-gray-600">Max 10MB · JPG, PNG, WebP</span>
                            </div>
                          )}
                        </div>
                        {editImage.startsWith('/images/') && (
                          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Stored locally: {editImage}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Upload Error */}
                    {uploadError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {uploadError}
                      </div>
                    )}

                    {/* Image Preview */}
                    {editImage && (
                      <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden mb-3">
                        <Image
                          src={editImage}
                          alt={style.name}
                          fill
                          className="object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}

                    {/* Description */}
                    <label className="block text-sm text-gray-400 mb-1">Description / Prompt</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm mb-4 focus:outline-none focus:border-amber-500/50 resize-none"
                    />

                    {/* Save / Reset */}
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving || uploading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving && editImage.startsWith('http') ? 'Downloading & Saving...' : 'Save Changes'}
                      </button>
                      {style.hasOverride && (
                        <button
                          onClick={() => resetStyle(style.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Reset
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* View Mode */
                  <>
                    <div className="relative aspect-video bg-gray-900">
                      {style.image ? (
                        <Image
                          src={style.image}
                          alt={style.name}
                          fill
                          className="object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                      {style.hasOverride && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-cyan-500/80 text-white text-xs rounded-full">
                          Customized
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full">
                        {style.style === 'Photorealistic' ? 'Live Action' : 'Animation'}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-semibold text-sm truncate flex-1">
                          {style.name}
                          {style.isCustom && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-normal">Custom</span>
                          )}
                        </h3>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => startEdit(style)}
                            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                            title="Edit style"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirmId === style.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDeleteStyle(style.id)}
                                disabled={deletingId === style.id}
                                className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                                title="Confirm delete"
                              >
                                {deletingId === style.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(style.id)}
                              className="p-1.5 rounded-lg bg-gray-700 hover:bg-red-600/80 text-gray-500 hover:text-gray-900 transition-colors"
                              title="Delete style"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{style.description}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No styles match your search
          </div>
        )}
      </div>
    </div>
  );
}
