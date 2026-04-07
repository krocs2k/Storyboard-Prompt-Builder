'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { 
  Palette, Frame, Sun, Camera, Sparkles, FileText, Copy, Check, 
  Trash2, Film, Aperture, Image as ImageIcon, Save, History,
  FolderOpen, Plus, Download, Loader2, Clapperboard, Upload,
  LayoutGrid, Users, MapPin, ChevronDown, X, FolderPlus, Edit3, Grid3X3, Mic, RefreshCw,
  LogOut, Settings, User, Star, AtSign, Maximize2, ZoomIn, ChevronLeft, ChevronRight, Heart
} from 'lucide-react';
import { SectionCard } from './section-card';
import { SelectionButton } from './selection-button';
import { SelectionModal } from './selection-modal';
import { TextInput } from './text-input';
import { DropdownSelect } from './dropdown-select';
import ScreenplayCreator from './screenplay-creator';
import ScreenplayAnalyzer from './screenplay-analyzer';
import ImageGridCutter from './image-grid-cutter';
import StoryboardViewer from './storyboard-viewer';
import ImageGallery, { GalleryImageItem } from './image-gallery';
import ShotImageGallery from './shot-image-gallery';
import { PWAInstallButton } from './pwa-install-prompt';
import {
  imageTypes, shotTypes, lightingSources, cameraBodies, focalLengths,
  lensTypes, filmStocks, aspectRatios, photographerStyles, movieStyles as defaultMovieStyles, filterEffects,
  ImageType, LightingSource, CameraBody, FocalLength, LensType, FilmStock,
  PhotographerStyle, MovieStyle, FilterEffect
} from '@/lib/data';
import { authFetch } from '@/lib/utils';
import {
  Project, ProjectFolder, Screenplay, Storyboard,
  CharacterPrompt, EnvironmentPrompt, StoryboardBlock, SelectionState, DialogueLine
} from '@/lib/types';

type ModalType = 'imageType' | 'shotType' | 'lighting' | 'camera' | 'focalLength' | 'lensType' | 'filmStock' | 'photographer' | 'movie' | 'filter' | null;

type ShotSelectionValue = 'single' | '4-shot' | '9-shot';

const SHOT_SELECTION_OPTIONS: { value: ShotSelectionValue; label: string; prefix: string }[] = [
  { value: 'single', label: 'Single Shot', prefix: 'Create a single shot of a cinematic film still ' },
  { value: '4-shot', label: '4 Shot Scene', prefix: 'Create a multi-shot of 4 cinematic film stills ' },
  { value: '9-shot', label: '9 Shot Scene', prefix: 'Create a multi-shot of 9 cinematic film stills ' },
];

function getShotSelectionPrefix(value: ShotSelectionValue): string {
  return SHOT_SELECTION_OPTIONS.find(o => o.value === value)?.prefix ?? SHOT_SELECTION_OPTIONS[2].prefix;
}

interface Selections {
  imageType: ImageType | null;
  shotType: { id: string; name: string } | null;
  shotSelection: ShotSelectionValue;
  subjectAction: string;
  environment: string;
  lighting: LightingSource | null;
  atmosphere: string;
  camera: CameraBody | null;
  focalLength: FocalLength | null;
  lensType: LensType | null;
  filmStock: FilmStock | null;
  aspectRatio: string;
  photographer: PhotographerStyle | null;
  movie: MovieStyle | null;
  filter: FilterEffect | null;
}

