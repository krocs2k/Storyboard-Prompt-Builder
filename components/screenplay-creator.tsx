'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube, Lightbulb, Clock, Loader2, ChevronRight, RefreshCw,
  CheckCircle, FileText, X, AlertCircle, ClipboardPaste, Download,
  BookOpen, Sparkles, PenTool, Film, Upload, BookMarked
} from 'lucide-react';
import { StoryConcept } from '@/lib/types';
import { storyGenres, StoryGenre } from '@/lib/data/story-genres';
import { authFetch } from '@/lib/utils';

interface StoryIdea {
  id: number;
  title: string;
  premise: string;
}

interface ConceptItem {
  id: number;
  title: string;
  synopsis: string;
  dramaticElement?: string;
  paranormalElement?: string;
  emotionalHook: string;
}

interface ScreenplayCreatorProps {
  onScreenplayCreated: (screenplay: {
    title: string;
    content: string;
    runtime: number;
    characters: Array<{ name: string; description: string }>;
    environments: Array<{ name: string; description: string }>;
    sourceType: 'youtube' | 'concept';
    sourceUrl?: string;
    storyIdea?: string;
  }) => void;
  onClose: () => void;
}

type ConceptModeStep = 'genre' | 'ideas' | 'concepts' | 'generating' | 'complete';

