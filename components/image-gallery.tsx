'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Download, Trash2, Loader2, Maximize2, X, ZoomIn,
  ChevronLeft, ChevronRight, ImageIcon, Sparkles
} from 'lucide-react';
import { authFetch } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface GalleryImageItem {
  id: string;
  projectId: string;
  imageKey: string;
  prompt: string;
  label: string;
  imagePath: string;
  fileName: string;
  aspectRatio: string;
  width: number;
  height: number;
  createdAt: string;
  // For unsaved (in-memory only) images
  base64?: string;
  mimeType?: string;
}

interface ImageGalleryProps {
  projectId: string | null;
  images: GalleryImageItem[];
  onImagesChange: (images: GalleryImageItem[]) => void;
}

export default function ImageGallery({ projectId, images, onImagesChange }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [upscalingId, setUpscalingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get image src - either from API (saved) or base64 (unsaved)
  const getImageSrc = useCallback((img: GalleryImageItem) => {
    if (img.base64) {
      return `data:${img.mimeType || 'image/png'};base64,${img.base64}`;
    }
    return `/api/images?path=${encodeURIComponent(img.imagePath)}`;
  }, []);

  // Download image
  const downloadImage = useCallback((img: GalleryImageItem) => {
    const a = document.createElement('a');
    if (img.base64) {
      a.href = `data:${img.mimeType || 'image/png'};base64,${img.base64}`;
      a.download = img.label ? `${img.label.replace(/[^a-zA-Z0-9]/g, '_')}.png` : `gallery_image.png`;
    } else {
      a.href = `/api/images?path=${encodeURIComponent(img.imagePath)}`;
      a.download = img.fileName;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Delete image
  const deleteImage = useCallback(async (img: GalleryImageItem, index: number) => {
    if (img.id && !img.base64) {
      // Saved image - delete from DB
      setDeletingId(img.id);
      try {
        const res = await authFetch('/api/gallery-images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: img.id }),
        });
        const data = await res.json();
        if (data.success) {
          onImagesChange(images.filter((_, i) => i !== index));
        }
      } catch (err) {
        console.error('Failed to delete image:', err);
      } finally {
        setDeletingId(null);
      }
    } else {
      // Unsaved image - just remove from state
      onImagesChange(images.filter((_, i) => i !== index));
    }
    // Close lightbox if open on this image
    if (lightboxIndex === index) setLightboxIndex(null);
  }, [images, onImagesChange, lightboxIndex]);

  // Upscale 4x
  const upscaleImage = useCallback(async (img: GalleryImageItem, index: number) => {
    if (!img.id || img.base64) {
      // Can't upscale unsaved images
      alert('Please save the project first to upscale images.');
      return;
    }

    setUpscalingId(img.id);
    try {
      const res = await authFetch('/api/gallery-images/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: img.id }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        const updated = [...images];
        updated[index] = { ...updated[index], ...data.image };
        onImagesChange(updated);
      } else {
        alert(data.error || 'Upscale failed');
      }
    } catch (err) {
      console.error('Upscale failed:', err);
      alert('Upscale failed. Please try again.');
    } finally {
      setUpscalingId(null);
    }
  }, [images, onImagesChange]);

  // Lightbox navigation
  const lightboxNav = (direction: number) => {
    if (lightboxIndex === null) return;
    const newIdx = lightboxIndex + direction;
    if (newIdx >= 0 && newIdx < images.length) {
      setLightboxIndex(newIdx);
    }
  };

  // Keyboard nav for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') lightboxNav(-1);
      if (e.key === 'ArrowRight') lightboxNav(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (images.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <ImageIcon className="text-purple-400" size={20} />
          Image Gallery
          <span className="text-slate-400 text-sm font-normal">({images.length} image{images.length !== 1 ? 's' : ''})</span>
        </h3>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <AnimatePresence mode="popLayout">
          {images.map((img, index) => (
            <motion.div
              key={img.id || `unsaved-${index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700/50 hover:border-purple-500/40 transition-colors"
            >
              {/* Image */}
              <div className="aspect-video relative cursor-pointer" onClick={() => setLightboxIndex(index)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageSrc(img)}
                  alt={img.label || img.prompt?.slice(0, 60) || 'Generated image'}
                  className="w-full h-full object-cover"
                />

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIndex(index); }}
                    className="p-2 bg-black/60 rounded-lg text-white hover:bg-purple-600/80 transition-colors"
                    title="Full screen"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); upscaleImage(img, index); }}
                    disabled={upscalingId === img.id || !!img.base64}
                    className="p-2 bg-black/60 rounded-lg text-white hover:bg-cyan-600/80 disabled:opacity-40 transition-colors"
                    title={img.base64 ? 'Save project first to upscale' : 'Upscale 4x'}
                  >
                    {upscalingId === img.id ? <Loader2 size={16} className="animate-spin" /> : <ZoomIn size={16} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadImage(img); }}
                    className="p-2 bg-black/60 rounded-lg text-white hover:bg-green-600/80 transition-colors"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteImage(img, index); }}
                    disabled={deletingId === img.id}
                    className="p-2 bg-black/60 rounded-lg text-white hover:bg-red-600/80 transition-colors"
                    title="Delete"
                  >
                    {deletingId === img.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>

                {/* Unsaved indicator */}
                {img.base64 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-500/80 text-white text-[10px] font-medium rounded">
                    Unsaved
                  </div>
                )}

                {/* Dimensions badge */}
                {img.width > 0 && (
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/60 text-slate-300 text-[10px] rounded">
                    {img.width}×{img.height}
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="p-2">
                <p className="text-slate-300 text-xs truncate" title={img.label || img.prompt}>
                  {img.label || img.prompt?.slice(0, 50) || 'Generated image'}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && images[lightboxIndex] && (() => {
          const img = images[lightboxIndex];
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
              onClick={() => setLightboxIndex(null)}
            >
              <div className="max-w-[95vw] max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-3 text-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{img.label || 'Generated Image'}</p>
                    {img.width > 0 && <p className="text-slate-400 text-xs">{img.width} × {img.height}px</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => upscaleImage(img, lightboxIndex)}
                      disabled={upscalingId === img.id || !!img.base64}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm transition-colors"
                      title={img.base64 ? 'Save project first' : 'Upscale 4x'}
                    >
                      {upscalingId === img.id ? <Loader2 size={14} className="animate-spin" /> : <ZoomIn size={14} />}
                      Upscale 4x
                    </button>
                    <button
                      onClick={() => downloadImage(img)}
                      className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                      title="Download"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => { deleteImage(img, lightboxIndex); }}
                      className="p-2 bg-red-600/40 rounded-lg hover:bg-red-600/70 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() => setLightboxIndex(null)}
                      className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Image */}
                <div className="flex-1 flex items-center justify-center relative min-h-0 px-4">
                  {lightboxIndex > 0 && (
                    <button
                      onClick={() => lightboxNav(-1)}
                      className="absolute left-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 z-10"
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageSrc(img)}
                    alt={img.label || 'Gallery image'}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg"
                  />

                  {lightboxIndex < images.length - 1 && (
                    <button
                      onClick={() => lightboxNav(1)}
                      className="absolute right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 z-10"
                    >
                      <ChevronRight size={24} />
                    </button>
                  )}
                </div>

                {/* Prompt */}
                {img.prompt && (
                  <div className="p-3 bg-slate-900/80 rounded-b-xl mt-2 max-h-24 overflow-y-auto">
                    <p className="text-slate-400 text-xs leading-relaxed">{img.prompt}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
