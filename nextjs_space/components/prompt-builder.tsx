'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Frame, Sun, Camera, Sparkles, FileText, Copy, Check, 
  Trash2, Film, Aperture, Image as ImageIcon, Save, History,
  FolderOpen, Plus, Download, Loader2, Clapperboard, Upload,
  LayoutGrid, Users, MapPin, ChevronDown, X, FolderPlus, Edit3, Grid3X3, Mic, RefreshCw
} from 'lucide-react';
import { SectionCard } from './section-card';
import { SelectionButton } from './selection-button';
import { SelectionModal } from './selection-modal';
import { TextInput } from './text-input';
import { DropdownSelect } from './dropdown-select';
import ScreenplayCreator from './screenplay-creator';
import ScreenplayAnalyzer from './screenplay-analyzer';
import ImageGridCutter from './image-grid-cutter';
import {
  imageTypes, shotTypes, lightingSources, cameraBodies, focalLengths,
  lensTypes, filmStocks, aspectRatios, photographerStyles, movieStyles, filterEffects,
  ImageType, LightingSource, CameraBody, FocalLength, LensType, FilmStock,
  PhotographerStyle, MovieStyle, FilterEffect
} from '@/lib/data';
import {
  Project, ProjectFolder, Screenplay, Storyboard,
  CharacterPrompt, EnvironmentPrompt, StoryboardBlock, SelectionState, DialogueLine
} from '@/lib/types';

type ModalType = 'imageType' | 'shotType' | 'lighting' | 'camera' | 'focalLength' | 'lensType' | 'filmStock' | 'photographer' | 'movie' | 'filter' | null;

interface Selections {
  imageType: ImageType | null;
  shotType: { id: string; name: string } | null;
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
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [copied, setCopied] = useState(false);
  
  const [selections, setSelections] = useState<Selections>({
    imageType: null,
    shotType: null,
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
  }, []);

