'use client';

import { useState } from 'react';
import {
  Download, Trash2, Loader2, Maximize2, ZoomIn,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import type { GalleryImageItem } from './image-gallery';

interface ShotImageGalleryProps {
  blockNumber: number;
  images: GalleryImageItem[];
  inlineImage?: { base64: string; mimeType: string };
  onUpscale: (img: GalleryImageItem) => void;
  onDelete: (img: GalleryImageItem) => void;
  onDownload: (img: GalleryImageItem) => void;
  onFullscreen: (blockNum: number, imageIndex: number) => void;
  getImageSrc: (img: GalleryImageItem) => string;
  upscalingId: string | null;
  deletingId: string | null;
}

export default function ShotImageGallery({
  blockNumber,
  images,
  inlineImage,
  onUpscale,
  onDelete,
  onDownload,
  onFullscreen,
  getImageSrc,
  upscalingId,
  deletingId,
}: ShotImageGalleryProps) {
  const [currentIdx, setCurrentIdx] = useState(0);

  // Build combined list: gallery images + inline fallback
  const allImages: Array<{ type: 'gallery'; data: GalleryImageItem } | { type: 'inline'; data: { base64: string; mimeType: string } }> = [
    ...images.map(img => ({ type: 'gallery' as const, data: img })),
    ...(inlineImage ? [{ type: 'inline' as const, data: inlineImage }] : []),
  ];

  if (allImages.length === 0) return null;

  const safeIdx = Math.min(currentIdx, allImages.length - 1);
  const current = allImages[safeIdx];

  const getSrc = () => {
    if (current.type === 'inline') {
      return `data:${current.data.mimeType};base64,${current.data.base64}`;
    }
    return getImageSrc(current.data);
  };

  const isGallery = current.type === 'gallery';
  const galleryImg = isGallery ? current.data as GalleryImageItem : null;

  return (
    <div className="mt-2">
      {/* Main image display */}
      <div className="relative group/shot rounded-lg overflow-hidden border border-cyan-500/20 bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getSrc()}
          alt={`Block ${blockNumber} image ${safeIdx + 1}`}
          className="w-full max-h-[220px] object-contain"
        />

        {/* Hover actions overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover/shot:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover/shot:opacity-100">
          {isGallery && galleryImg && (
            <>
              <button
                onClick={() => onFullscreen(blockNumber, safeIdx)}
                className="p-1.5 bg-black/70 rounded-lg text-white hover:bg-purple-600/80 transition-colors"
                title="Full screen"
              >
                <Maximize2 size={14} />
              </button>
              <button
                onClick={() => onUpscale(galleryImg)}
                disabled={upscalingId === galleryImg.id || !!galleryImg.base64}
                className="p-1.5 bg-black/70 rounded-lg text-white hover:bg-cyan-600/80 disabled:opacity-40 transition-colors"
                title={galleryImg.base64 ? 'Save project first' : 'Upscale 4x'}
              >
                {upscalingId === galleryImg.id ? <Loader2 size={14} className="animate-spin" /> : <ZoomIn size={14} />}
              </button>
              <button
                onClick={() => onDownload(galleryImg)}
                className="p-1.5 bg-black/70 rounded-lg text-white hover:bg-green-600/80 transition-colors"
                title="Download"
              >
                <Download size={14} />
              </button>
              <button
                onClick={() => onDelete(galleryImg)}
                disabled={deletingId === galleryImg.id}
                className="p-1.5 bg-black/70 rounded-lg text-white hover:bg-red-600/80 transition-colors"
                title="Delete"
              >
                {deletingId === galleryImg.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </>
          )}
          {!isGallery && (
            <span className="px-2 py-1 bg-amber-500/80 text-white text-[10px] font-medium rounded">Unsaved preview</span>
          )}
        </div>

        {/* Navigation arrows for multiple images */}
        {allImages.length > 1 && (
          <>
            {safeIdx > 0 && (
              <button
                onClick={() => setCurrentIdx(safeIdx - 1)}
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors z-10"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {safeIdx < allImages.length - 1 && (
              <button
                onClick={() => setCurrentIdx(safeIdx + 1)}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors z-10"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </>
        )}

        {/* Image counter badge */}
        {allImages.length > 1 && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded-full">
            {safeIdx + 1} / {allImages.length}
          </div>
        )}

        {/* Dimensions badge */}
        {isGallery && galleryImg && galleryImg.width > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/60 text-slate-300 text-[9px] rounded">
            {galleryImg.width}×{galleryImg.height}
          </div>
        )}
      </div>

      {/* Thumbnail strip for multiple images */}
      {allImages.length > 1 && (
        <div className="flex gap-1 mt-1.5 overflow-x-auto">
          {allImages.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={`flex-shrink-0 w-10 h-10 rounded border-2 overflow-hidden transition-colors ${
                idx === safeIdx ? 'border-cyan-400' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.type === 'inline'
                  ? `data:${item.data.mimeType};base64,${(item.data as { base64: string; mimeType: string }).base64}`
                  : getImageSrc(item.data as GalleryImageItem)
                }
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