export function PromptBuilder() {
  const { data: session } = useSession() || {};
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Load resolved category data (with admin overrides) on mount
  const [resolvedMovieStyles, setResolvedMovieStyles] = useState<MovieStyle[]>(defaultMovieStyles);
  const [resolvedImageTypes, setResolvedImageTypes] = useState(imageTypes);
  const [resolvedShotTypes, setResolvedShotTypes] = useState(shotTypes);
  const [resolvedLightingSources, setResolvedLightingSources] = useState(lightingSources);
  const [resolvedCameraBodies, setResolvedCameraBodies] = useState(cameraBodies);
  const [resolvedFocalLengths, setResolvedFocalLengths] = useState(focalLengths);
  const [resolvedLensTypes, setResolvedLensTypes] = useState(lensTypes);
  const [resolvedFilmStocks, setResolvedFilmStocks] = useState(filmStocks);
  const [resolvedPhotographerStyles, setResolvedPhotographerStyles] = useState(photographerStyles);
  const [resolvedFilterEffects, setResolvedFilterEffects] = useState(filterEffects);

  useEffect(() => {
    // Fetch movie styles with overrides
    authFetch('/api/admin/movie-styles')
      .then(res => res.json())
      .then(data => {
        if (data.styles) setResolvedMovieStyles(data.styles);
      })
      .catch(() => { /* fallback to defaults */ });

    // Fetch all other category overrides
    authFetch('/api/categories/overrides')
      .then(res => res.json())
      .then((data: any) => {
        if (data.imageTypes) setResolvedImageTypes(data.imageTypes);
        if (data.shotTypes) setResolvedShotTypes(data.shotTypes);
        if (data.lightingSources) setResolvedLightingSources(data.lightingSources);
        if (data.cameraBodies) setResolvedCameraBodies(data.cameraBodies);
        if (data.focalLengths) setResolvedFocalLengths(data.focalLengths);
        if (data.lensTypes) setResolvedLensTypes(data.lensTypes);
        if (data.filmStocks) setResolvedFilmStocks(data.filmStocks);
        if (data.photographerStyles) setResolvedPhotographerStyles(data.photographerStyles);
        if (data.filterEffects) setResolvedFilterEffects(data.filterEffects);
      })
      .catch(() => { /* fallback to static defaults */ });
  }, []);
  
  const [selections, setSelections] = useState<Selections>({
    imageType: null,
    shotType: null,
    shotSelection: '9-shot',
    subjectAction: '',
    environment: '',
    lighting: null,
    atmosphere: '',
    camera: null,
    focalLength: null,
    lensType: null,
    filmStock: null,
    aspectRatio: '',
    photographer: null,
    movie: null,
    filter: null,
  });

  // Screenplay & Storyboard State
  const [showScreenplayCreator, setShowScreenplayCreator] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showGridCutter, setShowGridCutter] = useState(false);
  const [screenplay, setScreenplay] = useState<{
    title: string;
    content: string;
    runtime: number;
    characters: Array<{ name: string; description: string }>;
    environments: Array<{ name: string; description: string }>;
    sourceType: string;
    sourceUrl?: string;
    storyIdea?: string;
  } | null>(null);
  const [characterPrompts, setCharacterPrompts] = useState<CharacterPrompt[]>([]);
  const [environmentPrompts, setEnvironmentPrompts] = useState<EnvironmentPrompt[]>([]);
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [downloadingVO, setDownloadingVO] = useState<'docx' | 'csv' | null>(null);
  const [storyboard, setStoryboard] = useState<{
    blocks: StoryboardBlock[];
    shotlist: Record<string, Array<{ blockNumber: number; shotType: string; action: string; prompt: string }>>;
    summary?: { totalBlocks: number; estimatedRuntime: number; uniqueLocations: number; locations: string[] };
  } | null>(null);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [showStoryboardViewer, setShowStoryboardViewer] = useState(false);
  
  // Editable Constructed Prompt state
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [isPromptManuallyEdited, setIsPromptManuallyEdited] = useState(false);
  
  // Image generation from prompts
  const [generatingImageFor, setGeneratingImageFor] = useState<string | null>(null); // key like 'constructed', 'char-0', 'env-1'
  const [generatedImages, setGeneratedImages] = useState<Map<string, { base64: string; mimeType: string }>>(new Map());
  const [imageGenError, setImageGenError] = useState<string | null>(null);

  // Image Gallery state
  const [galleryImages, setGalleryImages] = useState<GalleryImageItem[]>([]);

  // Primary reference images for characters and environments
  // Key: "char:CharName" or "env:EnvName", Value: {base64, mimeType}
  const [primaryImages, setPrimaryImages] = useState<Map<string, { base64: string; mimeType: string; label: string }>>(new Map());

  // Storyboard shot gallery state
  const [shotLightbox, setShotLightbox] = useState<{ blockNum: number; imageIndex: number } | null>(null);
  const [upscalingShotId, setUpscalingShotId] = useState<string | null>(null);
  const [deletingShotId, setDeletingShotId] = useState<string | null>(null);

  // Project Management State
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  // Reset session - clears all state for a fresh start
  const resetSession = useCallback(() => {
    setSelections({
      imageType: null,
      shotType: null,
      shotSelection: '9-shot',
      subjectAction: '',
      environment: '',
      lighting: null,
      atmosphere: '',
      camera: null,
      focalLength: null,
      lensType: null,
      filmStock: null,
      aspectRatio: '',
      photographer: null,
      movie: null,
      filter: null,
    });
    setScreenplay(null);
    setCharacterPrompts([]);
    setEnvironmentPrompts([]);
    setDialogueLines([]);
    setStoryboard(null);
    setCurrentProject(null);
    setEditedPrompt('');
    setIsPromptManuallyEdited(false);
    setGeneratedImages(new Map());
    setImageGenError(null);
    setGalleryImages([]);
    setPrimaryImages(new Map());
  }, []);

  // Load folders and projects on mount
  useEffect(() => {
    loadFolders();
    loadProjects();
  }, []);

  const loadFolders = async () => {
    try {
      const res = await authFetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data);
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await authFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const res = await authFetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      if (res.ok) {
        setNewFolderName('');
        loadFolders();
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const saveProject = async () => {
    if (!newProjectName.trim() && !currentProject) return;
    setSavingProject(true);
    try {
      const projectData = {
        name: currentProject?.name || newProjectName,
        folderId: selectedFolderId,
        selections,
        screenplay: screenplay ? {
          title: screenplay.title,
          runtime: screenplay.runtime,
          content: screenplay.content,
          characters: screenplay.characters,
          environments: screenplay.environments,
          sourceType: screenplay.sourceType,
          sourceUrl: screenplay.sourceUrl,
          storyIdea: screenplay.storyIdea,
          characterPrompts,
          environmentPrompts,
        } : undefined,
        storyboard: storyboard ? {
          blocks: storyboard.blocks,
          shotlist: storyboard.shotlist,
          totalBlocks: storyboard.summary?.totalBlocks || storyboard.blocks.length,
          estimatedRuntime: storyboard.summary?.estimatedRuntime || 15,
        } : undefined,
      };

      const res = await authFetch('/api/projects', {
        method: currentProject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProject ? { id: currentProject.id, ...projectData } : projectData),
      });

      if (res.ok) {
        const saved = await res.json();
        setCurrentProject(saved);
        setNewProjectName('');
        loadProjects();

        // Persist any unsaved (in-memory) gallery images
        const unsaved = galleryImages.filter(img => img.base64);
        if (unsaved.length > 0) {
          const persisted: GalleryImageItem[] = [];
          for (const img of unsaved) {
            try {
              const saveRes = await authFetch('/api/gallery-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId: saved.id,
                  imageKey: img.imageKey,
                  prompt: img.prompt,
                  label: img.label,
                  base64: img.base64,
                  mimeType: img.mimeType,
                  aspectRatio: img.aspectRatio,
                }),
              });
              const saveData = await saveRes.json();
              if (saveData.success && saveData.image) {
                persisted.push(saveData.image);
              }
            } catch { /* skip */ }
          }
          // Replace unsaved with persisted versions
          setGalleryImages(prev => {
            const saved2 = prev.filter(img => !img.base64);
            return [...persisted, ...saved2];
          });
        }
      }
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setSavingProject(false);
    }
  };

  const loadProject = async (project: Project) => {
    setCurrentProject(project);
    if (project.selections) {
      setSelections(project.selections as unknown as Selections);
    }
    if (project.screenplay) {
      setScreenplay({
        title: project.screenplay.title,
        content: project.screenplay.content,
        runtime: project.screenplay.runtime,
        characters: project.screenplay.characters as Array<{ name: string; description: string }>,
        environments: project.screenplay.environments as Array<{ name: string; description: string }>,
        sourceType: project.screenplay.sourceType,
        sourceUrl: project.screenplay.sourceUrl || undefined,
        storyIdea: project.screenplay.storyIdea || undefined,
      });
      if (project.screenplay.characterPrompts) {
        setCharacterPrompts(project.screenplay.characterPrompts as CharacterPrompt[]);
      }
      if (project.screenplay.environmentPrompts) {
        setEnvironmentPrompts(project.screenplay.environmentPrompts as EnvironmentPrompt[]);
      }
    }
    if (project.storyboard) {
      setStoryboard({
        blocks: project.storyboard.blocks as StoryboardBlock[],
        shotlist: project.storyboard.shotlist as Record<string, Array<{ blockNumber: number; shotType: string; action: string; prompt: string }>>,
        summary: {
          totalBlocks: project.storyboard.totalBlocks,
          estimatedRuntime: project.storyboard.estimatedRuntime,
          uniqueLocations: Object.keys(project.storyboard.shotlist as object).length,
          locations: Object.keys(project.storyboard.shotlist as object),
        },
      });
    }
    setShowProjectManager(false);

    // Load gallery images for this project
    try {
      const galleryRes = await authFetch(`/api/gallery-images?projectId=${project.id}`);
      const galleryData = await galleryRes.json();
      if (galleryData.images) {
        setGalleryImages(galleryData.images);
      }
    } catch (err) {
      console.error('Failed to load gallery images:', err);
      setGalleryImages([]);
    }
  };

  const generateCharacterEnvironmentPrompts = async () => {
    if (!screenplay) return;
    setGeneratingPrompts(true);
    try {
      const res = await authFetch('/api/screenplay/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenplay: screenplay.content,
          characters: screenplay.characters,
          environments: screenplay.environments,
          selections,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate prompts');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.status === 'completed' && parsed.prompts) {
                setCharacterPrompts(parsed.prompts.characterPrompts || []);
                setEnvironmentPrompts(parsed.prompts.environmentPrompts || []);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate prompts:', err);
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const generateStoryboard = async () => {
    if (!screenplay) return;
    setGeneratingStoryboard(true);
    try {
      const res = await authFetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenplay: screenplay.content,
          selections,
          runtime: screenplay.runtime,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate storyboard');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.status === 'completed' && parsed.storyboard) {
                setStoryboard(parsed.storyboard);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate storyboard:', err);
    } finally {
      setGeneratingStoryboard(false);
    }
  };

  const downloadAsDoc = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCharacterEnvironmentPrompts = () => {
    let content = 'CHARACTER AND ENVIRONMENT PROMPTS\n';
    content += '================================\n\n';
    content += 'CHARACTER PROMPTS\n';
    content += '-----------------\n\n';
    characterPrompts.forEach(cp => {
      content += `${cp.name}\n`;
      content += `${cp.prompt}\n\n`;
    });
    content += '\nENVIRONMENT PROMPTS\n';
    content += '-------------------\n\n';
    environmentPrompts.forEach(ep => {
      content += `${ep.name}\n`;
      content += `${ep.prompt}\n\n`;
    });
    downloadAsDoc(content, 'character-environment-prompts.doc');
  };

  const downloadScreenplay = () => {
    if (!screenplay) return;
    let content = `${screenplay.title.toUpperCase()}\n`;
    content += `${'='.repeat(screenplay.title.length)}\n\n`;
    content += `Title: ${screenplay.title}\n`;
    content += `Runtime: ${screenplay.runtime} minutes\n`;
    content += `Source: ${screenplay.sourceType === 'youtube' ? 'YouTube Testimonial' : 'Story Concept'}\n`;
    content += `\n${'='.repeat(50)}\n\n`;
    content += screenplay.content;
    downloadAsDoc(content, `${screenplay.title.replace(/[^a-zA-Z0-9]/g, '_')}_screenplay.doc`);
  };

  const downloadVoiceOver = async (format: 'docx' | 'csv') => {
    if (dialogueLines.length === 0) return;
    
    setDownloadingVO(format);
    try {
      if (format === 'docx') {
        const response = await authFetch('/api/screenplay/voiceover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dialogueLines,
            title: screenplay?.title || 'Screenplay',
          }),
        });

        if (!response.ok) throw new Error('Failed to download voice-over script');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(screenplay?.title || 'Screenplay').replace(/[^a-zA-Z0-9\s-]/g, '')}_VoiceOver.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Generate CSV
        const csvContent = [
          ['Character', 'Dialogue', 'Delivery Direction'].join(','),
          ...dialogueLines.map(line => [
            `"${line.character.replace(/"/g, '""')}"`,
            `"${line.dialogue.replace(/"/g, '""')}"`,
            `"${line.delivery.replace(/"/g, '""')}"`
          ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(screenplay?.title || 'Screenplay').replace(/[^a-zA-Z0-9\s-]/g, '')}_VoiceOver.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download voice-over script:', err);
    } finally {
      setDownloadingVO(null);
    }
  };

  // Get gallery images for a specific storyboard block
  const getBlockImages = useCallback((blockNumber: number): GalleryImageItem[] => {
    const imgKey = `storyboard-${blockNumber}`;
    return galleryImages.filter(img => img.imageKey === imgKey);
  }, [galleryImages]);

  // Get the favorite gallery image for a given imageKey (e.g. 'char-0', 'env-1')
  const getFavoriteImage = useCallback((imageKey: string): GalleryImageItem | undefined => {
    return galleryImages.find(img => img.imageKey === imageKey && img.isFavorite);
  }, [galleryImages]);

  // Get image src for gallery item
  const getShotImageSrc = useCallback((img: GalleryImageItem) => {
    if (img.base64) return `data:${img.mimeType || 'image/png'};base64,${img.base64}`;
    return `/api/images?path=${encodeURIComponent(img.imagePath)}`;
  }, []);

  // Upscale a storyboard shot image
  const upscaleShotImage = useCallback(async (img: GalleryImageItem) => {
    if (!img.id || img.base64) {
      alert('Please save the project first to upscale images.');
      return;
    }
    setUpscalingShotId(img.id);
    try {
      const res = await authFetch('/api/gallery-images/upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: img.id }),
      });
      const data = await res.json();
      if (data.success && data.image) {
        setGalleryImages(prev => prev.map(g => g.id === img.id ? { ...g, ...data.image } : g));
      } else {
        alert(data.error || 'Upscale failed');
      }
    } catch (err) {
      console.error('Upscale failed:', err);
      alert('Upscale failed. Please try again.');
    } finally {
      setUpscalingShotId(null);
    }
  }, []);

  // Delete a storyboard shot image
  const deleteShotImage = useCallback(async (img: GalleryImageItem) => {
    if (img.id && !img.base64) {
      setDeletingShotId(img.id);
      try {
        const res = await authFetch('/api/gallery-images', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: img.id }),
        });
        const data = await res.json();
        if (data.success) {
          setGalleryImages(prev => prev.filter(g => g.id !== img.id));
        }
      } catch (err) {
        console.error('Failed to delete image:', err);
      } finally {
        setDeletingShotId(null);
      }
    } else {
      setGalleryImages(prev => prev.filter(g => g !== img));
    }
    // Close lightbox if viewing this image
    if (shotLightbox) setShotLightbox(null);
  }, [shotLightbox]);

  // Download a storyboard shot image
  const downloadShotImage = useCallback((img: GalleryImageItem) => {
    const a = document.createElement('a');
    if (img.base64) {
      a.href = `data:${img.mimeType || 'image/png'};base64,${img.base64}`;
      a.download = img.label ? `${img.label.replace(/[^a-zA-Z0-9]/g, '_')}.png` : 'shot_image.png';
    } else {
      a.href = `/api/images?path=${encodeURIComponent(img.imagePath)}`;
      a.download = img.fileName || 'shot_image.png';
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const downloadStoryboard = () => {
    if (!storyboard) return;
    const storyTitle = screenplay?.title || 'STORYBOARD';
    let content = `${storyTitle.toUpperCase()} - STORYBOARD BLOCKS AND SHOTLIST\n`;
    content += `${'='.repeat(storyTitle.length + 35)}\n\n`;
    content += 'STORYBOARD BLOCKS\n';
    content += '-----------------\n\n';
    storyboard.blocks.forEach(block => {
      content += `BLOCK ${block.blockNumber || 'N/A'} (${block.timestampStart || '00:00'} - ${block.timestampEnd || '00:30'})\n`;
      content += `${'='.repeat(50)}\n`;
      content += `Scene: ${block.scene || 'N/A'}\n`;
      content += `Location: ${block.location || 'N/A'}\n\n`;
      
      // Section 2 & 3 breakdown (Constructed Prompt components)
      content += `--- SECTION 2: SUBJECT & FRAMING ---\n`;
      content += `Shot Type: ${block.shotType || 'N/A'}\n`;
      if (block.subjectAction) {
        content += `Subject & Action: ${block.subjectAction}\n`;
      } else if (block.action) {
        content += `Action: ${block.action}\n`;
      }
      if (block.environment) {
        content += `Environment: ${block.environment}\n`;
      }
      content += '\n';
      
      content += `--- SECTION 3: LIGHTING & MOOD ---\n`;
      content += `Lighting: ${block.lighting || 'N/A'}\n`;
      if (block.atmosphere) {
        content += `Atmosphere/Mood: ${block.atmosphere}\n`;
      }
      content += '\n';
      
      content += `--- CONSTRUCTED PROMPT ---\n`;
      content += `${block.prompt || 'No prompt generated'}\n`;
      
      if (block.notes) {
        content += `\n--- NOTES ---\n`;
        content += `${block.notes}\n`;
      }
      content += '\n\n';
    });
    content += '\nSHOTLIST BY LOCATION\n';
    content += '====================\n\n';
    Object.entries(storyboard.shotlist || {}).forEach(([location, shots]) => {
      content += `\n${(location || 'UNKNOWN').toUpperCase()}\n`;
      content += '-'.repeat((location || 'UNKNOWN').length) + '\n\n';
      (shots || []).forEach(shot => {
        content += `  Block ${shot.blockNumber || 'N/A'}: ${shot.shotType || 'N/A'}\n`;
        content += `  Action: ${shot.action || 'N/A'}\n`;
        content += `  Prompt: ${shot.prompt || 'No prompt'}\n\n`;
      });
    });
    downloadAsDoc(content, `${(screenplay?.title || 'storyboard').replace(/[^a-zA-Z0-9]/g, '_')}_storyboard_shotlist.doc`);
  };

  const updateSelection = useCallback(<K extends keyof Selections>(key: K, value: Selections[K]) => {
    setSelections((prev) => ({ ...(prev ?? {}), [key]: value }));
  }, []);

  const clearSelection = useCallback(<K extends keyof Selections>(key: K) => {
    setSelections((prev) => ({ ...(prev ?? {}), [key]: key === 'aspectRatio' || key === 'subjectAction' || key === 'environment' || key === 'atmosphere' ? '' : null }));
  }, []);

  // Section-specific reset functions
  const resetSection1 = useCallback(() => {
    setSelections((prev) => ({ ...(prev ?? {}), imageType: null, shotSelection: '9-shot' as ShotSelectionValue }));
  }, []);
  const resetSection2 = useCallback(() => {
    setSelections((prev) => ({ ...(prev ?? {}), subjectAction: '', shotType: null, environment: '' }));
  }, []);
  const resetSection3 = useCallback(() => {
    setSelections((prev) => ({ ...(prev ?? {}), lighting: null, atmosphere: '' }));
  }, []);
  const resetSection4 = useCallback(() => {
    setSelections((prev) => ({ ...(prev ?? {}), camera: null, focalLength: null, lensType: null, filmStock: null, aspectRatio: '' }));
  }, []);
  const resetSection5 = useCallback(() => {
    setSelections((prev) => ({ ...(prev ?? {}), photographer: null, movie: null, filter: null }));
  }, []);

  const clearAll = useCallback(() => {
    setSelections({
      imageType: null,
      shotType: null,
      shotSelection: '9-shot',
      subjectAction: '',
      environment: '',
      lighting: null,
      atmosphere: '',
      camera: null,
      focalLength: null,
      lensType: null,
      filmStock: null,
      aspectRatio: '',
      photographer: null,
      movie: null,
      filter: null,
    });
    setEditedPrompt('');
    setIsPromptManuallyEdited(false);
    setGeneratedImages(new Map());
    setImageGenError(null);
    setGalleryImages([]);
    setPrimaryImages(new Map());
  }, []);

  // Get filter style based on image type selection
  const filterStyle = useMemo(() => {
    if (!selections?.imageType) return 'Photorealistic';
    const name = selections?.imageType?.name ?? '';
    if (name?.includes('Anime') || name?.includes('Cartoon') || name?.includes('chibi')) {
      return 'Anime cel-shading style';
    }
    if (name?.includes('Comic')) {
      return 'Comic book style illustration';
    }
    return 'Photorealistic';
  }, [selections?.imageType]);

  // Build the constructed prompt from sections 1-5
  const buildPromptFromSelections = useCallback(() => {
    const parts: string[] = [];
    
    parts.push(getShotSelectionPrefix(selections?.shotSelection ?? '9-shot') + 'that tell a short story');
    
    // Image type
    if (selections?.imageType) {
      parts.push(`, a ${selections?.imageType?.name ?? ''} image of a`);
    }
    
    // Subject & action
    if (selections?.subjectAction) {
      parts.push(` ${selections?.subjectAction ?? ''}`);
    }
    
    // Environment
    if (selections?.environment) {
      parts.push(`, set in ${selections?.environment ?? ''}.`);
    }
    
    // Lighting source and atmosphere combined
    if (selections?.lighting) {
      parts.push(` The scene is illuminated by ${selections?.lighting?.name ?? ''}`);
      if (selections?.atmosphere) {
        parts.push(`, creating a ${selections?.atmosphere ?? ''} atmosphere.`);
      } else {
        parts.push('.');
      }
    } else if (selections?.atmosphere) {
      parts.push(` Creating a ${selections?.atmosphere ?? ''} atmosphere.`);
    }
    
    // Camera, lens, and film stock combined
    const cameraLensParts: string[] = [];
    if (selections?.camera) {
      cameraLensParts.push(`Captured with a ${selections?.camera?.name ?? ''} camera`);
    }
    if (selections?.focalLength || selections?.lensType) {
      const focalPart = selections?.focalLength?.name ?? '';
      const lensPart = selections?.lensType?.name ?? '';
      if (focalPart && lensPart) {
        cameraLensParts.push(`${focalPart} ${lensPart} lens`);
      } else if (lensPart) {
        cameraLensParts.push(`${lensPart} lens`);
      } else if (focalPart) {
        cameraLensParts.push(`${focalPart} lens`);
      }
    }
    if (selections?.filmStock) {
      cameraLensParts.push(`${selections?.filmStock?.name ?? ''} film`);
    }
    if (cameraLensParts.length > 0) {
      parts.push(` ${cameraLensParts.join(', ')}.`);
    }
    
    // Photographer style with description
    if (selections?.photographer) {
      parts.push(` In the style of photographer ${selections?.photographer?.name ?? ''} with ${selections?.photographer?.description ?? ''}.`);
    }
    
    // Movie look / aesthetic with description
    if (selections?.movie) {
      parts.push(` With the visual aesthetic of the movie ${selections?.movie?.name ?? ''} with ${selections?.movie?.description ?? ''}.`);
    }
    
    // Filter effects (supports multiple)
    if (selections?.filter) {
      parts.push(` Applied effects: ${selections?.filter?.name ?? ''}.`);
    }
    
    parts.push(' No blurred faces.');
    
    // Clean up duplicate punctuation only (not grammar correction)
    let result = parts?.join('') ?? '';
    result = result.replace(/\.+/g, '.'); // Multiple periods to single
    result = result.replace(/,+/g, ',');  // Multiple commas to single
    result = result.replace(/\s+/g, ' '); // Multiple spaces to single
    
    return result;
  }, [selections]);

  // Build a prompt from decomposed parts + current selections (mirrors server-side buildConstructedPromptTemplate)
  const buildPromptFromParts = useCallback((
    subject: string,
    environment: string,
    atmosphere: string,
  ): string => {
    const parts: string[] = [];
    parts.push(getShotSelectionPrefix(selections?.shotSelection ?? '9-shot') + 'that tell a short story');
    if (selections?.imageType) {
      parts.push(`, a ${selections.imageType.name} image of a`);
    }
    if (subject) {
      parts.push(` ${subject}`);
    }
    if (environment) {
      parts.push(`, set in ${environment}`);
    }
    if (selections?.lighting) {
      parts.push(`, illuminated by ${selections.lighting.name} with ${selections.lighting.description || ''}`);
    }
    if (atmosphere) {
      parts.push(`, creating an ${atmosphere} atmosphere and mood`);
    }
    if (selections?.camera) {
      parts.push(`. ${selections.camera.name} with ${selections.camera.description || ''}`);
    }
    if (selections?.focalLength || selections?.lensType) {
      const focalPart = selections?.focalLength?.name || '';
      const lensPart = selections?.lensType?.name || '';
      const lensDesc = selections?.lensType?.description || '';
      const lensCombined = [focalPart, lensPart].filter(Boolean).join(' ');
      if (lensCombined) {
        parts.push(`. ${lensCombined}${lensDesc ? ` with ${lensDesc}` : ''}`);
      }
    }
    if (selections?.filmStock) {
      parts.push(`. ${selections.filmStock.name} with ${selections.filmStock.description || ''}`);
    }
    if (selections?.photographer) {
      parts.push(`. In the style of photographer ${selections.photographer.name} with ${selections.photographer.description || ''}`);
    }
    if (selections?.movie) {
      parts.push(`. With the visual aesthetic of the movie ${selections.movie.name} with ${selections.movie.description || ''}`);
    }
    if (selections?.filter) {
      parts.push(`. Applied effects: ${selections.filter.name}, ${selections.filter.description || ''}`);
    }
    if (selections?.aspectRatio) {
      parts.push(`. Aspect ratio: ${selections.aspectRatio}`);
    }
    parts.push('. No blurred faces.');
    return parts.join('');
  }, [selections]);

  // The auto-generated constructed prompt from sections 1-5
  const constructedPrompt = useMemo(() => buildPromptFromSelections(), [buildPromptFromSelections]);

  // Sync editedPrompt with auto-generated when sections change (unless manually edited)
  useEffect(() => {
    if (!isPromptManuallyEdited) {
      setEditedPrompt(constructedPrompt);
    }
  }, [constructedPrompt, isPromptManuallyEdited]);

  // Dynamically rebuild character/environment prompts when selections change
  useEffect(() => {
    if (characterPrompts.length > 0) {
      setCharacterPrompts(prev => prev.map(cp => {
        if (cp.subjectDescription && cp.environmentDescription) {
          return {
            ...cp,
            prompt: buildPromptFromParts(
              cp.subjectDescription,
              cp.environmentDescription,
              cp.atmosphereDescription || '',
            )
          };
        }
        return cp;
      }));
    }
    if (environmentPrompts.length > 0) {
      setEnvironmentPrompts(prev => prev.map(ep => {
        if (ep.subjectDescription && ep.environmentDescription) {
          return {
            ...ep,
            prompt: buildPromptFromParts(
              ep.subjectDescription,
              ep.environmentDescription,
              ep.atmosphereDescription || '',
            )
          };
        }
        return ep;
      }));
    }
    // Also rebuild storyboard block prompts
    if (storyboard && storyboard.blocks.length > 0) {
      setStoryboard(prev => {
        if (!prev) return prev;
        const updatedBlocks = prev.blocks.map(block => {
          if (block.subjectAction && block.environment) {
            return {
              ...block,
              prompt: buildPromptFromParts(
                block.subjectAction,
                block.environment,
                block.atmosphere || '',
              )
            };
          }
          return block;
        });
        // Also update shotlist prompts
        const updatedShotlist: typeof prev.shotlist = {};
        for (const [location, shots] of Object.entries(prev.shotlist)) {
          updatedShotlist[location] = shots.map(shot => {
            const matchingBlock = updatedBlocks.find(b => b.blockNumber === shot.blockNumber);
            return matchingBlock ? { ...shot, prompt: matchingBlock.prompt } : shot;
          });
        }
        return { ...prev, blocks: updatedBlocks, shotlist: updatedShotlist };
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildPromptFromParts]);

  // ── Reference Image Helpers ──

  // Create a @Token from a name (e.g. "Sarah Connor" → "@Sarah_Connor")
  const makeRefToken = useCallback((name: string): string => {
    return '@' + name.trim().replace(/\s+/g, '_');
  }, []);

  // Get all available reference tokens and their primary images
  const availableRefTokens = useMemo(() => {
    const tokens: Array<{ token: string; key: string; label: string; role: 'character' | 'environment'; hasPrimary: boolean }> = [];
    characterPrompts.forEach((cp, i) => {
      const key = `char:${cp.name}`;
      tokens.push({
        token: makeRefToken(cp.name),
        key,
        label: cp.name,
        role: 'character',
        hasPrimary: primaryImages.has(key),
      });
    });
    environmentPrompts.forEach((ep, i) => {
      const key = `env:${ep.name}`;
      tokens.push({
        token: makeRefToken(ep.name),
        key,
        label: ep.name,
        role: 'environment',
        hasPrimary: primaryImages.has(key),
      });
    });
    return tokens;
  }, [characterPrompts, environmentPrompts, primaryImages, makeRefToken]);

  // Detect reference tokens in text and return matching reference images
  const detectReferenceImages = useCallback((subjectText: string, envText: string) => {
    const refs: Array<{ base64: string; mimeType: string; role: 'character' | 'environment'; label: string }> = [];
    const combinedText = `${subjectText} ${envText}`;

    for (const tok of availableRefTokens) {
      if (!tok.hasPrimary) continue;
      const img = primaryImages.get(tok.key);
      if (!img) continue;
      // Check if token appears in the combined text
      if (combinedText.includes(tok.token)) {
        refs.push({ base64: img.base64, mimeType: img.mimeType, role: tok.role, label: tok.label });
      }
    }
    return refs;
  }, [availableRefTokens, primaryImages]);

  // Set a primary image for a character/environment from a generated image
  const setPrimaryImageFromGenerated = useCallback((key: string, label: string, imageData: { base64: string; mimeType: string }) => {
    setPrimaryImages(prev => {
      const next = new Map(prev);
      next.set(key, { base64: imageData.base64, mimeType: imageData.mimeType, label });
      return next;
    });
  }, []);

  // Get ALL primary reference images (for storyboard generation)
  const getAllPrimaryRefImages = useCallback(() => {
    const refs: Array<{ base64: string; mimeType: string; role: 'character' | 'environment'; label: string }> = [];
    primaryImages.forEach((img, key) => {
      const role = key.startsWith('char:') ? 'character' as const : 'environment' as const;
      refs.push({ base64: img.base64, mimeType: img.mimeType, role, label: img.label });
    });
    return refs;
  }, [primaryImages]);

  // Clear a primary image
  const clearPrimaryImage = useCallback((key: string) => {
    setPrimaryImages(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // The active prompt is what's shown in Section 6 - either edited or auto-built
  const activePrompt = editedPrompt || constructedPrompt;

  // Generate image from any prompt text and add to gallery
  const generateImageFromPrompt = useCallback(async (
    promptText: string,
    imageKey: string,
    label?: string,
    explicitRefImages?: Array<{ base64: string; mimeType: string; role: string; label: string }>
  ) => {
    setGeneratingImageFor(imageKey);
    setImageGenError(null);
    try {
      // Use explicit refs if provided, otherwise detect @tokens from Section 2 fields
      const refImgs = explicitRefImages ?? detectReferenceImages(selections?.subjectAction ?? '', selections?.environment ?? '');
      const bodyPayload: Record<string, unknown> = {
        prompt: promptText,
        aspectRatio: selections?.aspectRatio || '16:9',
        movieStyleId: selections?.movie?.id || undefined,
      };
      if (refImgs.length > 0) {
        bodyPayload.referenceImages = refImgs;
      }
      const res = await authFetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Image generation failed (status ${res.status}). Please try again.`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed');

      const { base64, mimeType } = data.image;

      // Update inline preview
      setGeneratedImages(prev => {
        const newMap = new Map(prev);
        newMap.set(imageKey, data.image);
        return newMap;
      });

      // Add to gallery
      const galleryLabel = label || (imageKey === 'constructed' ? 'Constructed Prompt' : imageKey);
      if (currentProject?.id) {
        // Save to DB immediately if project exists
        try {
          const saveRes = await authFetch('/api/gallery-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: currentProject.id,
              imageKey,
              prompt: promptText,
              label: galleryLabel,
              base64,
              mimeType,
              aspectRatio: selections?.aspectRatio || '16:9',
            }),
          });
          const saveData = await saveRes.json();
          if (saveData.success && saveData.image) {
            setGalleryImages(prev => [saveData.image, ...prev]);
          }
        } catch (err) {
          console.error('Failed to save to gallery:', err);
        }
      } else {
        // In-memory only (unsaved project)
        const tempItem: GalleryImageItem = {
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          projectId: '',
          imageKey,
          prompt: promptText,
          label: galleryLabel,
          imagePath: '',
          fileName: '',
          aspectRatio: selections?.aspectRatio || '16:9',
          width: 0,
          height: 0,
          createdAt: new Date().toISOString(),
          base64,
          mimeType,
        };
        setGalleryImages(prev => [tempItem, ...prev]);
      }
    } catch (err) {
      console.error('Image generation failed:', err);
      setImageGenError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setGeneratingImageFor(null);
    }
  }, [selections?.aspectRatio, selections?.movie?.id, selections?.subjectAction, selections?.environment, currentProject?.id, detectReferenceImages]);

  const copyToClipboard = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activePrompt);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = activePrompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Try fallback even on error
      try {
        const textArea = document.createElement('textarea');
        textArea.value = activePrompt;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy also failed:', fallbackErr);
      }
    }
  };

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

  return (
    <div className="min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo & Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md">
                <Film className="text-slate-900" size={18} />
              </div>
              <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Storyshot Creator</span>
            </div>

            {/* Center Nav Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowScreenplayCreator(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Clapperboard size={16} />
                <span className="hidden md:inline">Screenplay</span>
              </button>
              <button
                onClick={() => setShowAnalyzer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Upload size={16} />
                <span className="hidden md:inline">Upload</span>
              </button>
              <button
                onClick={() => setShowProjectManager(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <FolderOpen size={16} />
                <span className="hidden md:inline">Projects</span>
              </button>
              <button
                onClick={() => setShowGridCutter(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Grid3X3 size={16} />
                <span className="hidden lg:inline">Grid Cutter</span>
              </button>
              <div className="w-px h-5 bg-slate-700 mx-1 hidden sm:block" />
              <button
                onClick={resetSession}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="New Session"
              >
                <RefreshCw size={15} />
                <span className="hidden lg:inline">New</span>
              </button>
            </div>

            {/* Right: Project + User */}
            <div className="flex items-center gap-3">
              {currentProject && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/15 border border-amber-500/25 rounded-md text-amber-400 text-xs font-medium">
                  <FileText size={12} />
                  <span className="max-w-[100px] truncate">{currentProject.name}</span>
                  <button
                    onClick={() => setCurrentProject(null)}
                    className="ml-0.5 p-0.5 hover:bg-amber-500/20 rounded"
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
              <PWAInstallButton />
              {session?.user && (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      {session.user.image ? (
                        <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <User size={14} className="text-slate-900" />
                      )}
                    </div>
                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-1.5 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-slate-700/60">
                          <p className="text-sm text-white font-medium truncate">{session.user.name || 'User'}</p>
                          <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
                        </div>
                        <div className="py-1">
                          {session.user.role === 'admin' && (
                            <Link
                              href="/admin"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                              onClick={() => setShowUserMenu(false)}
                            >
                              <Settings size={15} />
                              Administration
                            </Link>
                          )}
                          <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
                          >
                            <LogOut size={15} />
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-12">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Sections 1-3 */}
          <div className="space-y-6">
            {/* Section 1: Visual Representation Style */}
            <SectionCard title="Visual Representation Style" icon={Palette} sectionNumber={1} onReset={resetSection1}>
              <SelectionButton
                label="Image Type"
                value={selections?.imageType?.name ?? null}
                onClick={() => setActiveModal('imageType')}
                onClear={() => clearSelection('imageType')}
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400 tracking-wide uppercase">Shot Selection</label>
                <div className="relative">
                  <select
                    value={selections?.shotSelection ?? '9-shot'}
                    onChange={(e) => setSelections(prev => ({ ...prev, shotSelection: e.target.value as ShotSelectionValue }))}
                    className="w-full appearance-none bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 cursor-pointer transition-colors hover:bg-slate-800/80"
                  >
                    {SHOT_SELECTION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {SHOT_SELECTION_OPTIONS.find(o => o.value === (selections?.shotSelection ?? '9-shot'))?.prefix.trim()}
                </p>
              </div>
            </SectionCard>

            {/* Section 2: Subject and Framing */}
            <SectionCard title="Subject and Framing" icon={Frame} sectionNumber={2} onReset={resetSection2}>
              <TextInput
                label="Subject & Action"
                value={selections?.subjectAction ?? ''}
                onChange={(v) => updateSelection('subjectAction', v)}
                placeholder="Describe the subject and their action..."
                multiline
              />
              {/* Reference token chips for Subject */}
              {availableRefTokens.filter(t => t.role === 'character').length > 0 && (
                <div className="flex flex-wrap gap-1.5 -mt-1 mb-1">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1"><AtSign size={10} /> Refs:</span>
                  {availableRefTokens.filter(t => t.role === 'character').map(tok => (
                    <button
                      key={tok.key}
                      onClick={() => {
                        const current = selections?.subjectAction ?? '';
                        const tokenText = tok.token;
                        if (!current.includes(tokenText)) {
                          updateSelection('subjectAction', current ? `${current} ${tokenText}` : tokenText);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        tok.hasPrimary
                          ? (selections?.subjectAction ?? '').includes(tok.token)
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                          : 'bg-slate-700/50 text-slate-500 border border-slate-600/30 cursor-not-allowed'
                      }`}
                      disabled={!tok.hasPrimary}
                      title={tok.hasPrimary ? `Click to insert ${tok.token}` : `Generate & set a primary image for ${tok.label} first`}
                    >
                      {tok.hasPrimary && <Star size={8} className="fill-current" />}
                      {tok.token}
                    </button>
                  ))}
                </div>
              )}
              <SelectionButton
                label="Shot Type / Angle"
                value={selections?.shotType?.name ?? null}
                onClick={() => setActiveModal('shotType')}
                onClear={() => clearSelection('shotType')}
              />
              <TextInput
                label="Environment"
                value={selections?.environment ?? ''}
                onChange={(v) => updateSelection('environment', v)}
                placeholder="Describe the setting or location..."
              />
              {/* Reference token chips for Environment */}
              {availableRefTokens.filter(t => t.role === 'environment').length > 0 && (
                <div className="flex flex-wrap gap-1.5 -mt-1 mb-1">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1"><AtSign size={10} /> Refs:</span>
                  {availableRefTokens.filter(t => t.role === 'environment').map(tok => (
                    <button
                      key={tok.key}
                      onClick={() => {
                        const current = selections?.environment ?? '';
                        const tokenText = tok.token;
                        if (!current.includes(tokenText)) {
                          updateSelection('environment', current ? `${current} ${tokenText}` : tokenText);
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        tok.hasPrimary
                          ? (selections?.environment ?? '').includes(tok.token)
                            ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                          : 'bg-slate-700/50 text-slate-500 border border-slate-600/30 cursor-not-allowed'
                      }`}
                      disabled={!tok.hasPrimary}
                      title={tok.hasPrimary ? `Click to insert ${tok.token}` : `Generate & set a primary image for ${tok.label} first`}
                    >
                      {tok.hasPrimary && <Star size={8} className="fill-current" />}
                      {tok.token}
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Section 3: Lighting & Mood */}
            <SectionCard title="Lighting & Mood" icon={Sun} sectionNumber={3} onReset={resetSection3}>
              <SelectionButton
                label="Lighting Source"
                value={selections?.lighting?.name ?? null}
                onClick={() => setActiveModal('lighting')}
                onClear={() => clearSelection('lighting')}
              />
              <TextInput
                label="Atmosphere / Mood"
                value={selections?.atmosphere ?? ''}
                onChange={(v) => updateSelection('atmosphere', v)}
                placeholder="Describe the mood or atmosphere..."
              />
            </SectionCard>
          </div>

          {/* Right Column - Sections 4-5 */}
          <div className="space-y-6">
            {/* Section 4: Camera Gear */}
            <SectionCard title="Camera Gear" icon={Camera} sectionNumber={4} onReset={resetSection4}>
              <SelectionButton
                label="Camera Body"
                value={selections?.camera?.name ?? null}
                onClick={() => setActiveModal('camera')}
                onClear={() => clearSelection('camera')}
              />
              <SelectionButton
                label="Focal Length"
                value={selections?.focalLength?.name ?? null}
                onClick={() => setActiveModal('focalLength')}
                onClear={() => clearSelection('focalLength')}
              />
              <SelectionButton
                label="Lens Type"
                value={selections?.lensType?.name ?? null}
                onClick={() => setActiveModal('lensType')}
                onClear={() => clearSelection('lensType')}
              />
              <SelectionButton
                label="Film Stock"
                value={selections?.filmStock?.name ?? null}
                onClick={() => setActiveModal('filmStock')}
                onClear={() => clearSelection('filmStock')}
              />
              <DropdownSelect
                label="Aspect Ratio"
                options={aspectRatios ?? []}
                value={selections?.aspectRatio ?? ''}
                onChange={(v) => updateSelection('aspectRatio', v)}
              />
            </SectionCard>

            {/* Section 5: Style & Aesthetics */}
            <SectionCard title="Style & Aesthetics" icon={Sparkles} sectionNumber={5} onReset={resetSection5}>
              <SelectionButton
                label="Photographer Style"
                value={selections?.photographer?.name ?? null}
                onClick={() => setActiveModal('photographer')}
                onClear={() => clearSelection('photographer')}
              />
              <SelectionButton
                label="Movie Style"
                value={selections?.movie?.name ?? null}
                onClick={() => setActiveModal('movie')}
                onClear={() => clearSelection('movie')}
              />
              <SelectionButton
                label="Filter Effect"
                value={selections?.filter?.name ?? null}
                onClick={() => setActiveModal('filter')}
                onClear={() => clearSelection('filter')}
              />
            </SectionCard>
          </div>
        </div>

        {/* Section 6: Constructed Prompt (Editable) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <SectionCard title="Constructed Prompt" icon={FileText} sectionNumber={6}>
            {/* Manual edit indicator */}
            {isPromptManuallyEdited && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Edit3 size={14} className="text-amber-400" />
                <span className="text-amber-400 text-xs font-medium">Manually edited — changes to Sections 1-5 won&apos;t auto-update this prompt</span>
                <button
                  onClick={() => {
                    setIsPromptManuallyEdited(false);
                    setEditedPrompt(constructedPrompt);
                  }}
                  className="ml-auto text-xs text-cyan-400 hover:text-cyan-300 underline transition-colors"
                >
                  Rebuild from Sections
                </button>
              </div>
            )}
            <div className="bg-slate-950/50 rounded-xl border border-amber-500/20 p-1">
              <textarea
                value={editedPrompt || constructedPrompt}
                onChange={(e) => {
                  setEditedPrompt(e.target.value);
                  setIsPromptManuallyEdited(true);
                }}
                rows={6}
                className="w-full min-h-[150px] bg-transparent text-amber-100/90 leading-relaxed p-3 rounded-xl resize-y focus:outline-none focus:ring-1 focus:ring-amber-500/40 placeholder-slate-600"
                placeholder="Your constructed prompt will appear here based on Sections 1-5, or type your own..."
              />
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
                {copied ? 'Copied!' : 'Copy Prompt'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => generateImageFromPrompt(activePrompt, 'constructed')}
                disabled={generatingImageFor === 'constructed' || !activePrompt.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/20 transition-all"
              >
                {generatingImageFor === 'constructed' ? (
                  <><Loader2 size={20} className="animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles size={20} /> Generate Image</>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={clearAll}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-red-500/30 hover:border-red-500/50 text-red-400 font-medium rounded-xl transition-all"
              >
                <Trash2 size={20} />
                Clear All
              </motion.button>
            </div>
            {/* Generated Image Display for Constructed Prompt */}
            {generatedImages.has('constructed') && (
              <div className="mt-4 relative rounded-xl overflow-hidden border border-purple-500/30">
                <img
                  src={`data:${generatedImages.get('constructed')!.mimeType};base64,${generatedImages.get('constructed')!.base64}`}
                  alt="Generated from constructed prompt"
                  className="w-full max-h-[500px] object-contain bg-slate-950"
                />
                <button
                  onClick={() => {
                    setGeneratedImages(prev => {
                      const newMap = new Map(prev);
                      newMap.delete('constructed');
                      return newMap;
                    });
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600/80 rounded-lg transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            )}
            {imageGenError && generatingImageFor === null && !generatedImages.has('constructed') && (
              <p className="mt-2 text-red-400 text-sm">{imageGenError}</p>
            )}
          </SectionCard>
        </motion.div>

        {/* Image Gallery */}
        {galleryImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <div className="bg-slate-800/60 rounded-xl border border-purple-500/20 p-5">
              <ImageGallery
                projectId={currentProject?.id || null}
                images={galleryImages}
                onImagesChange={setGalleryImages}
              />
            </div>
          </motion.div>
        )}

        {/* Screenplay & Storyboard Section */}
        {screenplay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 space-y-6"
          >
            {/* Screenplay Info */}
            <div className="bg-slate-800 rounded-xl border border-purple-500/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                  <Clapperboard size={24} />
                  {screenplay.title}
                </h3>
                <span className="px-3 py-1 bg-purple-500/20 rounded-full text-purple-300 text-sm">
                  {screenplay.runtime} min
                </span>
              </div>
              
              {/* Download Screenplay Button - First action available */}
              <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">Screenplay Ready</h4>
                    <p className="text-slate-400 text-sm">Download the screenplay before proceeding to prompts.</p>
                  </div>
                  <button
                    onClick={downloadScreenplay}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-medium rounded-lg transition-all"
                  >
                    <Download size={18} /> Download Screenplay
                  </button>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                    <Users size={18} />
                    Characters ({screenplay.characters.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {screenplay.characters.map((char, i) => (
                      <div key={i} className="text-slate-300 text-sm">
                        <span className="font-medium">{char.name}</span>
                        <span className="text-slate-500"> - {char.description ? char.description.substring(0, 50) : 'No description'}...</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                    <MapPin size={18} />
                    Environments ({screenplay.environments.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {screenplay.environments.map((env, i) => (
                      <div key={i} className="text-slate-300 text-sm">
                        <span className="font-medium">{env.name}</span>
                        <span className="text-slate-500"> - {env.description ? env.description.substring(0, 50) : 'No description'}...</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Workflow Info */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <h4 className="text-amber-400 font-medium mb-2">Post-Upload Workflow</h4>
                <ol className="text-slate-300 text-sm space-y-1 list-decimal list-inside">
                  <li>Download Voice-Over Prompts for dialogue recording</li>
                  <li>Generate Character & Environment image prompts</li>
                  <li>Create Storyboard & Shotlist with visual prompts</li>
                </ol>
              </div>

              {/* Step 1: Voice-Over Prompts */}
              <div className="border-t border-slate-700 pt-6">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold">1</span>
                  Voice-Over Prompts
                </h4>
                <p className="text-slate-400 text-sm mb-4">Download dialogue lines with delivery directions for voice-over recording.</p>
                <div className="flex flex-wrap gap-3 mb-4">
                  <button
                    onClick={() => downloadVoiceOver('docx')}
                    disabled={downloadingVO !== null || dialogueLines.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium rounded-lg transition-all"
                  >
                    {downloadingVO === 'docx' ? (
                      <><Loader2 size={18} className="animate-spin" /> Downloading...</>
                    ) : (
                      <><Mic size={18} /> Download DOCX</>
                    )}
                  </button>
                  <button
                    onClick={() => downloadVoiceOver('csv')}
                    disabled={downloadingVO !== null || dialogueLines.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white disabled:text-slate-500 font-medium rounded-lg transition-all"
                  >
                    {downloadingVO === 'csv' ? (
                      <><Loader2 size={18} className="animate-spin" /> Downloading...</>
                    ) : (
                      <><Download size={18} /> Download CSV</>
                    )}
                  </button>
                </div>
                {dialogueLines.length > 0 && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <p className="text-slate-400 text-sm mb-2">{dialogueLines.length} dialogue lines extracted</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {dialogueLines.slice(0, 3).map((line, i) => (
                        <div key={i} className="text-xs">
                          <span className="text-pink-400 font-medium">{line.character}:</span>
                          <span className="text-slate-300 ml-2">{line.dialogue.substring(0, 60)}...</span>
                        </div>
                      ))}
                      {dialogueLines.length > 3 && (
                        <p className="text-slate-500 text-xs">+{dialogueLines.length - 3} more lines...</p>
                      )}
                    </div>
                  </div>
                )}
                {dialogueLines.length === 0 && (
                  <p className="text-slate-500 text-sm italic">No dialogue lines available. Upload a screenplay with dialogue.</p>
                )}
              </div>

              {/* Step 2: Character & Environment Prompts */}
              <div className="border-t border-slate-700 pt-6 mt-6">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold">2</span>
                  Character & Environment Prompts
                </h4>
                <p className="text-slate-400 text-sm mb-4">Generate detailed image prompts for all characters and environments based on your Section 1-5 configuration.</p>
                <div className="flex flex-wrap gap-3 mb-6">
                  <button
                    onClick={generateCharacterEnvironmentPrompts}
                    disabled={generatingPrompts}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium rounded-lg transition-all"
                  >
                    {generatingPrompts ? (
                      <><Loader2 size={18} className="animate-spin" /> Generating...</>
                    ) : (
                      <><Users size={18} /> Create Character & Environment Prompts</>
                    )}
                  </button>
                  {characterPrompts.length > 0 && (
                    <button
                      onClick={downloadCharacterEnvironmentPrompts}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all"
                    >
                      <Download size={18} /> Download Prompts
                    </button>
                  )}
                </div>
              </div>

              {/* Show Generated Character Prompts with Generate Image buttons */}
              {characterPrompts.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                  <h4 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                    <Users size={18} />
                    Character Prompts
                  </h4>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {characterPrompts.map((cp, i) => {
                      const imgKey = `char-${i}`;
                      return (
                        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              {primaryImages.has(`char:${cp.name}`) && (
                                <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-500/60 flex-shrink-0">
                                  <img
                                    src={`data:${primaryImages.get(`char:${cp.name}`)!.mimeType};base64,${primaryImages.get(`char:${cp.name}`)!.base64}`}
                                    alt="Primary ref"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <p className="text-purple-300 font-semibold text-sm">{cp.name}</p>
                              {primaryImages.has(`char:${cp.name}`) && (
                                <span className="text-[9px] text-amber-400 font-medium bg-amber-500/10 px-1 rounded">{makeRefToken(cp.name)}</span>
                              )}
                            </div>
                            <button
                              onClick={() => generateImageFromPrompt(cp.prompt, imgKey, `Character: ${cp.name}`)}
                              disabled={generatingImageFor === imgKey}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg transition-all"
                            >
                              {generatingImageFor === imgKey ? (
                                <><Loader2 size={12} className="animate-spin" /> Generating...</>
                              ) : (
                                <><Sparkles size={12} /> Generate</>
                              )}
                            </button>
                          </div>
                          <div className="relative group/prompt">
                            <p className="text-slate-400 text-xs leading-relaxed pr-8">{cp.prompt || 'No prompt'}</p>
                            {cp.prompt && (
                              <button
                                onClick={() => copyPromptText(cp.prompt, `char-prompt-${i}`)}
                                className="absolute top-0 right-0 p-1 text-slate-500 hover:text-purple-400 transition-colors opacity-0 group-hover/prompt:opacity-100"
                                title="Copy prompt"
                              >
                                {copiedPromptId === `char-prompt-${i}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>
                          {generatedImages.has(imgKey) && (() => {
                            const charKey = `char:${cp.name}`;
                            const isPrimary = primaryImages.has(charKey);
                            return (
                            <div className="mt-3 relative rounded-lg overflow-hidden border border-purple-500/20">
                              <img
                                src={`data:${generatedImages.get(imgKey)!.mimeType};base64,${generatedImages.get(imgKey)!.base64}`}
                                alt={`Generated image for ${cp.name}`}
                                className="w-full max-h-[300px] object-contain bg-slate-950"
                              />
                              <div className="absolute top-2 right-2 flex gap-1">
                                <button
                                  onClick={() => {
                                    if (isPrimary) {
                                      clearPrimaryImage(charKey);
                                    } else {
                                      setPrimaryImageFromGenerated(charKey, cp.name, generatedImages.get(imgKey)!);
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors ${isPrimary ? 'bg-amber-500/90 hover:bg-amber-600' : 'bg-slate-900/80 hover:bg-amber-500/80'}`}
                                  title={isPrimary ? 'Remove as primary reference' : 'Set as primary reference image'}
                                >
                                  <Star size={14} className={isPrimary ? 'text-white fill-white' : 'text-white'} />
                                </button>
                                <button
                                  onClick={() => {
                                    setGeneratedImages(prev => { const m = new Map(prev); m.delete(imgKey); return m; });
                                  }}
                                  className="p-1 bg-slate-900/80 hover:bg-red-600/80 rounded transition-colors"
                                >
                                  <X size={14} className="text-white" />
                                </button>
                              </div>
                              {isPrimary && (
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-500/90 text-white text-[10px] font-bold rounded flex items-center gap-1">
                                  <Star size={10} className="fill-white" /> PRIMARY REF
                                </div>
                              )}
                            </div>
                            );
                          })()}

                          {/* Favorite image from gallery */}
                          {(() => {
                            const favImg = getFavoriteImage(imgKey);
                            if (!favImg || generatedImages.has(imgKey)) return null;
                            return (
                              <div className="mt-3 relative rounded-lg overflow-hidden border border-rose-500/30 bg-slate-950">
                                <img
                                  src={`/api/images?path=${encodeURIComponent(favImg.imagePath)}`}
                                  alt={`Favorite for ${cp.name}`}
                                  className="w-full max-h-[300px] object-contain"
                                />
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-rose-500/90 text-white text-[10px] font-bold rounded flex items-center gap-1">
                                  <Heart size={10} className="fill-white" /> FAVORITE
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show Generated Environment Prompts with Generate Image buttons */}
              {environmentPrompts.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                  <h4 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                    <MapPin size={18} />
                    Environment Prompts
                  </h4>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {environmentPrompts.map((ep, i) => {
                      const imgKey = `env-${i}`;
                      return (
                        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700/50">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              {primaryImages.has(`env:${ep.name}`) && (
                                <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-500/60 flex-shrink-0">
                                  <img
                                    src={`data:${primaryImages.get(`env:${ep.name}`)!.mimeType};base64,${primaryImages.get(`env:${ep.name}`)!.base64}`}
                                    alt="Primary ref"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <p className="text-cyan-300 font-semibold text-sm">{ep.name}</p>
                              {primaryImages.has(`env:${ep.name}`) && (
                                <span className="text-[9px] text-amber-400 font-medium bg-amber-500/10 px-1 rounded">{makeRefToken(ep.name)}</span>
                              )}
                            </div>
                            <button
                              onClick={() => generateImageFromPrompt(ep.prompt, imgKey, `Environment: ${ep.name}`)}
                              disabled={generatingImageFor === imgKey}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg transition-all"
                            >
                              {generatingImageFor === imgKey ? (
                                <><Loader2 size={12} className="animate-spin" /> Generating...</>
                              ) : (
                                <><Sparkles size={12} /> Generate</>
                              )}
                            </button>
                          </div>
                          <div className="relative group/prompt">
                            <p className="text-slate-400 text-xs leading-relaxed pr-8">{ep.prompt || 'No prompt'}</p>
                            {ep.prompt && (
                              <button
                                onClick={() => copyPromptText(ep.prompt, `env-prompt-${i}`)}
                                className="absolute top-0 right-0 p-1 text-slate-500 hover:text-cyan-400 transition-colors opacity-0 group-hover/prompt:opacity-100"
                                title="Copy prompt"
                              >
                                {copiedPromptId === `env-prompt-${i}` ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                              </button>
                            )}
                          </div>
                          {generatedImages.has(imgKey) && (() => {
                            const envKey = `env:${ep.name}`;
                            const isPrimary = primaryImages.has(envKey);
                            return (
                            <div className="mt-3 relative rounded-lg overflow-hidden border border-cyan-500/20">
                              <img
                                src={`data:${generatedImages.get(imgKey)!.mimeType};base64,${generatedImages.get(imgKey)!.base64}`}
                                alt={`Generated image for ${ep.name}`}
                                className="w-full max-h-[300px] object-contain bg-slate-950"
                              />
                              <div className="absolute top-2 right-2 flex gap-1">
                                <button
                                  onClick={() => {
                                    if (isPrimary) {
                                      clearPrimaryImage(envKey);
                                    } else {
                                      setPrimaryImageFromGenerated(envKey, ep.name, generatedImages.get(imgKey)!);
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors ${isPrimary ? 'bg-amber-500/90 hover:bg-amber-600' : 'bg-slate-900/80 hover:bg-amber-500/80'}`}
                                  title={isPrimary ? 'Remove as primary reference' : 'Set as primary reference image'}
                                >
                                  <Star size={14} className={isPrimary ? 'text-white fill-white' : 'text-white'} />
                                </button>
                                <button
                                  onClick={() => {
                                    setGeneratedImages(prev => { const m = new Map(prev); m.delete(imgKey); return m; });
                                  }}
                                  className="p-1 bg-slate-900/80 hover:bg-red-600/80 rounded transition-colors"
                                >
                                  <X size={14} className="text-white" />
                                </button>
                              </div>
                              {isPrimary && (
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-amber-500/90 text-white text-[10px] font-bold rounded flex items-center gap-1">
                                  <Star size={10} className="fill-white" /> PRIMARY REF
                                </div>
                              )}
                            </div>
                            );
                          })()}

                          {/* Favorite image from gallery */}
                          {(() => {
                            const favImg = getFavoriteImage(imgKey);
                            if (!favImg || generatedImages.has(imgKey)) return null;
                            return (
                              <div className="mt-3 relative rounded-lg overflow-hidden border border-rose-500/30 bg-slate-950">
                                <img
                                  src={`/api/images?path=${encodeURIComponent(favImg.imagePath)}`}
                                  alt={`Favorite for ${ep.name}`}
                                  className="w-full max-h-[300px] object-contain"
                                />
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-rose-500/90 text-white text-[10px] font-bold rounded flex items-center gap-1">
                                  <Heart size={10} className="fill-white" /> FAVORITE
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Storyboard & Shotlist */}
              <div className="border-t border-slate-700 pt-6 mt-6">
                <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-sm font-bold">3</span>
                  Storyboard & Shotlist
                </h4>
                <p className="text-slate-400 text-sm mb-4">Generate 30-second storyboard blocks with detailed prompts, organized into a shotlist by location.</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={generateStoryboard}
                    disabled={generatingStoryboard}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:from-slate-600 disabled:to-slate-700 text-white font-medium rounded-lg transition-all"
                  >
                    {generatingStoryboard ? (
                      <><Loader2 size={18} className="animate-spin" /> Creating Storyboard...</>
                    ) : (
                      <><LayoutGrid size={18} /> Create Storyboard</>
                    )}
                  </button>
                  {storyboard && (
                    <button
                      onClick={downloadStoryboard}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all"
                    >
                      <Download size={18} /> Download Storyboard
                    </button>
                  )}
                </div>

                {/* Storyboard Preview */}
                {storyboard && (
                  <div className="mt-4 bg-slate-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-amber-400 font-medium">Storyboard Preview</h4>
                      <div className="flex items-center gap-3">
                        {primaryImages.size > 0 && (
                          <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                            <Star size={10} className="fill-current" /> {primaryImages.size} ref image{primaryImages.size !== 1 ? 's' : ''} active
                          </span>
                        )}
                        <span className="text-slate-400 text-sm">
                          {storyboard.blocks.length} blocks | {storyboard.summary?.uniqueLocations || Object.keys(storyboard.shotlist).length} locations
                        </span>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[700px] overflow-y-auto pr-1">
                      {storyboard.blocks.map((block, i) => {
                        const imgKey = `storyboard-${block.blockNumber}`;
                        const blockPrompt = block.prompt || `${block.subjectAction || block.action || ''}, set in ${block.environment || ''}`;
                        const blockImgs = getBlockImages(block.blockNumber);
                        const hasInlineOnly = generatedImages.has(imgKey) && blockImgs.length === 0;
                        // Track which image index is displayed in the mini-gallery
                        const displayCount = blockImgs.length + (hasInlineOnly ? 1 : 0);

                        return (
                          <div key={i} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-cyan-400 font-medium text-sm">Block {block.blockNumber}</span>
                              <span className="text-slate-500 text-xs">{block.timestampStart}</span>
                            </div>
                            <p className="text-slate-300 text-xs mb-1 line-clamp-2">{block.action ? block.action.substring(0, 120) : (block.subjectAction ? block.subjectAction.substring(0, 120) : 'No action')}</p>
                            <p className="text-slate-500 text-xs mb-2">{block.shotType}</p>

                            {/* Generate Image button - passes all primary ref images */}
                            <button
                              onClick={() => {
                                const allRefs = getAllPrimaryRefImages();
                                generateImageFromPrompt(blockPrompt, imgKey, `Block ${block.blockNumber}`, allRefs.length > 0 ? allRefs : undefined);
                              }}
                              disabled={generatingImageFor === imgKey}
                              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium bg-gradient-to-r from-cyan-500/80 to-cyan-600/80 hover:from-cyan-400 hover:to-cyan-500 disabled:from-slate-600 disabled:to-slate-700 text-white rounded-lg transition-all"
                            >
                              {generatingImageFor === imgKey ? (
                                <><Loader2 size={12} className="animate-spin" /> Generating...</>
                              ) : (
                                <><Sparkles size={12} /> {displayCount > 0 ? 'Generate Another' : 'Generate Image'}</>
                              )}
                            </button>

                            {/* Shot Image Gallery */}
                            {displayCount > 0 && (
                              <ShotImageGallery
                                blockNumber={block.blockNumber}
                                images={blockImgs}
                                inlineImage={hasInlineOnly ? generatedImages.get(imgKey)! : undefined}
                                onUpscale={upscaleShotImage}
                                onDelete={deleteShotImage}
                                onDownload={downloadShotImage}
                                onFullscreen={(blockNum, idx) => setShotLightbox({ blockNum, imageIndex: idx })}
                                getImageSrc={getShotImageSrc}
                                upscalingId={upscalingShotId}
                                deletingId={deletingShotId}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Open Storyboard Viewer Button */}
                    {currentProject && (
                      <button
                        onClick={() => setShowStoryboardViewer(!showStoryboardViewer)}
                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-medium rounded-lg transition-all"
                      >
                        <ImageIcon size={18} />
                        {showStoryboardViewer ? 'Hide' : 'Open'} Storyboard Images
                      </button>
                    )}
                    {!currentProject && storyboard && (
                      <p className="mt-3 text-amber-400 text-xs italic">💡 Save the project first to generate storyboard images with Imagen 4</p>
                    )}
                  </div>
                )}

                {/* Shot Lightbox */}
                <AnimatePresence>
                  {shotLightbox && (() => {
                    const lbBlockImgs = getBlockImages(shotLightbox.blockNum);
                    const lbImg = lbBlockImgs[shotLightbox.imageIndex];
                    if (!lbImg) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
                        onClick={() => setShotLightbox(null)}
                      >
                        <div className="max-w-[95vw] max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between p-3 text-white">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">Block {shotLightbox.blockNum} — Image {shotLightbox.imageIndex + 1} of {lbBlockImgs.length}</p>
                              {lbImg.width > 0 && <p className="text-slate-400 text-xs">{lbImg.width} × {lbImg.height}px</p>}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              <button
                                onClick={() => upscaleShotImage(lbImg)}
                                disabled={upscalingShotId === lbImg.id || !!lbImg.base64}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/80 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm transition-colors"
                                title={lbImg.base64 ? 'Save project first' : 'Upscale 4x'}
                              >
                                {upscalingShotId === lbImg.id ? <Loader2 size={14} className="animate-spin" /> : <ZoomIn size={14} />}
                                Upscale 4x
                              </button>
                              <button onClick={() => downloadShotImage(lbImg)} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors" title="Download">
                                <Download size={18} />
                              </button>
                              <button onClick={() => deleteShotImage(lbImg)} className="p-2 bg-red-600/40 rounded-lg hover:bg-red-600/70 transition-colors" title="Delete">
                                <Trash2 size={18} />
                              </button>
                              <button onClick={() => setShotLightbox(null)} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                                <X size={18} />
                              </button>
                            </div>
                          </div>
                          <div className="flex-1 flex items-center justify-center relative min-h-0 px-4">
                            {shotLightbox.imageIndex > 0 && (
                              <button
                                onClick={() => setShotLightbox(prev => prev ? { ...prev, imageIndex: prev.imageIndex - 1 } : null)}
                                className="absolute left-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 z-10"
                              >
                                <ChevronLeft size={24} />
                              </button>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getShotImageSrc(lbImg)}
                              alt={lbImg.label || `Block ${shotLightbox.blockNum}`}
                              className="max-w-full max-h-[80vh] object-contain rounded-lg"
                            />
                            {shotLightbox.imageIndex < lbBlockImgs.length - 1 && (
                              <button
                                onClick={() => setShotLightbox(prev => prev ? { ...prev, imageIndex: prev.imageIndex + 1 } : null)}
                                className="absolute right-2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 z-10"
                              >
                                <ChevronRight size={24} />
                              </button>
                            )}
                          </div>
                          {lbImg.prompt && (
                            <div className="p-3 bg-slate-900/80 rounded-b-xl mt-2 max-h-24 overflow-y-auto">
                              <p className="text-slate-400 text-xs leading-relaxed">{lbImg.prompt}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>

              {/* Storyboard Images Viewer */}
              {showStoryboardViewer && storyboard && currentProject && (
                <div className="border-t border-slate-700 pt-6 mt-6">
                  <StoryboardViewer
                    projectId={currentProject.id}
                    blocks={storyboard.blocks}
                    shotlist={storyboard.shotlist}
                    projectName={currentProject.name}
                  />
                </div>
              )}
            </div>

            {/* Save Project */}
            <div className="bg-slate-800 rounded-xl border border-amber-500/30 p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                <Save size={20} />
                Save Project
              </h3>
              <div className="flex flex-wrap gap-3">
                {!currentProject && (
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name..."
                    className="flex-1 min-w-[200px] px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                )}
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="">No Folder</option>
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
                <button
                  onClick={saveProject}
                  disabled={savingProject || (!currentProject && !newProjectName.trim())}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-lg transition-all"
                >
                  {savingProject ? (
                    <><Loader2 size={18} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Save size={18} /> {currentProject ? 'Update Project' : 'Save Project'}</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Screenplay Creator Modal */}
      <AnimatePresence>
        {showScreenplayCreator && (
          <ScreenplayCreator
            onScreenplayCreated={(data) => {
              setScreenplay(data);
              setShowScreenplayCreator(false);
              // Prepopulate project name with story title if no project is loaded
              if (!currentProject && data.title) {
                setNewProjectName(data.title);
              }
            }}
            onClose={() => setShowScreenplayCreator(false)}
          />
        )}
      </AnimatePresence>

      {/* Screenplay Analyzer Modal */}
      <AnimatePresence>
        {showAnalyzer && (
          <ScreenplayAnalyzer
            onAnalysisComplete={(data) => {
              const title = data.analysis.title || 'Uploaded Screenplay';
              setScreenplay({
                title,
                content: data.screenplay,
                runtime: data.analysis.estimatedRuntime || 15,
                characters: data.characters,
                environments: data.environments,
                sourceType: 'upload',
              });
              // Store dialogue lines for Voice-Over extraction
              if (data.dialogueLines) {
                setDialogueLines(data.dialogueLines);
              }
              // Prepopulate project name with story title if no project is loaded
              if (!currentProject && title) {
                setNewProjectName(title);
              }
            }}
            onRecommendationsApply={(newSelections) => {
              setSelections(prev => ({ ...prev, ...newSelections } as Selections));
            }}
            currentSelections={selections as unknown as SelectionState}
            onClose={() => setShowAnalyzer(false)}
          />
        )}
      </AnimatePresence>

      {/* Image Grid Cutter Modal */}
      <ImageGridCutter
        isOpen={showGridCutter}
        onClose={() => setShowGridCutter(false)}
      />

      {/* Project Manager Modal */}
      <AnimatePresence>
        {showProjectManager && (
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
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-2xl font-bold text-amber-400">Project Manager</h2>
                <button onClick={() => setShowProjectManager(false)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Create Folder */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <FolderPlus size={20} />
                    Create Folder
                  </h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name..."
                      className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={createFolder}
                      disabled={!newFolderName.trim()}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-400 transition-all disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>

                {/* Folders & Projects */}
                <div className="space-y-4">
                  {/* Unfiled Projects */}
                  {projects.filter(p => !p.folderId).length > 0 && (
                    <div className="bg-slate-800 rounded-xl p-4">
                      <h4 className="text-amber-400 font-medium mb-3">Unfiled Projects</h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        {projects.filter(p => !p.folderId).map(project => (
                          <button
                            key={project.id}
                            onClick={() => loadProject(project)}
                            className="flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-900 rounded-lg text-left transition-all"
                          >
                            <FileText className="w-5 h-5 text-purple-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">{project.name}</p>
                              <p className="text-slate-500 text-xs">
                                {new Date(project.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Folders */}
                  {folders.map(folder => (
                    <div key={folder.id} className="bg-slate-800 rounded-xl p-4">
                      <h4 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                        <FolderOpen size={18} />
                        {folder.name}
                        <span className="text-slate-500 text-sm">({folder._count?.projects || 0})</span>
                      </h4>
                      {folder.projects && folder.projects.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-3">
                          {folder.projects.map(project => (
                            <button
                              key={project.id}
                              onClick={() => loadProject(project as Project)}
                              className="flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-900 rounded-lg text-left transition-all"
                            >
                              <FileText className="w-5 h-5 text-purple-400" />
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-medium truncate">{project.name}</p>
                                <p className="text-slate-500 text-xs">
                                  {new Date(project.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-sm">No projects in this folder</p>
                      )}
                    </div>
                  ))}

                  {folders.length === 0 && projects.length === 0 && (
                    <div className="text-center py-12">
                      <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">No projects yet. Create a screenplay to get started!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <SelectionModal
        isOpen={activeModal === 'imageType'}
        onClose={() => setActiveModal(null)}
        title="Select Image Type"
        options={resolvedImageTypes ?? []}
        selectedId={selections?.imageType?.id ?? null}
        onSelect={(o) => updateSelection('imageType', o as ImageType)}
      />
      
      <SelectionModal
        isOpen={activeModal === 'shotType'}
        onClose={() => setActiveModal(null)}
        title="Select Shot Type / Angle"
        options={resolvedShotTypes ?? []}
        selectedId={selections?.shotType?.id ?? null}
        onSelect={(o) => updateSelection('shotType', o)}
      />
      
      <SelectionModal
        isOpen={activeModal === 'lighting'}
        onClose={() => setActiveModal(null)}
        title="Select Lighting Source"
        options={resolvedLightingSources ?? []}
        selectedId={selections?.lighting?.id ?? null}
        onSelect={(o) => updateSelection('lighting', o as LightingSource)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'camera'}
        onClose={() => setActiveModal(null)}
        title="Select Camera Body"
        options={resolvedCameraBodies ?? []}
        selectedId={selections?.camera?.id ?? null}
        onSelect={(o) => updateSelection('camera', o as CameraBody)}
        showDescription
        filterStyle={filterStyle}
      />
      
      <SelectionModal
        isOpen={activeModal === 'focalLength'}
        onClose={() => setActiveModal(null)}
        title="Select Focal Length"
        options={resolvedFocalLengths ?? []}
        selectedId={selections?.focalLength?.id ?? null}
        onSelect={(o) => updateSelection('focalLength', o as FocalLength)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'lensType'}
        onClose={() => setActiveModal(null)}
        title="Select Lens Type"
        options={resolvedLensTypes ?? []}
        selectedId={selections?.lensType?.id ?? null}
        onSelect={(o) => updateSelection('lensType', o as LensType)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'filmStock'}
        onClose={() => setActiveModal(null)}
        title="Select Film Stock"
        options={resolvedFilmStocks ?? []}
        selectedId={selections?.filmStock?.id ?? null}
        onSelect={(o) => updateSelection('filmStock', o as FilmStock)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'photographer'}
        onClose={() => setActiveModal(null)}
        title="Select Photographer Style"
        options={resolvedPhotographerStyles ?? []}
        selectedId={selections?.photographer?.id ?? null}
        onSelect={(o) => updateSelection('photographer', o as PhotographerStyle)}
        showDescription
        filterStyle={filterStyle}
      />
      
      <SelectionModal
        isOpen={activeModal === 'movie'}
        onClose={() => setActiveModal(null)}
        title="Select Movie Style"
        options={resolvedMovieStyles ?? []}
        selectedId={selections?.movie?.id ?? null}
        onSelect={(o) => updateSelection('movie', o as MovieStyle)}
        showDescription
        filterStyle={filterStyle}
      />
      
      <SelectionModal
        isOpen={activeModal === 'filter'}
        onClose={() => setActiveModal(null)}
        title="Select Filter Effect"
        options={resolvedFilterEffects ?? []}
        selectedId={selections?.filter?.id ?? null}
        onSelect={(o) => updateSelection('filter', o as FilterEffect)}
        showDescription
      />
    </div>
  );
}