/* ── Compact step progress bar ────────────────────────────── */
function StepProgressBar({ current }: { current: number }) {
  const steps = ['Genre', 'Ideas', 'Concepts', 'Screenplay'];
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
              done ? 'bg-green-500 text-white' : active ? 'bg-amber-500 text-slate-900' : 'bg-slate-700/80 text-slate-500'
            }`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] font-medium truncate ${
              done ? 'text-green-400' : active ? 'text-amber-400' : 'text-slate-600'
            }`}>{label}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-0.5 ${done ? 'bg-green-500/60' : 'bg-slate-700'}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function ScreenplayCreator({ onScreenplayCreated, onClose }: ScreenplayCreatorProps) {
  const [mode, setMode] = useState<'select' | 'youtube' | 'concept' | 'convert'>('select');
  const [conceptStep, setConceptStep] = useState<ConceptModeStep>('genre');
  const [runtime, setRuntime] = useState(15);
  
  // Format runtime (minutes) as MM:SS string
  const runtimeMMSS = `${String(Math.floor(runtime)).padStart(2, '0')}:${String(Math.round((runtime % 1) * 60)).padStart(2, '0')}`;
  
  // Parse MM:SS string to minutes
  const parseMMSS = (value: string): number | null => {
    // Accept MM:SS or just MM
    const match = value.match(/^(\d{1,3}):?(\d{0,2})$/);
    if (!match) return null;
    const mins = parseInt(match[1], 10);
    const secs = match[2] ? parseInt(match[2], 10) : 0;
    if (isNaN(mins) || isNaN(secs) || secs >= 60) return null;
    const total = mins + secs / 60;
    if (total < 1 || total > 240) return null;
    return total;
  };

  const handleRuntimeInput = (value: string) => {
    const parsed = parseMMSS(value);
    if (parsed !== null) {
      setRuntime(Math.round(parsed));
    }
  };

  // YouTube mode state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');
  
  // Concept mode state
  const [selectedGenre, setSelectedGenre] = useState<StoryGenre | null>(null);
  const [storyIdeas, setStoryIdeas] = useState<StoryIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<StoryIdea | null>(null);
  const [customIdea, setCustomIdea] = useState('');
  const [useCustomIdea, setUseCustomIdea] = useState(false);
  const [concepts, setConcepts] = useState<ConceptItem[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<ConceptItem | null>(null);
  
  // Convert mode state
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertText, setConvertText] = useState('');
  const [convertTitle, setConvertTitle] = useState('');
  const [convertInputMode, setConvertInputMode] = useState<'file' | 'text'>('file');
  const [convertComplete, setConvertComplete] = useState(false);
  
  // Common state
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [screenplay, setScreenplay] = useState('');
  const [screenplayTitle, setScreenplayTitle] = useState('');
  const [error, setError] = useState('');
  const [genreSearch, setGenreSearch] = useState('');

  // Filter genres by search
  const filteredGenres = storyGenres.filter(g => 
    g.name.toLowerCase().includes(genreSearch.toLowerCase()) ||
    g.description.toLowerCase().includes(genreSearch.toLowerCase())
  );

  const fetchTranscript = useCallback(async (useManual = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await authFetch('/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: youtubeUrl,
          manualTranscript: useManual ? manualTranscript : undefined
        }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error === 'AUTO_EXTRACT_FAILED') {
          setShowManualInput(true);
          setError('Automatic extraction failed. Please paste the transcript manually below.');
          return null;
        }
        throw new Error(data.message || data.error);
      }
      return data.transcript;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transcript');
      return null;
    } finally {
      setLoading(false);
    }
  }, [youtubeUrl, manualTranscript]);

  const generateStoryIdeas = useCallback(async () => {
    if (!selectedGenre) return;
    setLoading(true);
    setError('');
    setStoryIdeas([]);
    setSelectedIdea(null);
    try {
      const response = await authFetch('/api/screenplay/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre: selectedGenre.id, genreName: selectedGenre.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStoryIdeas(data.ideas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate story ideas');
    } finally {
      setLoading(false);
    }
  }, [selectedGenre]);

  const generateConcepts = useCallback(async () => {
    const ideaText = useCustomIdea ? customIdea : (selectedIdea ? `${selectedIdea.title}: ${selectedIdea.premise}` : '');
    if (!ideaText) return;
    
    setLoading(true);
    setError('');
    setConcepts([]);
    setSelectedConcept(null);
    try {
      const response = await authFetch('/api/screenplay/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          storyIdea: ideaText, 
          runtime,
          genre: selectedGenre?.name 
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConcepts(data.concepts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate concepts');
    } finally {
      setLoading(false);
    }
  }, [useCustomIdea, customIdea, selectedIdea, runtime, selectedGenre]);

  const generateScreenplay = useCallback(async (sourceType: 'youtube' | 'concept', transcript?: string) => {
    setGenerating(true);
    setConceptStep('generating');
    setProgress('Starting screenplay generation...');
    setScreenplay('');
    setError('');

    try {
      const body = sourceType === 'youtube'
        ? { sourceType, transcript, runtime }
        : { 
            sourceType, 
            storyConcept: `Title: ${selectedConcept?.title}\n\nSynopsis: ${selectedConcept?.synopsis}\n\nDramatic Element: ${selectedConcept?.dramaticElement || selectedConcept?.paranormalElement}\n\nEmotional Hook: ${selectedConcept?.emotionalHook}`,
            runtime,
            genre: selectedGenre?.name
          };

      const response = await authFetch('/api/screenplay/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let partialRead = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'streaming') {
                buffer += parsed.content;
                setScreenplay(buffer);
                setProgress('Writing screenplay...');
              } else if (parsed.status === 'completed') {
                setScreenplay(parsed.screenplay);
                setScreenplayTitle(selectedConcept?.title || 'Untitled Screenplay');
                setConceptStep('complete');
                parseAndComplete(parsed.screenplay, sourceType);
                return;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate screenplay');
      setConceptStep('concepts');
    } finally {
      setGenerating(false);
    }
  }, [runtime, selectedConcept, selectedGenre]);

  const parseAndComplete = (content: string, sourceType: 'youtube' | 'concept') => {
    const charactersMatch = content.match(/---CHARACTER DESCRIPTIONS---([\s\S]*?)(?:---ENVIRONMENT|$)/i);
    const environmentsMatch = content.match(/---ENVIRONMENT DESCRIPTIONS---([\s\S]*?)$/i);

    const characters: Array<{ name: string; description: string }> = [];
    const environments: Array<{ name: string; description: string }> = [];

    if (charactersMatch) {
      const charSection = charactersMatch[1];
      const charLines = charSection.split('\n').filter(l => l.trim());
      let currentChar = { name: '', description: '' };
      for (const line of charLines) {
        if (line.match(/^[A-Z][A-Z\s]+[:\-]/)) {
          if (currentChar.name) characters.push({ ...currentChar });
          const [name, ...desc] = line.split(/[:\-]/);
          currentChar = { name: name.trim(), description: desc.join(':').trim() };
        } else if (currentChar.name) {
          currentChar.description += ' ' + line.trim();
        }
      }
      if (currentChar.name) characters.push(currentChar);
    }

    if (environmentsMatch) {
      const envSection = environmentsMatch[1];
      const envLines = envSection.split('\n').filter(l => l.trim());
      let currentEnv = { name: '', description: '' };
      for (const line of envLines) {
        if (line.match(/^[A-Z][A-Z\s\.]+[:\-]/) || line.match(/^INT\.|^EXT\./)) {
          if (currentEnv.name) environments.push({ ...currentEnv });
          const [name, ...desc] = line.split(/[:\-]/);
          currentEnv = { name: name.trim(), description: desc.join(':').trim() };
        } else if (currentEnv.name) {
          currentEnv.description += ' ' + line.trim();
        }
      }
      if (currentEnv.name) environments.push(currentEnv);
    }

    const titleMatch = content.match(/(?:TITLE:|"([^"]+)"|COLD OPEN|TEASER)\s*\n?([^\n]+)?/i);
    const title = titleMatch?.[1] || titleMatch?.[2] || selectedConcept?.title || 'Untitled Screenplay';

    onScreenplayCreated({
      title: title.trim(),
      content,
      runtime,
      characters: characters.length > 0 ? characters : [{ name: 'PROTAGONIST', description: 'The main character' }],
      environments: environments.length > 0 ? environments : [{ name: 'MAIN LOCATION', description: 'Primary setting' }],
      sourceType,
      sourceUrl: sourceType === 'youtube' ? youtubeUrl : undefined,
      storyIdea: sourceType === 'concept' ? (useCustomIdea ? customIdea : selectedIdea?.premise) : undefined,
    });
  };

  const handleYoutubeSubmit = async () => {
    setProgress('Fetching transcript from YouTube...');
    const transcript = await fetchTranscript(false);
    if (transcript) {
      await generateScreenplay('youtube', transcript);
    }
  };

  const handleManualTranscriptSubmit = async () => {
    if (!manualTranscript.trim()) {
      setError('Please paste the transcript text');
      return;
    }
    setProgress('Processing transcript...');
    const transcript = await fetchTranscript(true);
    if (transcript) {
      setShowManualInput(false);
      await generateScreenplay('youtube', transcript);
    }
  };

  const handleConceptSubmit = async () => {
    if (selectedConcept) {
      await generateScreenplay('concept');
    }
  };

  const handleConvertSubmit = async () => {
    setGenerating(true);
    setProgress('Adapting source material into screenplay...');
    setScreenplay('');
    setError('');

    try {
      let response: Response;

      if (convertInputMode === 'file' && convertFile) {
        const formData = new FormData();
        formData.append('file', convertFile);
        formData.append('runtime', String(runtime));
        response = await authFetch('/api/screenplay/convert', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await authFetch('/api/screenplay/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceText: convertText,
            sourceTitle: convertTitle || 'Untitled',
            runtime,
          }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Conversion failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let partialRead = '';
      let fullContent = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        partialRead += decoder.decode(value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'streaming') {
                fullContent += parsed.content;
                setScreenplay(fullContent);
                setProgress('Writing screenplay...');
              } else if (parsed.status === 'completed') {
                fullContent = parsed.screenplay;
                setScreenplay(fullContent);
                const titleMatch = fullContent.match(/(?:TITLE:|"([^"]+)")\s*\n?([^\n]+)?/i);
                const title = titleMatch?.[1] || titleMatch?.[2] || convertTitle || convertFile?.name?.replace(/\.[^.]+$/, '') || 'Adapted Screenplay';
                setScreenplayTitle(title.trim());
                setConvertComplete(true);
                setGenerating(false);
                parseAndComplete(fullContent, 'concept');
                return;
              } else if (parsed.status === 'error') {
                throw new Error(parsed.message || 'Conversion failed');
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Conversion failed') {
                // Skip JSON parse errors for progress chunks
              } else {
                throw e;
              }
            }
          }
        }
      }

      // If stream ended without completed event
      if (fullContent && !convertComplete) {
        const titleMatch = fullContent.match(/(?:TITLE:|"([^"]+)")\s*\n?([^\n]+)?/i);
        const title = titleMatch?.[1] || titleMatch?.[2] || convertTitle || convertFile?.name?.replace(/\.[^.]+$/, '') || 'Adapted Screenplay';
        setScreenplayTitle(title.trim());
        setConvertComplete(true);
        parseAndComplete(fullContent, 'concept');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert to screenplay');
    } finally {
      setGenerating(false);
    }
  };

  const resetConvertFlow = () => {
    setConvertFile(null);
    setConvertText('');
    setConvertTitle('');
    setConvertInputMode('file');
    setConvertComplete(false);
    setScreenplay('');
    setScreenplayTitle('');
    setError('');
  };

  // Download handlers
  const downloadScreenplay = (format: 'txt' | 'doc' | 'docx') => {
    const filename = `${screenplayTitle.replace(/[^a-zA-Z0-9]/g, '_') || 'screenplay'}`;
    
    if (format === 'txt') {
      const blob = new Blob([screenplay], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For DOC/DOCX, we need to use the API
      downloadAsDoc(format);
    }
  };

  const downloadAsDoc = async (format: 'doc' | 'docx') => {
    try {
      const response = await authFetch('/api/screenplay/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          screenplay, 
          title: screenplayTitle,
          format 
        }),
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${screenplayTitle.replace(/[^a-zA-Z0-9]/g, '_') || 'screenplay'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download file');
    }
  };

  const resetConceptFlow = () => {
    setConceptStep('genre');
    setSelectedGenre(null);
    setStoryIdeas([]);
    setSelectedIdea(null);
    setCustomIdea('');
    setUseCustomIdea(false);
    setConcepts([]);
    setSelectedConcept(null);
    setScreenplay('');
    setScreenplayTitle('');
    setError('');
  };

  const goBackInConceptFlow = () => {
    if (conceptStep === 'ideas') {
      setConceptStep('genre');
      setStoryIdeas([]);
      setSelectedIdea(null);
    } else if (conceptStep === 'concepts') {
      setConceptStep('ideas');
      setConcepts([]);
      setSelectedConcept(null);
    } else if (conceptStep === 'complete') {
      setConceptStep('concepts');
    }
  };

  /* ── Compact runtime control (reused across steps) ───────── */
  const RuntimeControl = ({ keyPrefix = 'rt' }: { keyPrefix?: string }) => (
    <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5 border border-slate-700/60">
      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="text-slate-300 text-sm font-medium whitespace-nowrap">Runtime:</span>
      <input
        type="range" min="1" max="240" step="1" value={runtime}
        onChange={(e) => setRuntime(parseInt(e.target.value))}
        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
      />
      <input
        type="text" defaultValue={runtimeMMSS} key={`${keyPrefix}-${runtime}`} placeholder="MM:SS"
        onBlur={(e) => handleRuntimeInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleRuntimeInput((e.target as HTMLInputElement).value); }}
        className="w-16 px-2 py-1 text-center text-xs bg-slate-900 border border-slate-600 rounded text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
      />
      <span className="text-slate-500 text-[10px]">min</span>
    </div>
  );

  /* ── Download bar (reused in complete & convert-complete) ── */
  const DownloadBar = ({ accentColor = 'amber' }: { accentColor?: 'amber' | 'emerald' }) => (
    <div className="flex items-center gap-2">
      <span className={`text-${accentColor}-400 text-sm font-medium flex items-center gap-1.5`}>
        <Download className="w-4 h-4" /> Download:
      </span>
      {(['txt', 'doc', 'docx'] as const).map(fmt => (
        <button key={fmt} onClick={() => downloadScreenplay(fmt)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 rounded-lg text-white text-xs font-medium transition-colors uppercase"
        >{fmt}</button>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-5xl h-[calc(100vh-1.5rem)] max-h-[900px] overflow-hidden flex flex-col"
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-amber-400">AI Screenplay Creator</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 flex flex-col min-h-0 px-5 py-3">
          {error && (
            <div className="mb-3 px-3 py-2.5 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-start gap-2 text-sm shrink-0">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ═══ Mode Selection ═══ */}
            {mode === 'select' && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center flex-1 gap-6">
                <p className="text-slate-300 text-center text-sm">Choose how you want to create your screenplay</p>
                <div className="grid md:grid-cols-3 gap-4 w-full max-w-3xl">
                  <button onClick={() => setMode('youtube')}
                    className="group p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 rounded-xl text-left transition-all">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mb-2.5 group-hover:bg-red-500/30 transition-colors">
                      <Youtube className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">From YouTube</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">Extract a story from a YouTube transcript and transform it into a screenplay</p>
                    <div className="flex items-center gap-1.5 text-red-400 mt-2.5 text-xs font-medium">Get Started <ChevronRight className="w-3.5 h-3.5" /></div>
                  </button>
                  <button onClick={() => { setMode('concept'); setConceptStep('genre'); }}
                    className="group p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center mb-2.5 group-hover:bg-amber-500/30 transition-colors">
                      <Lightbulb className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">From Story Idea</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">Select a genre, generate ideas, develop concepts, and create a full screenplay</p>
                    <div className="flex items-center gap-1.5 text-amber-400 mt-2.5 text-xs font-medium">Get Started <ChevronRight className="w-3.5 h-3.5" /></div>
                  </button>
                  <button onClick={() => setMode('convert')}
                    className="group p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-left transition-all">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-2.5 group-hover:bg-emerald-500/30 transition-colors">
                      <BookMarked className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">Adapt to Screenplay</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">Convert a story, transcript, or novel into a professional TV/Film screenplay</p>
                    <div className="flex items-center gap-1.5 text-emerald-400 mt-2.5 text-xs font-medium">Get Started <ChevronRight className="w-3.5 h-3.5" /></div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══ YouTube Mode ═══ */}
            {mode === 'youtube' && !generating && (
              <motion.div key="youtube" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-4 flex-1 min-h-0">
                <button onClick={() => { setMode('select'); setShowManualInput(false); setError(''); }}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm shrink-0">
                  <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                </button>

                <div className="bg-slate-800/50 rounded-xl p-4">
                  <label className="flex items-center gap-2 text-amber-400 font-medium mb-3 text-sm">
                    <Youtube className="w-4 h-4 text-red-400" /> YouTube Video URL
                  </label>
                  <input type="url" value={youtubeUrl}
                    onChange={(e) => { setYoutubeUrl(e.target.value); setShowManualInput(false); setError(''); }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
                </div>

                {showManualInput && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-2.5 mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-amber-400 font-medium text-sm">Manual Transcript Required</h4>
                        <p className="text-slate-400 text-xs mt-0.5">YouTube is blocking automatic extraction. Please copy the transcript and paste it below.</p>
                      </div>
                    </div>
                    <textarea value={manualTranscript} onChange={(e) => setManualTranscript(e.target.value)}
                      placeholder="Paste the transcript text here..." rows={4}
                      className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none font-mono" />
                  </motion.div>
                )}

                <RuntimeControl keyPrefix="yt" />

                <button onClick={showManualInput ? handleManualTranscriptSubmit : handleYoutubeSubmit}
                  disabled={showManualInput ? !manualTranscript.trim() : !youtubeUrl || loading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shrink-0">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><FileText className="w-4 h-4" /> Generate Screenplay</>}
                </button>
              </motion.div>
            )}

            {/* ═══ Concept: Genre Selection ═══ */}
            {mode === 'concept' && conceptStep === 'genre' && (
              <motion.div key="genre" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-4 shrink-0">
                  <button onClick={() => { setMode('select'); resetConceptFlow(); }}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                  </button>
                  <div className="flex-1"><StepProgressBar current={0} /></div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div>
                    <h3 className="text-base font-semibold text-white">Select a Story Genre</h3>
                    <p className="text-slate-500 text-xs">Choose a genre to generate story ideas</p>
                  </div>
                  <div className="flex-1" />
                  <input type="text" value={genreSearch} onChange={(e) => setGenreSearch(e.target.value)}
                    placeholder="Search genres..."
                    className="w-52 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:border-amber-500 focus:outline-none" />
                </div>

                {/* Genre Grid — fills remaining space */}
                <div className="flex-1 min-h-0 overflow-y-auto rounded-lg -mx-1 px-1">
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {filteredGenres.map((genre) => (
                      <button key={genre.id} onClick={() => setSelectedGenre(genre)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${selectedGenre?.id === genre.id
                          ? 'bg-amber-500/20 border-amber-500 shadow-sm shadow-amber-500/20'
                          : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'}`}>
                        <div className="text-xl mb-0.5">{genre.icon}</div>
                        <div className="font-medium text-white text-xs leading-tight">{genre.name}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">{genre.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={() => { setConceptStep('ideas'); generateStoryIdeas(); }} disabled={!selectedGenre}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shrink-0">
                  <Sparkles className="w-4 h-4" /> Generate Story Ideas
                </button>
              </motion.div>
            )}

            {/* ═══ Concept: Story Ideas ═══ */}
            {mode === 'concept' && conceptStep === 'ideas' && (
              <motion.div key="ideas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-4 shrink-0">
                  <button onClick={goBackInConceptFlow}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                  </button>
                  <div className="flex-1"><StepProgressBar current={1} /></div>
                </div>

                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-base font-semibold text-white">Select a Story Idea</h3>
                    <p className="text-slate-500 text-xs">Genre: <span className="text-amber-400">{selectedGenre?.icon} {selectedGenre?.name}</span></p>
                  </div>
                  <button onClick={generateStoryIdeas} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-xs transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate
                  </button>
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                    <span className="ml-3 text-slate-300 text-sm">Generating story ideas...</span>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
                    {/* Custom Idea */}
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/60 shrink-0">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={useCustomIdea}
                          onChange={(e) => { setUseCustomIdea(e.target.checked); if (e.target.checked) setSelectedIdea(null); }}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500" />
                        <div>
                          <span className="text-white font-medium text-sm">Use custom story idea</span>
                          <p className="text-slate-500 text-xs">Enter your own story idea instead</p>
                        </div>
                      </label>
                      {useCustomIdea && (
                        <textarea value={customIdea} onChange={(e) => setCustomIdea(e.target.value)}
                          placeholder="Enter your story idea or subject..." rows={2}
                          className="mt-2 w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none" />
                      )}
                    </div>

                    {/* Generated Ideas */}
                    {!useCustomIdea && storyIdeas.map((idea) => (
                      <button key={idea.id} onClick={() => setSelectedIdea(idea)}
                        className={`p-3 rounded-lg border text-left transition-all shrink-0 ${selectedIdea?.id === idea.id
                          ? 'bg-amber-500/20 border-amber-500'
                          : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-white text-sm">{idea.title}</h4>
                          {selectedIdea?.id === idea.id && <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{idea.premise}</p>
                      </button>
                    ))}
                  </div>
                )}

                <button onClick={() => { setConceptStep('concepts'); generateConcepts(); }}
                  disabled={(useCustomIdea ? !customIdea : !selectedIdea) || loading}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shrink-0">
                  <BookOpen className="w-4 h-4" /> Generate Story Concepts
                </button>
              </motion.div>
            )}

            {/* ═══ Concept: Story Concepts ═══ */}
            {mode === 'concept' && conceptStep === 'concepts' && (
              <motion.div key="concepts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-4 shrink-0">
                  <button onClick={goBackInConceptFlow}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" /> Back
                  </button>
                  <div className="flex-1"><StepProgressBar current={2} /></div>
                </div>

                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-base font-semibold text-white">Select a Story Concept</h3>
                    <p className="text-slate-500 text-xs">Based on: <span className="text-amber-400">{useCustomIdea ? customIdea.slice(0, 40) + '...' : selectedIdea?.title}</span></p>
                  </div>
                  <button onClick={generateConcepts} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-xs transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate
                  </button>
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                    <span className="ml-3 text-slate-300 text-sm">Generating story concepts...</span>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
                    {concepts.map((concept) => (
                      <button key={concept.id} onClick={() => setSelectedConcept(concept)}
                        className={`p-3 rounded-lg border text-left transition-all shrink-0 ${selectedConcept?.id === concept.id
                          ? 'bg-amber-500/20 border-amber-500'
                          : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-white text-sm">{concept.title}</h4>
                          {selectedConcept?.id === concept.id && <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                        </div>
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">{concept.synopsis}</p>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-[10px]">
                          <span className="text-purple-400">✨ {concept.dramaticElement || concept.paranormalElement}</span>
                          <span className="text-pink-400">❤️ {concept.emotionalHook}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <RuntimeControl keyPrefix="concept" />

                <button onClick={handleConceptSubmit} disabled={!selectedConcept || loading}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shrink-0">
                  <PenTool className="w-4 h-4" /> Generate Screenplay
                </button>
              </motion.div>
            )}

            {/* ═══ Convert Mode ═══ */}
            {mode === 'convert' && !generating && !convertComplete && (
              <motion.div key="convert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => { setMode('select'); resetConvertFlow(); }}
                    className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-base font-semibold text-white">Adapt to Screenplay</h3>
                    <p className="text-slate-400 text-xs">Upload or paste your story, transcript, or novel</p>
                  </div>
                </div>

                {/* Persona badge */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-2.5 shrink-0">
                  <PenTool className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-emerald-400 font-medium text-xs">Award-Winning Professional Screenwriter</p>
                    <p className="text-slate-400 text-[10px]">30+ years adapting novels, stories, and transcripts for major studios</p>
                  </div>
                </div>

                {/* Input mode toggle */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setConvertInputMode('file')}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5 ${convertInputMode === 'file'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                    <Upload className="w-3.5 h-3.5" /> Upload File
                  </button>
                  <button onClick={() => setConvertInputMode('text')}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5 ${convertInputMode === 'text'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'}`}>
                    <ClipboardPaste className="w-3.5 h-3.5" /> Paste Text
                  </button>
                </div>

                {convertInputMode === 'file' ? (
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors flex-1 flex items-center justify-center ${convertFile
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-700 hover:border-slate-600'}`}>
                    {convertFile ? (
                      <div className="space-y-1.5">
                        <FileText className="w-8 h-8 text-emerald-400 mx-auto" />
                        <p className="text-white font-medium text-sm">{convertFile.name}</p>
                        <p className="text-slate-400 text-xs">{(convertFile.size / 1024).toFixed(1)} KB</p>
                        <button onClick={() => setConvertFile(null)} className="text-red-400 text-xs hover:text-red-300">Remove</button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        <p className="text-white font-medium text-sm mb-0.5">Drop your file here or click to browse</p>
                        <p className="text-slate-500 text-xs">Supports .txt, .md, .doc, .docx, .pdf</p>
                        <input type="file" accept=".txt,.md,.doc,.docx,.pdf" className="hidden"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) setConvertFile(file); }} />
                      </label>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <input type="text" placeholder="Title (optional)" value={convertTitle}
                      onChange={(e) => setConvertTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0" />
                    <textarea placeholder="Paste your story, transcript, or novel text here..." value={convertText}
                      onChange={(e) => setConvertText(e.target.value)}
                      className="flex-1 min-h-0 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono" />
                    <p className="text-slate-500 text-[10px] text-right shrink-0">{convertText.length.toLocaleString()} characters</p>
                  </div>
                )}

                <RuntimeControl keyPrefix="convert" />

                <button onClick={handleConvertSubmit}
                  disabled={generating || (convertInputMode === 'file' ? !convertFile : convertText.trim().length < 50)}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-700 text-white disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm shrink-0">
                  <BookMarked className="w-4 h-4" /> Adapt to Screenplay
                </button>
              </motion.div>
            )}

            {/* ═══ Convert Complete ═══ */}
            {mode === 'convert' && convertComplete && !generating && (
              <motion.div key="convert-complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white">Screenplay Adapted!</h3>
                    <p className="text-slate-400 text-xs truncate">{screenplayTitle} • {runtime} min • <span className="text-emerald-400">Award-Winning Screenwriter AI</span></p>
                  </div>
                </div>

                <DownloadBar accentColor="emerald" />

                {/* Screenplay Preview */}
                <div className="bg-slate-800/50 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
                  <h4 className="text-emerald-400 font-medium mb-2 text-sm shrink-0">Screenplay Preview</h4>
                  <div className="bg-slate-900 rounded-lg p-3 flex-1 min-h-0 overflow-y-auto">
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono text-xs">
                      {screenplay.slice(0, 3000)}{screenplay.length > 3000 && '\n\n... [Preview truncated]'}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-3 shrink-0">
                  <button onClick={() => { resetConvertFlow(); }}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                    <RefreshCw className="w-4 h-4" /> Convert Another
                  </button>
                  <button onClick={onClose}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4" /> Use as Screenplay Source
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══ Generating State ═══ */}
            {(generating || conceptStep === 'generating') && (
              <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-4 flex-1 min-h-0">
                <div className="text-center py-4 shrink-0">
                  <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-1">Generating Screenplay</h3>
                  <p className="text-slate-400 text-sm">{progress}</p>
                </div>

                {screenplay && (
                  <div className="bg-slate-800/50 rounded-xl p-4 flex-1 min-h-0 overflow-y-auto">
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono text-xs">{screenplay}</pre>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ Concept Complete ═══ */}
            {mode === 'concept' && conceptStep === 'complete' && !generating && (
              <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="shrink-0"><StepProgressBar current={4} /></div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white">Screenplay Complete!</h3>
                    <p className="text-slate-400 text-xs truncate">{screenplayTitle} • {runtime} minutes</p>
                  </div>
                </div>

                <DownloadBar />

                {/* Screenplay Preview */}
                <div className="bg-slate-800/50 rounded-xl p-4 flex-1 min-h-0 flex flex-col">
                  <h4 className="text-amber-400 font-medium mb-2 text-sm shrink-0">Screenplay Preview</h4>
                  <div className="bg-slate-900 rounded-lg p-3 flex-1 min-h-0 overflow-y-auto">
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono text-xs">
                      {screenplay.slice(0, 3000)}{screenplay.length > 3000 && '\n\n... [Preview truncated]'}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-3 shrink-0">
                  <button onClick={resetConceptFlow}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                    <RefreshCw className="w-4 h-4" /> Create Another
                  </button>
                  <button onClick={onClose}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4" /> Continue to Prompts
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
