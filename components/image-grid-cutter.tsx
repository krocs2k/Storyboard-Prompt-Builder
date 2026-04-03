'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, Grid3X3, Scissors, Download, Trash2, Image as ImageIcon,
  Loader2, CheckCircle, AlertCircle, Settings, FileImage, Archive,
  Clock, RefreshCw, Sparkles, Eye
} from 'lucide-react';
import { authFetch } from '@/lib/utils';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  name: string;
}

interface DetectedRegion {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  px: number;
  py: number;
  pw: number;
  ph: number;
}

type CutMode = 'grid' | 'auto';

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
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [outputFormat, setOutputFormat] = useState('jpg');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cutMode, setCutMode] = useState<CutMode>('grid');
  const [detecting, setDetecting] = useState(false);
  const [detectedRegions, setDetectedRegions] = useState<DetectedRegion[]>([]);
  const [detectedLayout, setDetectedLayout] = useState('');
  const [detectedImageSize, setDetectedImageSize] = useState<{ w: number; h: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle row/column changes with validation
  const handleRowsChange = (value: number) => {
    setRows(Math.max(1, Math.min(20, value)));
  };

  const handleColsChange = (value: number) => {
    setCols(Math.max(1, Math.min(20, value)));
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
    setDetectedRegions([]);
    setDetectedLayout('');
    setDetectedImageSize(null);
  };

  // Auto-detect images within the first uploaded image using Gemini Vision
  const detectImages = async () => {
    if (images.length === 0) {
      setError('Please upload an image first');
      return;
    }

    setDetecting(true);
    setError('');
    setDetectedRegions([]);

    try {
      const formData = new FormData();
      formData.append('image', images[0].file);

      const response = await authFetch('/api/image-grid-cutter/detect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Detection failed');
      }

      const data = await response.json();
      setDetectedRegions(data.regions || []);
      setDetectedLayout(data.estimatedLayout || '');
      setDetectedImageSize({ w: data.imageWidth, h: data.imageHeight });

      if (data.regions.length === 0) {
        setError('No distinct images detected in the uploaded image');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect images');
    } finally {
      setDetecting(false);
    }
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
      formData.append('outputFormat', outputFormat);
      formData.append('mode', cutMode);

      if (cutMode === 'auto') {
        formData.append('regions', JSON.stringify(detectedRegions.map(r => ({
          x: r.x, y: r.y, w: r.w, h: r.h, label: r.label
        }))));
      } else {
        formData.append('rows', String(rows));
        formData.append('cols', String(cols));
      }

      const response = await authFetch('/api/image-grid-cutter', {
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
      const totalSegments = response.headers.get('X-Total-Segments') || String(rows * cols);
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

      const modeLabel = cutMode === 'auto' ? 'auto-detected regions' : `${gridCols}×${gridRows} grid`;
      setSuccess(`Successfully created ${totalSegments} image segments (${modeLabel}). ZIP downloaded!`);
      
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
                <p className="text-sm text-slate-400">Cut images into full-bleed grid segments</p>
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
                {/* Mode Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setCutMode('grid'); setDetectedRegions([]); setDetectedLayout(''); }}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all text-sm font-medium ${
                      cutMode === 'grid'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Grid3X3 size={18} />
                    Manual Grid
                  </button>
                  <button
                    onClick={() => setCutMode('auto')}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all text-sm font-medium ${
                      cutMode === 'auto'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Sparkles size={18} />
                    Auto-Detect
                  </button>
                </div>

                {/* Settings */}
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Settings size={20} className="text-amber-400" />
                    {cutMode === 'grid' ? 'Grid Settings' : 'Detection Settings'}
                  </h3>

                  {/* Grid Dimensions (grid mode only) */}
                  {cutMode === 'grid' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Columns</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={cols}
                            onChange={(e) => handleColsChange(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-400 mb-2">Rows</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={rows}
                            onChange={(e) => handleRowsChange(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 -mt-2">Grid: {cols} × {rows} = {cols * rows} segments per image</p>
                    </>
                  )}

                  {/* Auto-detect info */}
                  {cutMode === 'auto' && (
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                      <p className="text-xs text-purple-300">
                        <Sparkles size={12} className="inline mr-1" />
                        Gemini Vision AI will analyze your image and detect individual pictures within it. Upload an image then click &quot;Detect Images&quot; below.
                      </p>
                    </div>
                  )}

                  {/* Aspect Ratio */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Output Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                    >
                      {ASPECT_RATIOS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Each segment will be resized to this aspect ratio</p>
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

                {/* Grid Preview (grid mode) */}
                {cutMode === 'grid' && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Grid Preview</h3>
                    <div 
                      className="border-2 border-amber-500/50 rounded-lg overflow-hidden bg-slate-700/50"
                      style={{ maxHeight: '180px' }}
                    >
                      <div 
                        className="w-full h-full grid gap-[2px] p-1"
                        style={{ 
                          gridTemplateColumns: `repeat(${cols}, 1fr)`,
                          gridTemplateRows: `repeat(${rows}, 1fr)`
                        }}
                      >
                        {Array.from({ length: cols * rows }).map((_, i) => (
                          <div 
                            key={i} 
                            className="bg-slate-600 rounded-sm flex items-center justify-center text-xs text-amber-400 border border-amber-500/30"
                            style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      {cols * rows} full-bleed segments per image • Output: {aspectRatio} aspect ratio
                    </p>
                  </div>
                )}

                {/* Detection Results Preview (auto mode) */}
                {cutMode === 'auto' && detectedRegions.length > 0 && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <Eye size={16} className="text-purple-400" />
                        Detected: {detectedRegions.length} image{detectedRegions.length !== 1 ? 's' : ''}
                      </h3>
                      {detectedLayout && (
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                          {detectedLayout}
                        </span>
                      )}
                    </div>

                    {/* Visual overlay preview */}
                    {images.length > 0 && detectedImageSize && (
                      <div className="relative border-2 border-purple-500/30 rounded-lg overflow-hidden mb-3">
                        <img
                          src={images[0].preview}
                          alt="Detection preview"
                          className="w-full h-auto"
                        />
                        {/* Region overlays */}
                        {detectedRegions.map((region) => (
                          <div
                            key={region.id}
                            className="absolute border-2 border-purple-400 bg-purple-500/10 flex items-center justify-center"
                            style={{
                              left: `${region.x * 100}%`,
                              top: `${region.y * 100}%`,
                              width: `${region.w * 100}%`,
                              height: `${region.h * 100}%`,
                            }}
                          >
                            <span className="bg-purple-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              {region.id}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Region list */}
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {detectedRegions.map((region) => (
                        <div key={region.id} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="bg-purple-500/20 text-purple-300 w-5 h-5 rounded flex items-center justify-center font-bold flex-shrink-0">
                            {region.id}
                          </span>
                          <span className="truncate">{region.label}</span>
                          <span className="text-slate-600 ml-auto flex-shrink-0">{region.pw}×{region.ph}px</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

                {/* Auto-Detect Button (auto mode, before detection) */}
                {cutMode === 'auto' && detectedRegions.length === 0 && (
                  <button
                    onClick={detectImages}
                    disabled={images.length === 0 || detecting}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-700 text-white disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {detecting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing with Gemini AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Detect Images
                      </>
                    )}
                  </button>
                )}

                {/* Re-detect button (auto mode, after detection) */}
                {cutMode === 'auto' && detectedRegions.length > 0 && (
                  <button
                    onClick={detectImages}
                    disabled={detecting}
                    className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw size={14} className={detecting ? 'animate-spin' : ''} />
                    Re-detect
                  </button>
                )}

                {/* Process/Cut Button */}
                <button
                  onClick={processImages}
                  disabled={images.length === 0 || processing || (cutMode === 'auto' && detectedRegions.length === 0)}
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
                      {cutMode === 'auto'
                        ? `Cut ${detectedRegions.length} Detected Images & Download ZIP`
                        : 'Cut Images & Download ZIP'}
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
