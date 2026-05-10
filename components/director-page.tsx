'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film, Play, Pause, SkipForward, SkipBack, Download, Trash2,
  RefreshCw, Eye, EyeOff, GripVertical, Scissors, ChevronLeft,
  Loader2, Send, AlertCircle, Video, Maximize2, Volume2, VolumeX,
  RotateCcw, FolderOpen, ArrowLeft, Sparkles, Image as ImageIcon,
  AtSign, Square, X, Check, Clock, Clapperboard, Upload, Grid2x2, Grid3x3, Plus, Layers
} from 'lucide-react';
import { authFetch } from '@/lib/utils';

// Normalize a PoolImage.imagePath value into a working browser URL.
// Handles three legacy/edge cases:
//   1. Already-correct URLs (http(s)://... or /api/...) — pass through.
//   2. Legacy path-style `/api/images/<rel>` — convert to `/api/images?path=<enc>`.
//   3. Raw relative paths like `images/<projectId>/block.png` — same conversion.
function normalizePoolImageUrl(raw: string): string {
  if (!raw) return raw;
  if (raw.startsWith('http') || raw.startsWith('/api/category-images/')) return raw;
  if (raw.startsWith('/api/images?')) return raw;
  if (raw.startsWith('/api/images/')) {
    const rel = raw.replace(/^\/api\/images\//, '');
    return rel ? `/api/images?path=${encodeURIComponent(rel)}` : raw;
  }
  if (raw.startsWith('/api/')) return raw; // some other API route — trust it
  // Raw relative path
  const rel = raw.replace(/^\/+/, '');
  return `/api/images?path=${encodeURIComponent(rel)}`;
}

// Types
interface DirectorVideoItem {
  id: string;
  projectId: string;
  prompt: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  status: string;
  duration: number;
  inPoint: number;
  outPoint: number;
  sortOrder: number;
  enabled: boolean;
  deleted: boolean;
  deletedAt: string | null;
  modelId: string | null;
  startFrameUrl: string | null;
  endFrameUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface ProjectOption {
  id: string;
  name: string;
  storyboardImages: Array<{ id: string; imagePath: string; blockNumber: number; prompt: string }>;
  galleryImages: Array<{ id: string; imagePath: string; label: string; imageKey: string }>;
}

interface VideoModelConfig {
  selectedModelId: string;
  selectedModel: { id: string; name: string; provider: string; supportsStartFrame: boolean; supportsEndFrame: boolean } | null;
  hasApiKey: boolean;
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  availableModels: Array<{ id: string; name: string; provider: string; cost: string; supportsStartFrame: boolean; supportsEndFrame: boolean }>;
}

interface ImageRef {
  id: string;
  url: string;
  label: string;
  type: 'storyboard' | 'gallery' | 'pool';
  poolId?: string;
  isMultiImage?: boolean;
  gridSize?: number;
}

interface PoolImageItem {
  id: string;
  projectId: string;
  label: string;
  imagePath: string;
  fileName: string;
  aspectRatio: string;
  width: number;
  height: number;
  isMultiImage: boolean;
  gridSize: number;
  source: string;
  sourceId: string | null;
  sortOrder: number;
  hidden: boolean;
  deleted: boolean;
  deletedAt: string | null;
  createdAt: string;
}

export default function DirectorPage() {
  const { data: session } = useSession();

  // State
  const [config, setConfig] = useState<VideoModelConfig | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [videos, setVideos] = useState<DirectorVideoItem[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [trashedVideos, setTrashedVideos] = useState<DirectorVideoItem[]>([]);

  // Right-panel tab + image pool
  const [rightTab, setRightTab] = useState<'shot' | 'image'>('shot');
  const [poolImages, setPoolImages] = useState<PoolImageItem[]>([]);
  const [trashedPoolImages, setTrashedPoolImages] = useState<PoolImageItem[]>([]);
  const [uploadingPool, setUploadingPool] = useState(false);
  const [showHiddenImages, setShowHiddenImages] = useState(false);
  const [dragOverFrame, setDragOverFrame] = useState<'start' | 'end' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prompt builder
  const [prompt, setPrompt] = useState('');
  const [startFrameRef, setStartFrameRef] = useState<ImageRef | null>(null);
  const [endFrameRef, setEndFrameRef] = useState<ImageRef | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showStartFrameDropdown, setShowStartFrameDropdown] = useState(false);
  const [showEndFrameDropdown, setShowEndFrameDropdown] = useState(false);
  const [frameSearchQuery, setFrameSearchQuery] = useState('');

  // Video preview
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'single' | 'sequence'>('single');
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sequenceIndexRef = useRef(0);
  const animFrameRef = useRef<number>(0);

  // Trim editing
  const [editingTrimId, setEditingTrimId] = useState<string | null>(null);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);

  // Generation progress dialog
  interface GenerationTask { id: string; label: string; status: 'pending' | 'generating' | 'done' | 'failed'; error?: string }
  const [genTasks, setGenTasks] = useState<GenerationTask[]>([]);
  const [showGenDialog, setShowGenDialog] = useState(false);

  // Available images for frame dropdowns — pool is the canonical source now (includes synced storyboard/gallery)
  const availableImages = useMemo((): ImageRef[] => {
    if (!selectedProject) return [];
    const imgs: ImageRef[] = [];
    // Pool images are the single source — they include auto-synced storyboard + gallery + uploads
    for (const pi of poolImages) {
      if (pi.hidden) continue; // hide hidden from dropdowns
      const url = normalizePoolImageUrl(pi.imagePath);
      const srcLabel = pi.source === 'storyboard' ? 'storyboard' : pi.source === 'gallery' ? 'gallery' : 'pool';
      imgs.push({
        id: `pool-${pi.id}`, url, label: pi.label || pi.fileName || 'Image', type: srcLabel as ImageRef['type'],
        poolId: pi.id, isMultiImage: pi.isMultiImage, gridSize: pi.gridSize,
      });
    }
    return imgs;
  }, [selectedProject, poolImages]);

  const filteredImages = useMemo(() => {
    if (!frameSearchQuery) return availableImages;
    const q = frameSearchQuery.toLowerCase();
    return availableImages.filter(img => img.label.toLowerCase().includes(q));
  }, [availableImages, frameSearchQuery]);

  // Enabled videos for sequence playback
  const enabledVideos = useMemo(() => {
    return videos.filter(v => v.enabled && v.status === 'ready' && v.videoUrl && !v.deleted);
  }, [videos]);

  // Sequence total duration
  const sequenceDuration = useMemo(() => {
    return enabledVideos.reduce((sum, v) => {
      const dur = v.duration || 0;
      const inP = v.inPoint || 0;
      const outP = v.outPoint > inP ? v.outPoint : dur;
      return sum + (outP - inP);
    }, 0);
  }, [enabledVideos]);

  // Load config
  useEffect(() => {
    authFetch('/api/director/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(console.error);
  }, []);

  // Load projects
  useEffect(() => {
    authFetch('/api/projects?includeImages=true')
      .then(r => r.json())
      .then(data => {
        if (data.projects) setProjects(data.projects);
      })
      .catch(console.error);
  }, []);

  // Load videos when project selected
  const loadVideos = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await authFetch(`/api/director/videos?projectId=${selectedProject.id}`);
      const data = await res.json();
      if (data.videos) setVideos(data.videos.filter((v: DirectorVideoItem) => !v.deleted));
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  }, [selectedProject]);

  const loadTrashedVideos = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await authFetch(`/api/director/videos?projectId=${selectedProject.id}&includeDeleted=true`);
      const data = await res.json();
      if (data.videos) setTrashedVideos(data.videos.filter((v: DirectorVideoItem) => v.deleted));
    } catch (err) {
      console.error('Failed to load trashed videos:', err);
    }
  }, [selectedProject]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  // Pool images — sync storyboard/gallery into pool first, then load
  const loadPoolImages = useCallback(async () => {
    if (!selectedProject) return;
    try {
      // Auto-import storyboard + gallery images into pool
      await authFetch('/api/director/pool/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      const res = await authFetch(`/api/director/pool?projectId=${selectedProject.id}`);
      const data = await res.json();
      if (data.images) setPoolImages(data.images);
    } catch (err) { console.error('Failed to load pool images:', err); }
  }, [selectedProject]);

  const loadTrashedPoolImages = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await authFetch(`/api/director/pool?projectId=${selectedProject.id}&includeDeleted=true`);
      const data = await res.json();
      if (data.images) setTrashedPoolImages(data.images.filter((p: PoolImageItem) => p.deleted));
    } catch (err) { console.error('Failed to load trashed pool images:', err); }
  }, [selectedProject]);

  useEffect(() => { loadPoolImages(); }, [loadPoolImages]);

  const handlePoolUpload = async (files: FileList | null) => {
    if (!files || !files.length || !selectedProject) return;
    setUploadingPool(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('projectId', selectedProject.id);
        fd.append('label', file.name);
        const res = await authFetch('/api/director/pool/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.image) setPoolImages(prev => [...prev, data.image]);
      }
    } catch (err) { console.error('Upload failed:', err); }
    finally { setUploadingPool(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const togglePoolMulti = async (id: string, gridSize: number) => {
    const isMulti = gridSize > 0;
    setPoolImages(prev => prev.map(p => p.id === id ? { ...p, isMultiImage: isMulti, gridSize } : p));
    await authFetch('/api/director/pool', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isMultiImage: isMulti, gridSize }),
    });
  };

  const softDeletePool = async (id: string) => {
    await authFetch('/api/director/pool', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deleted: true }),
    });
    setPoolImages(prev => prev.filter(p => p.id !== id));
  };

  const visiblePoolImages = useMemo(() => {
    if (showHiddenImages) return poolImages;
    return poolImages.filter(p => !p.hidden);
  }, [poolImages, showHiddenImages]);

  const toggleHidePool = async (id: string) => {
    const img = poolImages.find(p => p.id === id);
    if (!img) return;
    const newHidden = !img.hidden;
    setPoolImages(prev => prev.map(p => p.id === id ? { ...p, hidden: newHidden } : p));
    await authFetch('/api/director/pool', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, hidden: newHidden }),
    });
  };

  const restorePoolImage = async (id: string) => {
    await authFetch('/api/director/pool', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restore: true }),
    });
    setTrashedPoolImages(prev => prev.filter(p => p.id !== id));
    loadPoolImages();
  };

  // Trigger generation for an already-created video record
  const triggerGenerate = async (videoId: string, vPrompt: string, startUrl: string | null, endUrl: string | null) => {
    let absStart = startUrl;
    let absEnd = endUrl;
    if (absStart && !absStart.startsWith('http')) absStart = `${window.location.origin}${absStart}`;
    if (absEnd && !absEnd.startsWith('http')) absEnd = `${window.location.origin}${absEnd}`;
    // Update progress dialog
    setGenTasks(prev => prev.map(t => t.id === videoId ? { ...t, status: 'generating' } : t));
    try {
      const res = await authFetch('/api/director/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, prompt: vPrompt, startFrameUrl: absStart, endFrameUrl: absEnd }),
      });
      const data = await res.json();
      if (data.success) {
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'ready', videoUrl: data.videoUrl } : v));
        setGenTasks(prev => prev.map(t => t.id === videoId ? { ...t, status: 'done' } : t));
      } else {
        const errMsg = data.error || 'Generation failed';
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'failed', errorMessage: errMsg } : v));
        setGenTasks(prev => prev.map(t => t.id === videoId ? { ...t, status: 'failed', error: errMsg } : t));
      }
    } catch (err) {
      console.error('Generate err:', err);
      const errMsg = err instanceof Error ? err.message : 'Network error';
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, status: 'failed', errorMessage: errMsg } : v));
      setGenTasks(prev => prev.map(t => t.id === videoId ? { ...t, status: 'failed', error: errMsg } : t));
    }
  };

  // Generate video
  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedProject || isGenerating) return;

    // Multi-image flow: if start frame is a flagged pool image
    if (startFrameRef?.type === 'pool' && startFrameRef.isMultiImage && startFrameRef.poolId &&
        (startFrameRef.gridSize === 4 || startFrameRef.gridSize === 9)) {
      setIsGenerating(true);
      setShowGenDialog(true);
      setGenTasks([{ id: 'multi-prep', label: 'Preparing multi-image cells…', status: 'generating' }]);
      try {
        const res = await authFetch('/api/director/multi-generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolImageId: startFrameRef.poolId,
            prompt: prompt.trim(),
            projectId: selectedProject.id,
            origin: window.location.origin,
          }),
        });
        const data = await res.json();
        if (!data.success || !data.videos) {
          const errMsg = data.error || 'unknown error';
          setGenTasks([{ id: 'multi-prep', label: 'Multi-image preparation', status: 'failed', error: errMsg }]);
          return;
        }
        // Set up tasks for each cell
        const tasks: GenerationTask[] = data.videos.map((v: DirectorVideoItem, i: number) => ({
          id: v.id, label: `Cell ${i + 1} of ${data.videos.length}`, status: 'pending' as const,
        }));
        setGenTasks(tasks);
        // Add all video records as generating
        setVideos(prev => [...prev, ...data.videos.map((v: DirectorVideoItem) => ({ ...v, status: 'generating' }))]);
        // Fire all video generation requests in parallel — the server-side
        // concurrency manager handles throttling and rate-limit safety
        await Promise.allSettled(
          data.videos.map((v: DirectorVideoItem) =>
            triggerGenerate(v.id, v.prompt, v.startFrameUrl, null)
          )
        );
      } catch (err) {
        console.error('Multi-generate error:', err);
        setGenTasks(prev => prev.length > 0 ? prev : [{ id: 'err', label: 'Error', status: 'failed', error: String(err) }]);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    setIsGenerating(true);
    setShowGenDialog(true);
    setGenTasks([{ id: 'create', label: 'Creating video record…', status: 'generating' }]);
    try {
      // First create the video record
      const createRes = await authFetch('/api/director/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          prompt: prompt.trim(),
          startFrameUrl: startFrameRef?.url || null,
          endFrameUrl: endFrameRef?.url || null,
        }),
      });
      const { video } = await createRes.json();
      if (!video) throw new Error('Failed to create video record');

      // Add to list immediately
      setVideos(prev => [...prev, { ...video, status: 'generating' }]);
      setGenTasks([{ id: video.id, label: prompt.trim().slice(0, 60) + (prompt.trim().length > 60 ? '…' : ''), status: 'generating' }]);

      // Build absolute URLs for frame references
      let absStartFrame = startFrameRef?.url || null;
      let absEndFrame = endFrameRef?.url || null;
      if (absStartFrame && !absStartFrame.startsWith('http')) {
        absStartFrame = `${window.location.origin}${absStartFrame}`;
      }
      if (absEndFrame && !absEndFrame.startsWith('http')) {
        absEndFrame = `${window.location.origin}${absEndFrame}`;
      }

      // Start generation (triggerGenerate handles progress updates)
      await triggerGenerate(video.id, prompt.trim(), absStartFrame, absEndFrame);
    } catch (err) {
      console.error('Generate error:', err);
      setGenTasks(prev => prev.map(t => ({ ...t, status: 'failed' as const, error: String(err) })));
    } finally {
      setIsGenerating(false);
    }
  };

  // Video actions
  const toggleEnable = async (id: string) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;
    await authFetch('/api/director/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: !video.enabled }),
    });
    setVideos(prev => prev.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v));
  };

  const softDelete = async (id: string) => {
    await authFetch('/api/director/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, deleted: true }),
    });
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const restoreVideo = async (id: string) => {
    await authFetch('/api/director/videos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, restore: true }),
    });
    setTrashedVideos(prev => prev.filter(v => v.id !== id));
    loadVideos();
  };

  const permanentDeleteVideo = async (id: string) => {
    if (!confirm('Permanently delete this video? This cannot be undone.')) return;
    await authFetch('/api/director/videos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setTrashedVideos(prev => prev.filter(v => v.id !== id));
  };

  const permanentDeletePoolImage = async (id: string) => {
    if (!confirm('Permanently delete this image? This cannot be undone.')) return;
    await authFetch('/api/director/pool', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setTrashedPoolImages(prev => prev.filter(p => p.id !== id));
  };

  const daysRemaining = (deletedAt: string | null): number => {
    if (!deletedAt) return 7;
    const elapsed = Date.now() - new Date(deletedAt).getTime();
    return Math.max(0, Math.ceil((7 * 24 * 60 * 60 * 1000 - elapsed) / (24 * 60 * 60 * 1000)));
  };

  const rerender = async (id: string) => {
    const video = videos.find(v => v.id === id);
    if (!video) return;
    setVideos(prev => prev.map(v => v.id === id ? { ...v, status: 'generating' } : v));
    // Show progress dialog for re-render
    setGenTasks([{ id, label: 'Re-rendering: ' + video.prompt.slice(0, 50) + (video.prompt.length > 50 ? '…' : ''), status: 'generating' }]);
    setShowGenDialog(true);

    let absStartFrame = video.startFrameUrl;
    let absEndFrame = video.endFrameUrl;
    if (absStartFrame && !absStartFrame.startsWith('http')) {
      absStartFrame = `${window.location.origin}${absStartFrame}`;
    }
    if (absEndFrame && !absEndFrame.startsWith('http')) {
      absEndFrame = `${window.location.origin}${absEndFrame}`;
    }

    await triggerGenerate(id, video.prompt, absStartFrame, absEndFrame);
  };

  // Trim
  const openTrim = (video: DirectorVideoItem) => {
    setEditingTrimId(video.id);
    setTrimIn(video.inPoint);
    setTrimOut(video.outPoint || video.duration);
  };

  const saveTrim = async () => {
    if (!editingTrimId) return;
    await authFetch('/api/director/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingTrimId, inPoint: trimIn, outPoint: trimOut }),
    });
    setVideos(prev => prev.map(v => v.id === editingTrimId ? { ...v, inPoint: trimIn, outPoint: trimOut } : v));
    setEditingTrimId(null);
  };

  // Drag-and-drop reorder
  const handleReorder = async (newOrder: DirectorVideoItem[]) => {
    setVideos(newOrder);
    const updates = newOrder.map((v, i) => ({ id: v.id, sortOrder: i }));
    await authFetch('/api/director/videos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
  };

  // Video playback
  const selectedVideo = useMemo(() => videos.find(v => v.id === selectedVideoId), [videos, selectedVideoId]);

  const handleVideoLoaded = () => {
    const el = videoRef.current;
    if (!el) return;
    const dur = el.duration;
    if (isFinite(dur) && dur > 0) {
      setTotalDuration(dur);
      // Update the video record duration if not set
      if (selectedVideo && selectedVideo.duration === 0) {
        authFetch('/api/director/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedVideo.id, outPoint: dur }),
        });
        setVideos(prev => prev.map(v => v.id === selectedVideo.id ? { ...v, duration: dur, outPoint: dur } : v));
      }
    }
  };

  const updateTimeDisplay = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      setCurrentTime(el.currentTime);
    }
    animFrameRef.current = requestAnimationFrame(updateTimeDisplay);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateTimeDisplay);
    } else {
      cancelAnimationFrame(animFrameRef.current);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, updateTimeDisplay]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const time = parseFloat(e.target.value);
    el.currentTime = time;
    setCurrentTime(time);
  };

  // Sequence playback
  const playSequence = useCallback(async () => {
    if (enabledVideos.length === 0) return;
    setPlayMode('sequence');
    setIsPlaying(true);
    sequenceIndexRef.current = 0;

    const playNext = () => {
      const idx = sequenceIndexRef.current;
      if (idx >= enabledVideos.length) {
        setIsPlaying(false);
        setPlayMode('single');
        return;
      }
      const v = enabledVideos[idx];
      setSelectedVideoId(v.id);
      const el = videoRef.current;
      if (el) {
        el.src = v.videoUrl || '';
        el.currentTime = v.inPoint || 0;
        el.onloadeddata = () => {
          el.play().catch(() => {});
        };
        el.ontimeupdate = () => {
          const outP = v.outPoint > v.inPoint ? v.outPoint : el.duration;
          if (el.currentTime >= outP) {
            el.pause();
            sequenceIndexRef.current++;
            playNext();
          }
        };
        el.load();
      }
    };
    playNext();
  }, [enabledVideos]);

  // Render sequence
  const handleRenderSequence = async () => {
    if (enabledVideos.length === 0) return;
    setIsRendering(true);
    try {
      const videoData = enabledVideos.map(v => ({
        url: v.videoUrl!,
        inPoint: v.inPoint || 0,
        outPoint: v.outPoint > v.inPoint ? v.outPoint : v.duration,
        duration: v.duration,
      }));

      const res = await authFetch('/api/director/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos: videoData }),
      });

      const data = await res.json();
      if (data.success && data.outputUrl) {
        // Download
        const a = document.createElement('a');
        a.href = data.outputUrl;
        a.download = 'rendered_sequence.mp4';
        a.click();
      } else {
        alert(`Render failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Render error:', err);
      alert('Render failed. Please try again.');
    } finally {
      setIsRendering(false);
    }
  };

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Frame dropdown component
  const handleFrameDrop = (e: React.DragEvent, side: 'start' | 'end') => {
    e.preventDefault();
    setDragOverFrame(null);
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const ref = JSON.parse(data) as ImageRef;
      if (side === 'start') setStartFrameRef(ref);
      else setEndFrameRef(ref);
    } catch { /* ignore */ }
  };

  const FrameDropdown = ({ label, value, onChange, show, setShow, side }: {
    label: string;
    value: ImageRef | null;
    onChange: (ref: ImageRef | null) => void;
    show: boolean;
    setShow: (v: boolean) => void;
    side: 'start' | 'end';
  }) => (
    <div
      className="relative"
      onDragOver={(e) => { e.preventDefault(); setDragOverFrame(side); }}
      onDragLeave={() => setDragOverFrame(null)}
      onDrop={(e) => handleFrameDrop(e, side)}
    >
      <label className="text-xs font-medium text-amber-300/70 mb-1 block">
        {label}
        {value?.type === 'pool' && value.isMultiImage && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-purple-400">
            Multi-image ({value.gridSize === 4 ? '2×2' : '3×3'})
          </span>
        )}
      </label>
      <div
        role="button"
        tabIndex={0}
        onClick={() => { setShow(!show); setFrameSearchQuery(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShow(!show); setFrameSearchQuery(''); } }}
        className={`w-full flex items-center gap-2 px-3 py-2 bg-slate-800/50 border rounded-lg text-sm text-left transition-colors cursor-pointer ${
          dragOverFrame === side ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-amber-500/20 hover:border-amber-500/40'
        }`}
      >
        {value ? (
          <>
            <img src={value.url} alt="" className="w-8 h-6 object-cover rounded" />
            <span className="text-amber-100 truncate flex-1">{value.label}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="p-0.5 hover:bg-slate-700 rounded"
            >
              <X size={12} className="text-slate-400" />
            </button>
          </>
        ) : (
          <>
            <AtSign size={14} className="text-slate-500" />
            <span className="text-slate-500">Select {side} frame...</span>
          </>
        )}
      </div>

      {show && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-amber-500/30 bg-slate-900/95 backdrop-blur-md shadow-2xl">
          <div className="p-2 border-b border-slate-700">
            <input
              type="text"
              value={frameSearchQuery}
              onChange={(e) => setFrameSearchQuery(e.target.value)}
              placeholder="Search images..."
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/40"
              autoFocus
            />
          </div>
          {filteredImages.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-xs">No images available</div>
          ) : (
            filteredImages.map(img => (
              <button
                key={img.id}
                type="button"
                onClick={() => { onChange(img); setShow(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-amber-500/20 transition-colors"
              >
                <img src={img.url} alt="" className="w-10 h-7 object-cover rounded border border-slate-700" />
                <span className="text-amber-100 truncate">{img.label}</span>
                <span className={`ml-auto text-[9px] uppercase tracking-wider ${img.type === 'storyboard' ? 'text-cyan-400' : img.type === 'gallery' ? 'text-emerald-400' : 'text-purple-400'}`}>
                  {img.type}{img.type === 'pool' && img.isMultiImage ? ` ${img.gridSize === 4 ? '2×2' : '3×3'}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  // Project picker
  if (!selectedProject) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
                  <Film className="text-slate-900" size={18} />
                </div>
                <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Storyshot Creator</span>
              </Link>
              <div className="w-px h-5 bg-slate-700" />
              <div className="flex items-center gap-1.5 text-purple-400">
                <Video size={16} />
                <span className="font-semibold text-sm">Director</span>
              </div>
            </div>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> Back to Studio
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
              <Video size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Director&apos;s Chair</h1>
            <p className="text-slate-400">Select a project to start creating videos from your storyboard</p>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FolderOpen size={40} className="mx-auto mb-3 opacity-50" />
                <p>No projects found. Create a project in the Studio first.</p>
              </div>
            ) : (
              projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="w-full flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-purple-500/50 hover:bg-slate-800/80 transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-700/50 flex items-center justify-center">
                    <Clapperboard size={20} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><ImageIcon size={10} /> {(p.storyboardImages?.length || 0) + (p.galleryImages?.length || 0)} images</span>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-slate-600 rotate-180" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const activeVideos = videos.filter(v => !v.deleted);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navbar */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
                <Film className="text-slate-900" size={18} />
              </div>
              <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Storyshot Creator</span>
            </Link>
            <div className="w-px h-5 bg-slate-700" />
            <div className="flex items-center gap-1.5 text-purple-400">
              <Video size={16} />
              <span className="font-semibold text-sm">Director</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/15 border border-purple-500/25 rounded-md text-purple-400 text-xs font-medium">
              <Clapperboard size={12} />
              <span className="max-w-[120px] truncate">{selectedProject.name}</span>
              <button onClick={() => setSelectedProject(null)} className="ml-0.5 p-0.5 hover:bg-purple-500/20 rounded">
                <X size={10} />
              </button>
            </div>
            {config?.selectedModel && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-md text-slate-400 text-xs">
                <Sparkles size={10} className="text-amber-400" />
                {config.selectedModel.name}
              </div>
            )}
            <button
              onClick={() => { setShowTrash(!showTrash); if (!showTrash) { loadTrashedVideos(); loadTrashedPoolImages(); } }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showTrash ? 'bg-red-500/20 text-red-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Trash</span>
            </button>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft size={14} /> <span className="hidden sm:inline">Studio</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-6">
        {/* No model warning */}
        {config && !config.selectedModelId && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-200 font-medium text-sm">No Video Model Configured</p>
              <p className="text-amber-300/60 text-xs mt-1">
                Go to <Link href="/admin/gemini" className="underline hover:text-amber-200">Admin → API Configuration</Link> and select a Video Generation model.
              </p>
            </div>
          </div>
        )}

        {/* Video Preview Section */}
        <div className="mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {/* Preview Screen */}
            <div className="relative bg-black aspect-video max-h-[500px] flex items-center justify-center">
              {selectedVideo?.videoUrl ? (
                <video
                  ref={videoRef}
                  src={selectedVideo.videoUrl}
                  className="w-full h-full object-contain"
                  onLoadedMetadata={handleVideoLoaded}
                  onEnded={() => {
                    if (playMode === 'single') setIsPlaying(false);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => { if (playMode === 'single') setIsPlaying(false); }}
                  muted={isMuted}
                  playsInline
                />
              ) : (
                <div className="text-center text-slate-600">
                  <Video size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a video from the Shot Box to preview</p>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800">
              <div className="flex items-center gap-3">
                {/* Play controls */}
                <button onClick={togglePlay} className="p-2 rounded-lg hover:bg-slate-800 text-white transition-colors" disabled={!selectedVideo?.videoUrl}>
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
                  <SkipBack size={14} />
                </button>
                <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = totalDuration; }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
                  <SkipForward size={14} />
                </button>

                {/* Scrub bar */}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-10 text-right font-mono">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={totalDuration || 1}
                    step={0.01}
                    value={currentTime}
                    onChange={handleScrub}
                    className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                    style={{
                      background: `linear-gradient(to right, rgb(168,85,247) ${(currentTime / (totalDuration || 1)) * 100}%, rgb(51,65,85) ${(currentTime / (totalDuration || 1)) * 100}%)`,
                    }}
                  />
                  <span className="text-xs text-slate-400 w-10 font-mono">{formatTime(totalDuration)}</span>
                </div>

                {/* Volume */}
                <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors">
                  {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>

                {/* Sequence Play */}
                <div className="w-px h-5 bg-slate-700" />
                <button
                  onClick={playSequence}
                  disabled={enabledVideos.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-40"
                >
                  <Play size={12} /> Sequence
                </button>

                {/* Render */}
                <button
                  onClick={handleRenderSequence}
                  disabled={enabledVideos.length === 0 || isRendering}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                >
                  {isRendering ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  {isRendering ? 'Rendering...' : 'Render'}
                </button>
              </div>

              {/* Sequence info */}
              {enabledVideos.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{enabledVideos.length} clips in sequence</span>
                  <span>•</span>
                  <span>Total: {formatTime(sequenceDuration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Builder + Shot Box side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Prompt Builder */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Sparkles size={14} className="text-purple-400" />
                Video Prompt
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-amber-300/70 mb-1 block">Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the video scene you want to create..."
                    rows={4}
                    className="w-full px-3 py-2.5 bg-slate-800/50 border border-amber-500/20 rounded-xl text-amber-50 text-sm placeholder-amber-500/40 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                  />
                </div>

                {/* Start Frame */}
                {config?.supportsStartFrame && (
                  <FrameDropdown
                    label="Start Frame (@ Reference)"
                    value={startFrameRef}
                    onChange={setStartFrameRef}
                    show={showStartFrameDropdown}
                    setShow={setShowStartFrameDropdown}
                    side="start"
                  />
                )}

                {/* End Frame */}
                {config?.supportsEndFrame && (
                  <FrameDropdown
                    label="End Frame (@ Reference)"
                    value={endFrameRef}
                    onChange={setEndFrameRef}
                    show={showEndFrameDropdown}
                    setShow={setShowEndFrameDropdown}
                    side="end"
                  />
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating || !config?.selectedModelId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                  {isGenerating ? (
                    <><Loader2 size={16} className="animate-spin" /> Generating...</>
                  ) : (
                    <><Send size={16} /> Generate Video</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Shot Box / Image Box Tabs */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
                  <button
                    onClick={() => setRightTab('shot')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      rightTab === 'shot' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film size={13} />
                    Shot Box
                    <span className="text-[10px] text-slate-500">{activeVideos.length}</span>
                  </button>
                  <button
                    onClick={() => setRightTab('image')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      rightTab === 'image' ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon size={13} />
                    Image Box
                    <span className="text-[10px] text-slate-500">{poolImages.length}</span>
                  </button>
                </div>
                {rightTab === 'image' && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showHiddenImages}
                        onChange={(e) => setShowHiddenImages(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/30"
                      />
                      <span className="text-[10px] text-slate-400">Show hidden</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handlePoolUpload(e.target.files)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPool}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                      {uploadingPool ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      Upload
                    </button>
                  </div>
                )}
              </div>

              {rightTab === 'image' ? (
                showTrash ? (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trash2 size={14} className="text-red-400" />
                      <span className="text-sm font-medium text-red-300">Image Trash</span>
                      <span className="text-[10px] text-slate-500">(auto-deleted after 7 days)</span>
                    </div>
                    {trashedPoolImages.length === 0 ? (
                      <div className="text-center py-8 text-slate-600 text-sm">Image trash is empty</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {trashedPoolImages.map(p => {
                          const days = daysRemaining(p.deletedAt);
                          return (
                            <div key={p.id} className="bg-slate-800/50 border border-red-500/20 rounded-xl p-2">
                              <div className="aspect-video bg-black rounded-lg mb-2 overflow-hidden">
                                <img src={normalizePoolImageUrl(p.imagePath)} alt="" className="w-full h-full object-cover" />
                              </div>
                              <p className="text-[10px] text-slate-500 truncate mb-1">{p.label}</p>
                              <p className="text-[9px] text-red-400/60 mb-2 flex items-center gap-1">
                                <Clock size={8} /> {days} day{days !== 1 ? 's' : ''} remaining
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => restorePoolImage(p.id)}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-medium hover:bg-emerald-500/30"
                                >
                                  <RotateCcw size={10} /> Restore
                                </button>
                                <button
                                  onClick={() => permanentDeletePoolImage(p.id)}
                                  className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-500/30"
                                  title="Permanently delete"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : visiblePoolImages.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
                    {poolImages.length > 0 && !showHiddenImages ? (
                      <>
                        <p className="text-sm">All images are hidden.</p>
                        <p className="text-[10px] mt-1">Check &quot;Show hidden&quot; to see them.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm">No images yet. Upload images to use as references.</p>
                        <p className="text-[10px] mt-1">Drag images from here onto Start/End Frame slots.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visiblePoolImages.map(p => {
                      const ref: ImageRef = {
                        id: `pool-${p.id}`, url: normalizePoolImageUrl(p.imagePath), label: p.label || p.fileName, type: 'pool',
                        poolId: p.id, isMultiImage: p.isMultiImage, gridSize: p.gridSize,
                      };
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/json', JSON.stringify(ref));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className={`bg-slate-800/50 border rounded-xl p-2 cursor-grab active:cursor-grabbing transition-colors ${
                            p.isMultiImage ? 'border-purple-500/40 ring-1 ring-purple-500/20' : 'border-slate-700/50 hover:border-slate-600'
                          } ${p.hidden ? 'opacity-50' : ''}`}
                        >
                          <div className="relative aspect-video bg-black rounded-lg mb-2 overflow-hidden group">
                            <img src={normalizePoolImageUrl(p.imagePath)} alt={p.label} className="w-full h-full object-cover" />
                            {p.isMultiImage && (
                              <div className="absolute top-1 right-1 bg-purple-500/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                {p.gridSize === 4 ? '2×2' : '3×3'}
                              </div>
                            )}
                            <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/60 ${
                                p.source === 'storyboard' ? 'text-cyan-300' : p.source === 'gallery' ? 'text-emerald-300' : 'text-purple-300'
                              }`}>{p.source === 'storyboard' ? 'Shot' : p.source === 'gallery' ? 'Gallery' : 'Upload'}</span>
                            </div>
                            {p.hidden && (
                              <div className="absolute bottom-1 right-1 bg-amber-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <EyeOff size={8} /> Hidden
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mb-2 px-1">{p.label}</p>
                          <div className="flex items-center gap-1 px-1">
                            <button
                              onClick={() => togglePoolMulti(p.id, p.gridSize === 4 ? 0 : 4)}
                              className={`p-1 rounded hover:bg-slate-700 transition-colors ${p.gridSize === 4 ? 'bg-purple-500/30' : ''}`}
                              title="Toggle 2×2 multi-image"
                            >
                              <Grid2x2 size={12} className={p.gridSize === 4 ? 'text-purple-300' : 'text-slate-400'} />
                            </button>
                            <button
                              onClick={() => togglePoolMulti(p.id, p.gridSize === 9 ? 0 : 9)}
                              className={`p-1 rounded hover:bg-slate-700 transition-colors ${p.gridSize === 9 ? 'bg-purple-500/30' : ''}`}
                              title="Toggle 3×3 multi-image"
                            >
                              <Grid3x3 size={12} className={p.gridSize === 9 ? 'text-purple-300' : 'text-slate-400'} />
                            </button>
                            <button
                              onClick={() => toggleHidePool(p.id)}
                              className={`p-1 rounded hover:bg-slate-700 transition-colors ${p.hidden ? 'bg-slate-700/50' : ''}`}
                              title={p.hidden ? 'Unhide' : 'Hide'}
                            >
                              {p.hidden ? <EyeOff size={12} className="text-amber-400" /> : <Eye size={12} className="text-slate-400" />}
                            </button>
                            <button
                              onClick={() => softDeletePool(p.id)}
                              className="p-1 rounded hover:bg-slate-700 transition-colors ml-auto"
                              title="Delete to trash"
                            >
                              <Trash2 size={12} className="text-red-400/60 hover:text-red-400" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : showTrash ? (
                // Trash view
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Trash2 size={14} className="text-red-400" />
                    <span className="text-sm font-medium text-red-300">Video Trash</span>
                    <span className="text-[10px] text-slate-500">(auto-deleted after 7 days)</span>
                  </div>
                  {trashedVideos.length === 0 ? (
                    <div className="text-center py-8 text-slate-600 text-sm">Video trash is empty</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {trashedVideos.map(v => {
                        const days = daysRemaining(v.deletedAt);
                        return (
                          <div key={v.id} className="bg-slate-800/50 border border-red-500/20 rounded-xl p-3">
                            <div className="aspect-video bg-black rounded-lg mb-2 flex items-center justify-center">
                              {v.videoUrl ? (
                                <video src={`${v.videoUrl}#t=0.5`} className="w-full h-full object-contain rounded-lg" muted playsInline preload="metadata" />
                              ) : (
                                <Video size={20} className="text-slate-700" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mb-1">{v.prompt}</p>
                            <p className="text-[9px] text-red-400/60 mb-2 flex items-center gap-1">
                              <Clock size={8} /> {days} day{days !== 1 ? 's' : ''} remaining
                            </p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => restoreVideo(v.id)}
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-medium hover:bg-emerald-500/30"
                              >
                                <RotateCcw size={10} /> Restore
                              </button>
                              <button
                                onClick={() => permanentDeleteVideo(v.id)}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-500/30"
                                title="Permanently delete"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // Active videos
                activeVideos.length === 0 ? (
                  <div className="text-center py-12 text-slate-600">
                    <Film size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No videos yet. Generate your first video above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeVideos.map((v, idx) => (
                      <div
                        key={v.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', v.id);
                          e.dataTransfer.effectAllowed = 'move';
                          (e.currentTarget as HTMLElement).style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderTopColor = 'rgb(168 85 247)';
                          el.style.borderTopWidth = '2px';
                        }}
                        onDragLeave={(e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderTopColor = '';
                          el.style.borderTopWidth = '';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderTopColor = '';
                          el.style.borderTopWidth = '';
                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (!draggedId || draggedId === v.id) return;
                          const newOrder = [...activeVideos];
                          const fromIdx = newOrder.findIndex(x => x.id === draggedId);
                          if (fromIdx === -1) return;
                          const [moved] = newOrder.splice(fromIdx, 1);
                          const toIdx = newOrder.findIndex(x => x.id === v.id);
                          newOrder.splice(toIdx, 0, moved);
                          handleReorder(newOrder);
                        }}
                        className={`flex items-center gap-3 bg-slate-800/50 border rounded-xl p-2 transition-colors ${
                          selectedVideoId === v.id ? 'border-purple-500/50 ring-1 ring-purple-500/20' : 'border-slate-700/50 hover:border-slate-600'
                        } ${!v.enabled ? 'opacity-50' : ''}`}
                      >
                        {/* Drag handle + index */}
                        <div className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing flex-shrink-0">
                          <GripVertical size={14} className="text-slate-500" />
                          <span className="text-[9px] text-slate-600 font-mono">{idx + 1}</span>
                        </div>

                        {/* Video thumbnail */}
                        <div
                          className="relative w-32 aspect-video bg-black rounded-lg cursor-pointer overflow-hidden group flex-shrink-0"
                          onClick={() => {
                            setSelectedVideoId(v.id);
                            setPlayMode('single');
                          }}
                        >
                          {v.status === 'generating' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Loader2 size={16} className="text-purple-400 animate-spin" />
                              <span className="text-[8px] text-purple-300 mt-0.5">Generating...</span>
                            </div>
                          ) : v.status === 'failed' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-1" title={v.errorMessage || 'Generation failed'}>
                              <AlertCircle size={14} className="text-red-400" />
                              <span className="text-[8px] text-red-300 mt-0.5">Failed</span>
                            </div>
                          ) : v.videoUrl ? (
                            <video
                              src={`${v.videoUrl}#t=0.5`}
                              className="w-full h-full object-contain"
                              preload="metadata"
                              muted
                              playsInline
                            />
                          ) : null}

                          {/* Play overlay */}
                          {v.status === 'ready' && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play size={16} className="text-white" />
                            </div>
                          )}

                          {/* Trim indicators */}
                          {(v.inPoint > 0 || (v.outPoint > 0 && v.outPoint < v.duration)) && (
                            <div className="absolute bottom-0.5 left-0.5 flex items-center gap-0.5 bg-black/60 rounded px-1 py-0.5">
                              <Scissors size={7} className="text-amber-400" />
                              <span className="text-[7px] text-amber-300">
                                {formatTime(v.inPoint)}-{formatTime(v.outPoint || v.duration)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Prompt + info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-300 truncate">{v.prompt}</p>
                          {v.status === 'failed' && v.errorMessage && (
                            <p className="text-[9px] text-red-400/70 truncate mt-0.5">{v.errorMessage}</p>
                          )}
                          {v.duration > 0 && (
                            <p className="text-[9px] text-slate-600 mt-0.5">{formatTime(v.duration)}</p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => toggleEnable(v.id)} className="p-1.5 rounded hover:bg-slate-700 transition-colors" title={v.enabled ? 'Disable' : 'Enable'}>
                            {v.enabled ? <Eye size={12} className="text-emerald-400" /> : <EyeOff size={12} className="text-slate-500" />}
                          </button>
                          <button onClick={() => openTrim(v)} className="p-1.5 rounded hover:bg-slate-700 transition-colors" title="Trim">
                            <Scissors size={12} className="text-slate-400" />
                          </button>
                          <button onClick={() => rerender(v.id)} className="p-1.5 rounded hover:bg-slate-700 transition-colors" title="Re-render">
                            <RefreshCw size={12} className="text-slate-400" />
                          </button>
                          {v.videoUrl && (
                            <a href={v.videoUrl} download className="p-1.5 rounded hover:bg-slate-700 transition-colors" title="Download">
                              <Download size={12} className="text-slate-400" />
                            </a>
                          )}
                          <button onClick={() => softDelete(v.id)} className="p-1.5 rounded hover:bg-slate-700 transition-colors" title="Delete">
                            <Trash2 size={12} className="text-red-400/60 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generation Progress Dialog */}
      <AnimatePresence>
        {showGenDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                  <Sparkles size={16} className="text-purple-400" />
                  {isGenerating ? 'Generating…' : genTasks.every(t => t.status === 'done') ? 'Complete!' : 'Generation finished'}
                </h3>
                {!isGenerating && (
                  <button onClick={() => setShowGenDialog(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
                    <X size={14} className="text-slate-400" />
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto">
                {genTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {task.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                      {task.status === 'generating' && <Loader2 size={16} className="text-purple-400 animate-spin" />}
                      {task.status === 'done' && <Check size={16} className="text-emerald-400" />}
                      {task.status === 'failed' && <AlertCircle size={16} className="text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${task.status === 'done' ? 'text-emerald-300' : task.status === 'failed' ? 'text-red-300' : task.status === 'generating' ? 'text-white' : 'text-slate-500'}`}>
                        {task.label}
                      </p>
                      {task.error && (
                        <p className="text-[10px] text-red-400/80 mt-0.5 line-clamp-2">{task.error}</p>
                      )}
                      {task.status === 'generating' && (
                        <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                            initial={{ width: '5%' }}
                            animate={{ width: '90%' }}
                            transition={{ duration: 60, ease: 'linear' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary bar */}
              {genTasks.length > 1 && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">
                    {genTasks.filter(t => t.status === 'done').length}/{genTasks.length} completed
                  </span>
                  {genTasks.some(t => t.status === 'failed') && (
                    <span className="text-red-400">{genTasks.filter(t => t.status === 'failed').length} failed</span>
                  )}
                </div>
              )}

              {!isGenerating && (
                <button
                  onClick={() => setShowGenDialog(false)}
                  className="mt-4 w-full px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trim Modal */}
      <AnimatePresence>
        {editingTrimId && (() => {
          const video = videos.find(v => v.id === editingTrimId);
          if (!video) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
              onClick={() => setEditingTrimId(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full"
              >
                <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Scissors size={16} className="text-amber-400" /> Trim Video
                </h3>
                <p className="text-xs text-slate-500 truncate mb-4">{video.prompt}</p>

                {video.videoUrl && (
                  <div className="aspect-video bg-black rounded-lg mb-4 overflow-hidden">
                    <video src={video.videoUrl} className="w-full h-full object-contain" controls />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">In Point (seconds)</label>
                    <input
                      type="number"
                      value={trimIn}
                      onChange={(e) => setTrimIn(Math.max(0, parseFloat(e.target.value) || 0))}
                      step={0.1}
                      min={0}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Out Point (seconds)</label>
                    <input
                      type="number"
                      value={trimOut}
                      onChange={(e) => setTrimOut(Math.max(trimIn, parseFloat(e.target.value) || 0))}
                      step={0.1}
                      min={trimIn}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Duration: {formatTime(trimOut - trimIn)}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingTrimId(null)}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveTrim}
                      className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-1.5"
                    >
                      <Check size={14} /> Save
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
