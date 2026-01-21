'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Grid3X3, Scissors, Download, Trash2, Image as ImageIcon,
  Loader2, CheckCircle, AlertCircle, Settings, FileImage, Archive,
  Clock, RefreshCw
} from 'lucide-react';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
}

interface GridPreview {
  cols: number;
  rows: number;
}

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '3:2', label: '3:2 (Classic)' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '2:3', label: '2:3 (Portrait Classic)' },
  { value: '3:4', label: '3:4 (Portrait Standard)' },
];

const OUTPUT_FORMATS = [
  { value: 'jpg', label: 'JPEG (.jpg)' },
  { value: 'png', label: 'PNG (.png)' },
];

interface ImageGridCutterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageGridCutter({ isOpen, onClose }: ImageGridCutterProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [totalCount, setTotalCount] = useState(4);
  const [outputFormat, setOutputFormat] = useState('jpg');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [gridPreview, setGridPreview] = useState<GridPreview>({ cols: 2, rows: 2 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate grid preview based on aspect ratio and count
  const calculateGrid = useCallback((count: number, ratio: string) => {
    const [w, h] = ratio.split(':').map(Number);
    const targetRatio = w / h;
    
    let bestCols = 1;
    let bestRows = count;
    let bestRatioDiff = Infinity;
    
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const gridRatio = cols / rows;
      const ratioDiff = Math.abs(gridRatio - targetRatio);
      
      if (ratioDiff < bestRatioDiff && cols * rows >= count) {
        bestRatioDiff = ratioDiff;
        bestCols = cols;
        bestRows = rows;
      }
    }
    
    setGridPreview({ cols: bestCols, rows: bestRows });
  }, []);

  // Update grid preview when count or ratio changes
  const handleCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(100, count));
    setTotalCount(validCount);
    calculateGrid(validCount, aspectRatio);
  };

  const handleRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    calculateGrid(totalCount, ratio);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      addFiles(Array.from(files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files) {
      addFiles(Array.from(files));
    }
  };

  const addFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    const newImages: UploadedImage[] = imageFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    
    setImages(prev => [...prev, ...newImages]);
    setError('');
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearAllImages = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  // Process images and download ZIP
  const processImages = async () => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      images.forEach(img => {
        formData.append('images', img.file);
      });
      formData.append('aspectRatio', aspectRatio);
      formData.append('totalCount', String(totalCount));
      formData.append('outputFormat', outputFormat);

      const response = await fetch('/api/image-grid-cutter', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process images');
      }

      // Get the ZIP file
      const blob = await response.blob();
      const filename = response.headers.get('X-Zip-Filename') || `grid-cut-${Date.now()}.zip`;
      const totalSegments = response.headers.get('X-Total-Segments') || String(totalCount);
      const gridCols = response.headers.get('X-Grid-Cols');
      const gridRows = response.headers.get('X-Grid-Rows');

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Successfully created ${totalSegments} image segments (${gridCols}×${gridRows} grid). ZIP downloaded!`);
      
      // Clear images after successful processing
      clearAllImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process images');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Grid3X3 className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Image Grid Cutter</h2>
                <p className="text-sm text-slate-400">Cut images into grid segments</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left: Settings & Upload */}
              <div className="space-y-6">
                {/* Settings */}
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings size={20} className="text-amber-400" />
                    Grid Settings
                  </h3>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => handleRatioChange(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      {ASPECT_RATIOS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Total Count */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Total Image Count</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={totalCount}
                      onChange={(e) => handleCountChange(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Grid will be {gridPreview.cols} × {gridPreview.rows} = {gridPreview.cols * gridPreview.rows} segments</p>
                  </div>

                  {/* Output Format */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Output Format</label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      {OUTPUT_FORMATS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid Preview */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Grid Preview</h3>
                  <div 
                    className="border-2 border-amber-500/50 rounded-lg overflow-hidden"
                    style={{ 
                      aspectRatio: aspectRatio.replace(':', '/'),
                      maxHeight: '150px'
                    }}
                  >
                    <div 
                      className="w-full h-full grid gap-[1px] bg-amber-500/30"
                      style={{ 
                        gridTemplateColumns: `repeat(${gridPreview.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${gridPreview.rows}, 1fr)`
                      }}
                    >
                      {Array.from({ length: gridPreview.cols * gridPreview.rows }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`bg-slate-700 flex items-center justify-center text-xs ${
                            i < totalCount ? 'text-amber-400' : 'text-slate-500'
                          }`}
                        >
                          {i < totalCount ? i + 1 : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    {totalCount} segments will be extracted
                  </p>
                </div>

                {/* Info */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-400 font-medium">Auto-cleanup</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Processed images are deleted immediately after download. ZIP files are available for 30 minutes then automatically erased.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Upload & Images */}
              <div className="space-y-4">
                {/* Upload Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-600 hover:border-amber-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-white font-medium">Drop images here</p>
                  <p className="text-slate-400 text-sm mt-1">or click to browse</p>
                  <p className="text-slate-500 text-xs mt-3">Supports JPG, PNG, WebP, GIF</p>
                </div>

                {/* Uploaded Images */}
                {images.length > 0 && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <FileImage size={16} className="text-amber-400" />
                        Uploaded Images ({images.length})
                      </h3>
                      <button
                        onClick={clearAllImages}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Clear All
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                      {images.map(img => (
                        <div key={img.id} className="relative group">
                          <img
                            src={img.preview}
                            alt={img.name}
                            className="w-full aspect-square object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removeImage(img.id)}
                            className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} className="text-white" />
                          </button>
                          <p className="text-xs text-slate-400 truncate mt-1">{img.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-sm text-green-400">{success}</p>
                  </div>
                )}

                {/* Process Button */}
                <button
                  onClick={processImages}
                  disabled={images.length === 0 || processing}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-5 h-5" />
                      Cut Images & Download ZIP
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
