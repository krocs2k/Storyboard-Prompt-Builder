'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ImageIcon, Download, Trash2, Loader2, RefreshCw, Play,
  FileText, X, ChevronLeft, ChevronRight, ZoomIn, AlertCircle, CheckCircle, Copy, Check
} from 'lucide-react';
import { StoryboardBlock } from '@/lib/types';
import { authFetch } from '@/lib/utils';
import { jsPDF } from 'jspdf';

interface StoryboardImage {
  id: string;
  projectId: string;
  blockNumber: number;
  prompt: string;
  imagePath: string;
  fileName: string;
  aspectRatio: string;
  createdAt: string;
}

interface StoryboardViewerProps {
  projectId: string;
  blocks: StoryboardBlock[];
  shotlist: Record<string, Array<{ blockNumber: number; shotType: string; action: string; prompt: string }>>;
  projectName: string;
}

interface BatchProgress {
  status: string;
  message: string;
  total: number;
  completed: number;
  failed?: number;
  skipped?: number;
  currentBlock?: number;
}

export default function StoryboardViewer({ projectId, blocks, shotlist, projectName }: StoryboardViewerProps) {
  const [images, setImages] = useState<Map<number, StoryboardImage>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generatingBlock, setGeneratingBlock] = useState<number | null>(null);
  const [batchRendering, setBatchRendering] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [lightboxBlock, setLightboxBlock] = useState<number | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Fetch existing images
  const fetchImages = useCallback(async () => {
    try {
      const res = await authFetch(`/api/storyboard-images?projectId=${projectId}`);
      const data = await res.json();
      if (data.images) {
        const map = new Map<number, StoryboardImage>();
        for (const img of data.images) {
          map.set(img.blockNumber, img);
        }
        setImages(map);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Generate single block image
  const generateBlockImage = async (block: StoryboardBlock) => {
    setGeneratingBlock(block.blockNumber);
    try {
      const prompt = block.prompt || block.subjectAction || block.action || block.scene;
      if (!prompt) {
        showToast('No prompt available for this block', 'error');
        return;
      }

      const res = await authFetch('/api/storyboard-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          blockNumber: block.blockNumber,
          prompt,
          aspectRatio,
        }),
      });

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        showToast(`Image generation failed (status ${res.status}). Please try again.`, 'error');
        return;
      }
      const data = await res.json();
      if (data.success && data.image) {
        setImages(prev => new Map(prev).set(block.blockNumber, data.image));
        showToast(`Block ${block.blockNumber} image generated`);
      } else {
        showToast(data.error || 'Generation failed', 'error');
      }
    } catch (err) {
      showToast('Failed to generate image', 'error');
    } finally {
      setGeneratingBlock(null);
    }
  };

  // Batch render all
  const batchRenderAll = async (regenerateExisting: boolean = false) => {
    setBatchRendering(true);
    setBatchProgress({ status: 'starting', message: 'Starting batch render...', total: 0, completed: 0 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await authFetch('/api/storyboard-images/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, aspectRatio, regenerateExisting }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        showToast('Batch render failed to start', 'error');
        setBatchRendering(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const match = line.match(/^data:\s*(.+)/);
          if (!match) continue;
          try {
            const progress = JSON.parse(match[1]) as BatchProgress;
            setBatchProgress(progress);
            if (progress.status === 'complete') {
              showToast(progress.message);
              fetchImages();
            }
          } catch { /* skip */ }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const match = buffer.match(/^data:\s*(.+)/);
        if (match) {
          try {
            const progress = JSON.parse(match[1]) as BatchProgress;
            setBatchProgress(progress);
            if (progress.status === 'complete') {
              showToast(progress.message);
              fetchImages();
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        showToast('Batch render failed', 'error');
      }
    } finally {
      setBatchRendering(false);
      abortRef.current = null;
    }
  };

  // Delete single image
  const deleteBlockImage = async (blockNumber: number) => {
    if (!confirm(`Delete image for Block ${blockNumber}?`)) return;
    try {
      const res = await authFetch('/api/storyboard-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, blockNumber }),
      });
      const data = await res.json();
      if (data.success) {
        setImages(prev => {
          const map = new Map(prev);
          map.delete(blockNumber);
          return map;
        });
        showToast(`Block ${blockNumber} image deleted`);
      }
    } catch {
      showToast('Failed to delete image', 'error');
    }
  };

  // Erase all images
  const eraseAllImages = async () => {
    if (!confirm('Erase ALL storyboard images for this project? This cannot be undone.')) return;
    try {
      const res = await authFetch('/api/storyboard-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, deleteAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        setImages(new Map());
        showToast(`${data.deleted} images erased`);
      }
    } catch {
      showToast('Failed to erase images', 'error');
    }
  };

  // Download single image
  const downloadImage = (blockNumber: number) => {
    const img = images.get(blockNumber);
    if (!img) return;
    const a = document.createElement('a');
    a.href = `/api/images?path=${encodeURIComponent(img.imagePath)}`;
    a.download = img.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Download PDF
  const downloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const res = await authFetch('/api/storyboard-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!data.pages) {
        showToast('Failed to generate PDF data', 'error');
        return;
      }

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Title page
      pdf.setFillColor(30, 30, 35);
      pdf.rect(0, 0, pageW, pageH, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(32);
      pdf.text(data.title || data.projectName, pageW / 2, pageH / 2 - 15, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(180, 180, 180);
      pdf.text('Storyboard', pageW / 2, pageH / 2 + 5, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`${data.totalBlocks} blocks`, pageW / 2, pageH / 2 + 15, { align: 'center' });

      for (const page of data.pages) {
        pdf.addPage();
        pdf.setFillColor(30, 30, 35);
        pdf.rect(0, 0, pageW, pageH, 'F');

        // Header
        pdf.setTextColor(0, 200, 200);
        pdf.setFontSize(14);
        pdf.text(`Block ${page.blockNumber}`, 10, 15);
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(9);
        pdf.text(`${page.timestampStart} - ${page.timestampEnd}`, 10, 22);

        // Image
        const imgX = 10;
        const imgY = 28;
        const imgW = 160;
        const imgH = 90;

        if (page.imageBase64) {
          try {
            pdf.addImage(`data:image/png;base64,${page.imageBase64}`, 'PNG', imgX, imgY, imgW, imgH);
          } catch {
            pdf.setDrawColor(80, 80, 80);
            pdf.rect(imgX, imgY, imgW, imgH);
            pdf.setTextColor(100, 100, 100);
            pdf.setFontSize(10);
            pdf.text('Image not available', imgX + imgW / 2, imgY + imgH / 2, { align: 'center' });
          }
        } else {
          pdf.setDrawColor(80, 80, 80);
          pdf.rect(imgX, imgY, imgW, imgH);
          pdf.setTextColor(100, 100, 100);
          pdf.setFontSize(10);
          pdf.text('No image generated', imgX + imgW / 2, imgY + imgH / 2, { align: 'center' });
        }

        // Scene info - right side
        const infoX = 180;
        let infoY = 28;
        const infoW = pageW - infoX - 10;

        const addField = (label: string, value: string | undefined) => {
          if (!value) return;
          pdf.setTextColor(0, 200, 200);
          pdf.setFontSize(8);
          pdf.text(label, infoX, infoY);
          infoY += 4;
          pdf.setTextColor(220, 220, 220);
          pdf.setFontSize(9);
          const lines = pdf.splitTextToSize(value, infoW);
          pdf.text(lines.slice(0, 3), infoX, infoY);
          infoY += Math.min(lines.length, 3) * 4 + 4;
        };

        addField('SCENE', page.scene);
        addField('LOCATION', page.location);
        addField('SHOT TYPE', page.shotType);
        addField('LIGHTING', page.lighting);
        addField('ATMOSPHERE', page.atmosphere);

        // Action/prompt at bottom
        const bottomY = imgY + imgH + 8;
        pdf.setTextColor(0, 200, 200);
        pdf.setFontSize(8);
        pdf.text('ACTION', 10, bottomY);
        pdf.setTextColor(200, 200, 200);
        pdf.setFontSize(9);
        const actionText = page.action || page.subjectAction || '';
        const actionLines = pdf.splitTextToSize(actionText, pageW - 20);
        pdf.text(actionLines.slice(0, 3), 10, bottomY + 5);

        if (page.prompt) {
          const promptY = bottomY + 5 + Math.min(actionLines.length, 3) * 4 + 5;
          pdf.setTextColor(0, 200, 200);
          pdf.setFontSize(8);
          pdf.text('PROMPT', 10, promptY);
          pdf.setTextColor(160, 160, 160);
          pdf.setFontSize(7);
          const promptLines = pdf.splitTextToSize(page.prompt, pageW - 20);
          pdf.text(promptLines.slice(0, 4), 10, promptY + 4);
        }
      }

      pdf.save(`${(data.title || data.projectName || 'storyboard').replace(/[^a-zA-Z0-9]/g, '_')}_storyboard.pdf`);
      showToast('PDF downloaded!');
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('Failed to generate PDF', 'error');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Lightbox navigation
  const copyPromptText = async (text: string, id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedPromptId(id);
      setTimeout(() => setCopiedPromptId(null), 2000);
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        setCopiedPromptId(id);
        setTimeout(() => setCopiedPromptId(null), 2000);
      } catch { /* silent */ }
    }
  };

  const lightboxNav = (direction: number) => {
    if (lightboxBlock === null) return;
    const blockNumbers = blocks.map(b => b.blockNumber);
    const idx = blockNumbers.indexOf(lightboxBlock);
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < blockNumbers.length) {
      setLightboxBlock(blockNumbers[newIdx]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        <span className="ml-2 text-slate-400">Loading storyboard images...</span>
      </div>
    );
  }

  const imagesCount = images.size;
  const totalBlocks = blocks.length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm ${
          toastMsg.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toastMsg.text}
        </div>
      )}

      {/* Controls Bar */}
      <div className="bg-slate-800/70 rounded-xl border border-slate-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <ImageIcon className="text-cyan-400" size={20} />
              Storyboard Images
            </h3>
            <span className="text-slate-400 text-sm">
              {imagesCount}/{totalBlocks} rendered
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Aspect Ratio */}
            <select
              value={aspectRatio}
              onChange={e => setAspectRatio(e.target.value)}
              className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-white text-sm"
            >
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
              <option value="1:1">1:1</option>
              <option value="9:16">9:16</option>
              <option value="3:4">3:4</option>
            </select>

            {/* Render All */}
            <button
              onClick={() => batchRenderAll(false)}
              disabled={batchRendering || generatingBlock !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-all"
            >
              <Play size={14} /> Render All
            </button>

            {/* Re-render All */}
            {imagesCount > 0 && (
              <button
                onClick={() => batchRenderAll(true)}
                disabled={batchRendering || generatingBlock !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:text-slate-500 text-white text-sm rounded-lg transition-all"
              >
                <RefreshCw size={14} /> Re-render All
              </button>
            )}

            {/* Download PDF */}
            {imagesCount > 0 && (
              <button
                onClick={downloadPdf}
                disabled={generatingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm rounded-lg transition-all"
              >
                {generatingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                PDF
              </button>
            )}

            {/* Erase All */}
            {imagesCount > 0 && (
              <button
                onClick={eraseAllImages}
                disabled={batchRendering}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm rounded-lg transition-all"
              >
                <Trash2 size={14} /> Erase All
              </button>
            )}
          </div>
        </div>

        {/* Batch Progress */}
        {batchRendering && batchProgress && (
          <div className="mt-4 bg-slate-900/60 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">{batchProgress.message}</span>
              <span className="text-cyan-400 text-sm font-mono">
                {batchProgress.completed}/{batchProgress.total}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
              />
            </div>
            {batchProgress.failed !== undefined && batchProgress.failed > 0 && (
              <p className="text-red-400 text-xs mt-1">{batchProgress.failed} failed</p>
            )}
          </div>
        )}
      </div>

      {/* Storyboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {blocks.map(block => {
          const img = images.get(block.blockNumber);
          const isGenerating = generatingBlock === block.blockNumber;

          return (
            <div key={block.blockNumber} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden group hover:border-slate-600 transition-colors">
              {/* Image Area */}
              <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
                {img ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/images?path=${encodeURIComponent(img.imagePath)}`}
                      alt={`Block ${block.blockNumber} - ${block.scene || block.action}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setLightboxBlock(block.blockNumber)}
                    />
                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setLightboxBlock(block.blockNumber)}
                        className="p-2 bg-black/60 rounded-lg text-white hover:bg-black/80"
                        title="View full size"
                      >
                        <ZoomIn size={18} />
                      </button>
                      <button
                        onClick={() => downloadImage(block.blockNumber)}
                        className="p-2 bg-black/60 rounded-lg text-white hover:bg-black/80"
                        title="Download"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => generateBlockImage(block)}
                        disabled={isGenerating || batchRendering}
                        className="p-2 bg-black/60 rounded-lg text-white hover:bg-black/80"
                        title="Regenerate"
                      >
                        <RefreshCw size={18} />
                      </button>
                      <button
                        onClick={() => deleteBlockImage(block.blockNumber)}
                        className="p-2 bg-red-600/60 rounded-lg text-white hover:bg-red-600/80"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                        <span className="text-slate-400 text-sm">Generating...</span>
                      </>
                    ) : (
                      <button
                        onClick={() => generateBlockImage(block)}
                        disabled={batchRendering}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        <ImageIcon size={16} /> Generate Image
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Block Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-cyan-400 font-semibold text-sm">Block {block.blockNumber}</span>
                  <span className="text-slate-500 text-xs font-mono">{block.timestampStart} - {block.timestampEnd}</span>
                </div>
                <div className="relative group/prompt">
                  <p className="text-slate-300 text-sm line-clamp-2 pr-7">
                    {block.action || block.subjectAction || block.scene}
                  </p>
                  {(block.action || block.subjectAction || block.scene) && (
                    <button
                      onClick={() => copyPromptText(
                        (block.action || block.subjectAction || block.scene) as string,
                        `block-${block.blockNumber}`
                      )}
                      className="absolute top-0 right-0 p-1 text-slate-500 hover:text-cyan-400 transition-colors opacity-0 group-hover/prompt:opacity-100"
                      title="Copy prompt"
                    >
                      {copiedPromptId === `block-${block.blockNumber}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {block.shotType && (
                    <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-xs">{block.shotType}</span>
                  )}
                  {block.lighting && (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-xs">{block.lighting}</span>
                  )}
                  {block.location && (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">{block.location}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxBlock !== null && (() => {
        const img = images.get(lightboxBlock);
        const block = blocks.find(b => b.blockNumber === lightboxBlock);
        if (!block) return null;
        const blockNumbers = blocks.map(b => b.blockNumber);
        const idx = blockNumbers.indexOf(lightboxBlock);

        return (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxBlock(null)}>
            <div className="max-w-6xl w-full max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Lightbox Header */}
              <div className="flex items-center justify-between p-4">
                <div>
                  <h3 className="text-white font-bold">Block {block.blockNumber}</h3>
                  <p className="text-slate-400 text-sm">{block.timestampStart} - {block.timestampEnd}</p>
                </div>
                <div className="flex items-center gap-2">
                  {img && (
                    <button
                      onClick={() => downloadImage(lightboxBlock)}
                      className="p-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600"
                    >
                      <Download size={18} />
                    </button>
                  )}
                  <button onClick={() => setLightboxBlock(null)} className="p-2 bg-slate-700 rounded-lg text-white hover:bg-slate-600">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Image */}
              <div className="flex-1 flex items-center justify-center relative min-h-0 px-4">
                {idx > 0 && (
                  <button
                    onClick={() => lightboxNav(-1)}
                    className="absolute left-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 z-10"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}

                {img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/images?path=${encodeURIComponent(img.imagePath)}`}
                    alt={`Block ${block.blockNumber}`}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-64 bg-slate-900 rounded-lg">
                    <p className="text-slate-500">No image generated</p>
                  </div>
                )}

                {idx < blockNumbers.length - 1 && (
                  <button
                    onClick={() => lightboxNav(1)}
                    className="absolute right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 z-10"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}
              </div>

              {/* Scene Info */}
              <div className="p-4 bg-slate-900/80 rounded-b-xl mt-2 max-h-40 overflow-y-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {block.scene && (
                    <div>
                      <span className="text-cyan-400 text-xs font-medium">SCENE</span>
                      <p className="text-slate-300">{block.scene}</p>
                    </div>
                  )}
                  {block.location && (
                    <div>
                      <span className="text-purple-400 text-xs font-medium">LOCATION</span>
                      <p className="text-slate-300">{block.location}</p>
                    </div>
                  )}
                  {block.shotType && (
                    <div>
                      <span className="text-amber-400 text-xs font-medium">SHOT TYPE</span>
                      <p className="text-slate-300">{block.shotType}</p>
                    </div>
                  )}
                  {block.lighting && (
                    <div>
                      <span className="text-amber-400 text-xs font-medium">LIGHTING</span>
                      <p className="text-slate-300">{block.lighting}</p>
                    </div>
                  )}
                </div>
                {(block.action || block.subjectAction) && (
                  <div className="flex items-start justify-between gap-2 mt-2">
                    <p className="text-slate-400 text-sm">{block.action || block.subjectAction}</p>
                    <button
                      onClick={() => copyPromptText(
                        (block.action || block.subjectAction) as string,
                        `lb-block-${block.blockNumber}`
                      )}
                      className="flex-shrink-0 p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                      title="Copy prompt"
                    >
                      {copiedPromptId === `lb-block-${block.blockNumber}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