  // Load folders and projects on mount
  useEffect(() => {
    loadFolders();
    loadProjects();
  }, []);

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/folders');
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
      const res = await fetch('/api/projects');
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
      const res = await fetch('/api/folders', {
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

      const res = await fetch('/api/projects', {
        method: currentProject ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentProject ? { id: currentProject.id, ...projectData } : projectData),
      });

      if (res.ok) {
        const saved = await res.json();
        setCurrentProject(saved);
        setNewProjectName('');
        loadProjects();
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
  };

  const generateCharacterEnvironmentPrompts = async () => {
    if (!screenplay) return;
    setGeneratingPrompts(true);
    try {
      const res = await fetch('/api/screenplay/prompts', {
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
      const res = await fetch('/api/storyboard/generate', {
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
    let content = `CRYPTID JOURNAL SCREENPLAY\n`;
    content += `==========================\n\n`;
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
        const response = await fetch('/api/screenplay/voiceover', {
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

  const downloadStoryboard = () => {
    if (!storyboard) return;
    let content = 'CRYPTID JOURNAL - STORYBOARD BLOCKS AND SHOTLIST\n';
    content += '================================================\n\n';
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
    downloadAsDoc(content, 'cryptid_journal_storyboard_shotlist.doc');
  };

  const updateSelection = useCallback(<K extends keyof Selections>(key: K, value: Selections[K]) => {
    setSelections((prev) => ({ ...(prev ?? {}), [key]: value }));
  }, []);

  const clearSelection = useCallback(<K extends keyof Selections>(key: K) => {
    setSelections((prev) => ({ ...(prev ?? {}), [key]: key === 'aspectRatio' || key === 'subjectAction' || key === 'environment' || key === 'atmosphere' ? '' : null }));
  }, []);

  const clearAll = useCallback(() => {
    setSelections({
      imageType: null,
      shotType: null,
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

  // Build the constructed prompt
  const constructedPrompt = useMemo(() => {
    const parts: string[] = [];
    
    parts.push('Create a sequence of 9 cinematic film stills that tell a short story');
    
    if (selections?.imageType) {
      parts.push(`, a ${selections?.imageType?.name ?? ''} image of a`);
    }
    
    if (selections?.shotType) {
      parts.push(` ${selections?.shotType?.name ?? ''} of`);
    }
    
    if (selections?.subjectAction) {
      parts.push(` ${selections?.subjectAction ?? ''}`);
    }
    
    if (selections?.environment) {
      parts.push(`, set in ${selections?.environment ?? ''}`);
    }
    
    if (selections?.lighting) {
      parts.push(`, illuminated by ${selections?.lighting?.name ?? ''} with ${selections?.lighting?.description ?? ''}`);
    }
    
    if (selections?.atmosphere) {
      parts.push(`, creating an ${selections?.atmosphere ?? ''} atmosphere and mood`);
    }
    
    if (selections?.camera) {
      parts.push(`. ${selections?.camera?.name ?? ''} with ${selections?.camera?.description ?? ''}`);
    }
    
    if (selections?.focalLength || selections?.lensType) {
      const focalPart = selections?.focalLength?.name ?? '';
      const lensPart = selections?.lensType?.name ?? '';
      const lensDesc = selections?.lensType?.description ?? '';
      if (focalPart || lensPart) {
        parts.push(`. ${focalPart} ${lensPart}${lensDesc ? ` with ${lensDesc}` : ''}`);
      }
    }
    
    if (selections?.filmStock) {
      parts.push(`. ${selections?.filmStock?.name ?? ''} with ${selections?.filmStock?.description ?? ''}`);
    }
    
    if (selections?.photographer) {
      parts.push(`. In the style of photographer ${selections?.photographer?.name ?? ''} with ${selections?.photographer?.description ?? ''}`);
    }
    
    if (selections?.movie) {
      parts.push(`. With the visual aesthetic of the movie ${selections?.movie?.name ?? ''} with ${selections?.movie?.description ?? ''}`);
    }
    
    if (selections?.filter) {
      parts.push(`. Applied effects: ${selections?.filter?.name ?? ''}, ${selections?.filter?.description ?? ''}`);
    }
    
    if (selections?.aspectRatio) {
      parts.push(`. Aspect ratio: ${selections?.aspectRatio ?? ''}`);
    }
    
    parts.push('. No blurred faces.');
    
    return parts?.join('') ?? '';
  }, [selections]);

  const copyToClipboard = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(constructedPrompt);
      } else {
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = constructedPrompt;
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
        textArea.value = constructedPrompt;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://thumbs.dreamstime.com/b/abstract-design-website-hero-section-background-features-vibrant-blue-fluid-lines-geometric-shapes-circles-351935047.jpg bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/80 to-slate-950" />
        <div className="relative max-w-7xl mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-4"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Film className="text-slate-900" size={28} />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Storyboard Prompt Builder
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-amber-100/60 text-lg max-w-2xl mx-auto mb-8"
          >
            Craft cinematic image prompts with precision. Select your visual style, framing, lighting, and more.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <button
              onClick={() => setShowScreenplayCreator(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 transition-all"
            >
              <Clapperboard size={20} />
              AI Screenplay Creator
            </button>
            <button
              onClick={() => setShowAnalyzer(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/30 transition-all"
            >
              <Upload size={20} />
              Upload Screenplay
            </button>
            <button
              onClick={() => setShowProjectManager(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 font-semibold rounded-xl transition-all"
            >
              <FolderOpen size={20} />
              Projects
            </button>
            <button
              onClick={() => setShowGridCutter(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 transition-all"
            >
              <Grid3X3 size={20} />
              Image Grid Cutter
            </button>
            <button
              onClick={resetSession}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-rose-500/30 transition-all"
            >
              <RefreshCw size={20} />
              New Session
            </button>
          </motion.div>

          {/* Current Project Indicator */}
          {currentProject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400"
            >
              <FileText size={16} />
              <span>Project: {currentProject.name}</span>
              <button
                onClick={() => setCurrentProject(null)}
                className="ml-2 p-1 hover:bg-amber-500/20 rounded"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Sections 1-3 */}
          <div className="space-y-6">
            {/* Section 1: Visual Representation Style */}
            <SectionCard title="Visual Representation Style" icon={Palette} sectionNumber={1}>
              <SelectionButton
                label="Image Type"
                value={selections?.imageType?.name ?? null}
                onClick={() => setActiveModal('imageType')}
                onClear={() => clearSelection('imageType')}
              />
            </SectionCard>

            {/* Section 2: Subject and Framing */}
            <SectionCard title="Subject and Framing" icon={Frame} sectionNumber={2}>
              <TextInput
                label="Subject & Action"
                value={selections?.subjectAction ?? ''}
                onChange={(v) => updateSelection('subjectAction', v)}
                placeholder="Describe the subject and their action..."
                multiline
              />
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
            </SectionCard>

            {/* Section 3: Lighting & Mood */}
            <SectionCard title="Lighting & Mood" icon={Sun} sectionNumber={3}>
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
            <SectionCard title="Camera Gear" icon={Camera} sectionNumber={4}>
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
            <SectionCard title="Style & Aesthetics" icon={Sparkles} sectionNumber={5}>
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

        {/* Section 6: Constructed Prompt */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <SectionCard title="Constructed Prompt" icon={FileText} sectionNumber={6}>
            <div className="bg-slate-950/50 rounded-xl border border-amber-500/20 p-4">
              <div className="min-h-[150px] text-amber-100/90 whitespace-pre-wrap leading-relaxed">
                {constructedPrompt ?? ''}
              </div>
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
                onClick={clearAll}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-red-500/30 hover:border-red-500/50 text-red-400 font-medium rounded-xl transition-all"
              >
                <Trash2 size={20} />
                Clear All
              </motion.button>
            </div>
          </SectionCard>
        </motion.div>

        {/* Screenplay & Storyboard Section */}
        {screenplay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 space-y-6"
          >
            {/* Screenplay Info */}
            <div className="bg-slate-800/50 rounded-xl border border-purple-500/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                  <Clapperboard size={24} />
                  CRYPTID JOURNAL: {screenplay.title}
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

              {/* Show Generated Prompts */}
              {characterPrompts.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                  <h4 className="text-amber-400 font-medium mb-3">Generated Prompts Preview</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {characterPrompts.slice(0, 2).map((cp, i) => (
                      <div key={i} className="bg-slate-800/50 rounded p-3">
                        <p className="text-purple-300 font-medium text-sm">{cp.name}</p>
                        <p className="text-slate-400 text-xs mt-1">{cp.prompt ? cp.prompt.substring(0, 150) : 'No prompt'}...</p>
                      </div>
                    ))}
                    {characterPrompts.length > 2 && (
                      <p className="text-slate-500 text-sm">+{characterPrompts.length - 2} more character prompts...</p>
                    )}
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
                      <span className="text-slate-400 text-sm">
                        {storyboard.blocks.length} blocks | {storyboard.summary?.uniqueLocations || Object.keys(storyboard.shotlist).length} locations
                      </span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                      {storyboard.blocks.slice(0, 6).map((block, i) => (
                        <div key={i} className="bg-slate-800/50 rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-cyan-400 font-medium text-sm">Block {block.blockNumber}</span>
                            <span className="text-slate-500 text-xs">{block.timestampStart}</span>
                          </div>
                          <p className="text-slate-300 text-xs">{block.action ? block.action.substring(0, 80) : (block.subjectAction ? block.subjectAction.substring(0, 80) : 'No action')}...</p>
                          <p className="text-slate-500 text-xs mt-1">{block.shotType}</p>
                        </div>
                      ))}
                    </div>
                    {storyboard.blocks.length > 6 && (
                      <p className="text-slate-500 text-sm mt-2">+{storyboard.blocks.length - 6} more blocks...</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Save Project */}
            <div className="bg-slate-800/50 rounded-xl border border-amber-500/30 p-6">
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
              setScreenplay({
                title: data.analysis.title || 'Uploaded Screenplay',
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
                    <div className="bg-slate-800/50 rounded-xl p-4">
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
                    <div key={folder.id} className="bg-slate-800/50 rounded-xl p-4">
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
        options={imageTypes ?? []}
        selectedId={selections?.imageType?.id ?? null}
        onSelect={(o) => updateSelection('imageType', o as ImageType)}
      />
      
      <SelectionModal
        isOpen={activeModal === 'shotType'}
        onClose={() => setActiveModal(null)}
        title="Select Shot Type / Angle"
        options={shotTypes ?? []}
        selectedId={selections?.shotType?.id ?? null}
        onSelect={(o) => updateSelection('shotType', o)}
      />
      
      <SelectionModal
        isOpen={activeModal === 'lighting'}
        onClose={() => setActiveModal(null)}
        title="Select Lighting Source"
        options={lightingSources ?? []}
        selectedId={selections?.lighting?.id ?? null}
        onSelect={(o) => updateSelection('lighting', o as LightingSource)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'camera'}
        onClose={() => setActiveModal(null)}
        title="Select Camera Body"
        options={cameraBodies ?? []}
        selectedId={selections?.camera?.id ?? null}
        onSelect={(o) => updateSelection('camera', o as CameraBody)}
        showDescription
        filterStyle={filterStyle}
      />
      
      <SelectionModal
        isOpen={activeModal === 'focalLength'}
        onClose={() => setActiveModal(null)}
        title="Select Focal Length"
        options={focalLengths ?? []}
        selectedId={selections?.focalLength?.id ?? null}
        onSelect={(o) => updateSelection('focalLength', o as FocalLength)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'lensType'}
        onClose={() => setActiveModal(null)}
        title="Select Lens Type"
        options={lensTypes ?? []}
        selectedId={selections?.lensType?.id ?? null}
        onSelect={(o) => updateSelection('lensType', o as LensType)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'filmStock'}
        onClose={() => setActiveModal(null)}
        title="Select Film Stock"
        options={filmStocks ?? []}
        selectedId={selections?.filmStock?.id ?? null}
        onSelect={(o) => updateSelection('filmStock', o as FilmStock)}
        showDescription
      />
      
      <SelectionModal
        isOpen={activeModal === 'photographer'}
        onClose={() => setActiveModal(null)}
        title="Select Photographer Style"
        options={photographerStyles ?? []}
        selectedId={selections?.photographer?.id ?? null}
        onSelect={(o) => updateSelection('photographer', o as PhotographerStyle)}
        showDescription
        filterStyle={filterStyle}
      />
      
      <SelectionModal
        isOpen={activeModal === 'movie'}
        onClose={() => setActiveModal(null)}
        title="Select Movie Style"
        options={movieStyles ?? []}
        selectedId={selections?.movie?.id ?? null}
        onSelect={(o) => updateSelection('movie', o as MovieStyle)}
        showDescription
        filterStyle={filterStyle}
      />
      
      <SelectionModal
        isOpen={activeModal === 'filter'}
        onClose={() => setActiveModal(null)}
        title="Select Filter Effect"
        options={filterEffects ?? []}
        selectedId={selections?.filter?.id ?? null}
        onSelect={(o) => updateSelection('filter', o as FilterEffect)}
        showDescription
      />
    </div>
  );
}
