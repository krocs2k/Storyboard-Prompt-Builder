'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, ArrowLeft, Search, Save, RotateCcw, Image as ImageIcon,
  Edit3, Check, X, Upload, Link2, Download, AlertCircle, Sparkles,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';


interface CategoryItemData {
  id: string;
  name: string;
  description?: string;
  style?: string;
  image?: string;
  hasOverride: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  'image-types': 'Image Types',
  'movie-styles': 'Movie Styles',
  'shot-types': 'Shot Types',
  'lighting-sources': 'Lighting Sources',
  'camera-bodies': 'Camera Bodies',
  'focal-lengths': 'Focal Lengths',
  'lens-types': 'Lens Types',
  'film-stocks': 'Film Stocks',
  'photographer-styles': 'Photographer Styles',
  'filter-effects': 'Filter Effects',
};

export default function CategoryAdminPage() {
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status || 'loading';
  const router = useRouter();
  const params = useParams();
  const category = params?.category as string;
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<CategoryItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editImage, setEditImage] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [overrideCount, setOverrideCount] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === 'unauthenticated') router.replace('/login');
    else if (status === 'authenticated' && (session?.user as any)?.role !== 'admin') router.replace('/');
  }, [status, session, router, mounted]);

  const fetchItems = useCallback(async () => {
    if (!category) return;
    try {
      const res = await fetch(`/api/admin/categories/${category}`);
      const data = await res.json();
      if (data.items) setItems(data.items);
      if (data.overrideCount !== undefined) setOverrideCount(data.overrideCount);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (session?.user && (session.user as any).role === 'admin' && category) {
      fetchItems();
    }
  }, [session, fetchItems, category]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const startEdit = (item: CategoryItemData) => {
    setEditingId(item.id);
    setEditImage(item.image || '');
    setEditDescription(item.description || '');
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
      formData.append('itemId', editingId);
      const res = await fetch(`/api/admin/categories/${category}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setEditImage(data.path);
      showSuccess('Image uploaded');
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadUrl = async () => {
    if (!editingId || !editImage || !editImage.startsWith('http')) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/admin/categories/${category}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editImage, itemId: editingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download failed');
      setEditImage(data.path);
      showSuccess('Image downloaded & saved locally');
    } catch (err: any) {
      setUploadError(err.message || 'Download failed');
    } finally {
      setUploading(false);
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
          const dlRes = await fetch(`/api/admin/categories/${category}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: editImage, itemId: editingId }),
          });
          const dlData = await dlRes.json();
          if (!dlRes.ok) throw new Error(dlData.error);
          finalImage = dlData.path;
        } catch (err: any) {
          setUploadError('Failed to download image: ' + (err.message || ''));
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/admin/categories/${category}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, image: finalImage, description: editDescription }),
      });
      if (res.ok) {
        await fetchItems();
        showSuccess('Item updated');
        cancelEdit();
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetItem = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/categories/${category}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchItems();
        showSuccess('Reset to defaults');
        if (editingId === id) cancelEdit();
      }
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  const handleGenerateImage = async (item: CategoryItemData) => {
    setGeneratingId(item.id);
    setUploadError(null);
    try {
      const genPrompt = `A cinematic still frame representing "${item.name}". ${item.description || ''}. Highly detailed, professional cinematography, 16:9 aspect ratio.`;
      const genRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt, aspectRatio: '16:9' }),
      });
      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || 'Image generation failed');
      }
      const genData = await genRes.json();
      if (!genData.success || !genData.image?.base64) throw new Error('No image returned');

      // Upload
      const ext = genData.image.mimeType?.includes('png') ? 'png' : 'jpg';
      const byteChars = atob(genData.image.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: genData.image.mimeType || 'image/png' });
      const file = new File([blob], `${item.id}.${ext}`, { type: blob.type });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('itemId', item.id);
      const uploadRes = await fetch(`/api/admin/categories/${category}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      // Save override
      const saveRes = await fetch(`/api/admin/categories/${category}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, image: uploadData.path }),
      });
      if (!saveRes.ok) throw new Error('Save failed');

      await fetchItems();
      showSuccess(`AI image generated for "${item.name}"`);
    } catch (err: any) {
      console.error('Generate failed:', err);
      setUploadError(err.message || 'Generation failed');
    } finally {
      setGeneratingId(null);
    }
  };

  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (status !== 'authenticated' || (session?.user as any)?.role !== 'admin') return null;

  const label = CATEGORY_LABELS[category] || category;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/images" className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <ArrowLeft className="w-5 h-5 text-white" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{label}</h1>
                <p className="text-gray-600">Manage images and descriptions for {label.toLowerCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm">{items.length} items</span>
              {overrideCount > 0 && (
                <span className="text-cyan-400 text-sm">{overrideCount} customized</span>
              )}
            </div>
          </div>
        </div>

        {/* Success/Error messages */}
        {successMsg && (
          <div className="mb-6 px-4 py-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> {successMsg}
          </div>
        )}
        {uploadError && !editingId && (
          <div className="mb-6 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {uploadError}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Items Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(item => (
              <div
                key={item.id}
                className={`bg-gray-800 border rounded-xl shadow-lg overflow-hidden transition-all ${
                  editingId === item.id ? 'border-amber-500/50 ring-1 ring-amber-500/20' :
                  item.hasOverride ? 'border-cyan-500/30' : 'border-gray-700'
                }`}
              >
                {editingId === item.id ? (
                  /* Edit Mode */
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-semibold text-sm">{item.name}</h3>
                      <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
                        <X className="w-4 h-4" />
                      </button>
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
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                      <button
                        onClick={() => handleGenerateImage(item)}
                        disabled={generatingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-purple-600/80 hover:bg-purple-500 text-white disabled:opacity-60"
                      >
                        {generatingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generatingId === item.id ? 'Generating...' : 'AI Generate'}
                      </button>
                    </div>

                    {imageMode === 'url' ? (
                      <div className="mb-3">
                        <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editImage}
                            onChange={(e) => setEditImage(e.target.value)}
                            placeholder="https://... or /images/..."
                            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                          />
                          {editImage && editImage.startsWith('http') && (
                            <button
                              onClick={handleDownloadUrl}
                              disabled={uploading}
                              className="flex items-center gap-1.5 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
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
                            input.onchange = (ev) => {
                              const file = (ev.target as HTMLInputElement).files?.[0];
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
                              <span className="text-xs text-gray-400">Click or drag & drop</span>
                              <span className="text-xs text-gray-600">Max 10MB</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {uploadError && (
                      <div className="flex items-center gap-2 text-red-400 text-xs mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {uploadError}
                      </div>
                    )}

                    {editImage && (
                      <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden mb-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={editImage}
                          alt={item.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}

                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm mb-4 focus:outline-none focus:border-amber-500/50 resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={saving || uploading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                      </button>
                      {item.hasOverride && (
                        <button
                          onClick={() => resetItem(item.id)}
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
                      {item.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.image}
                          alt={item.name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            const retries = Number(img.dataset.retries || '0');
                            if (retries < 2) {
                              img.dataset.retries = String(retries + 1);
                              setTimeout(() => { img.src = item.image + (item.image!.includes('?') ? '&' : '?') + '_r=' + retries; }, 800 * (retries + 1));
                            }
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                      {item.hasOverride && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-cyan-500/80 text-white text-xs rounded-full">
                          Customized
                        </div>
                      )}
                      {item.image?.startsWith('http') && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded-full flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5" /> External
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-semibold text-sm truncate flex-1">{item.name}</h3>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleGenerateImage(item)}
                            disabled={generatingId === item.id}
                            className="p-1.5 rounded-lg bg-gray-700 hover:bg-purple-600 text-gray-400 hover:text-white transition-colors disabled:opacity-60"
                            title="Generate AI image"
                          >
                            {generatingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">{item.description}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            No items match your search
          </div>
        )}
      </div>
    </div>
  );
}
