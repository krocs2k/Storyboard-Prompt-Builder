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

  return (
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
        className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-bold text-amber-400">AI Screenplay Creator</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Mode Selection */}
            {mode === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <p className="text-slate-300 text-center mb-8">
                  Choose how you want to create your screenplay
                </p>

                <div className="grid md:grid-cols-3 gap-5">
                  {/* YouTube Option */}
                  <button
                    onClick={() => setMode('youtube')}
                    className="group p-5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="w-11 h-11 bg-red-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-red-500/30 transition-colors">
                      <Youtube className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1.5">From YouTube</h3>
                    <p className="text-slate-400 text-sm">
                      Extract a story from a YouTube transcript and transform it into a screenplay
                    </p>
                    <div className="flex items-center gap-2 text-red-400 mt-3 text-sm">
                      Get Started <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Story Concept Option */}
                  <button
                    onClick={() => { setMode('concept'); setConceptStep('genre'); }}
                    className="group p-5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="w-11 h-11 bg-amber-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                      <Lightbulb className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1.5">From Story Idea</h3>
                    <p className="text-slate-400 text-sm">
                      Select a genre, generate ideas, develop concepts, and create a full screenplay
                    </p>
                    <div className="flex items-center gap-2 text-amber-400 mt-3 text-sm">
                      Get Started <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Convert/Adapt Option */}
                  <button
                    onClick={() => setMode('convert')}
                    className="group p-5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="w-11 h-11 bg-emerald-500/20 rounded-lg flex items-center justify-center mb-3 group-hover:bg-emerald-500/30 transition-colors">
                      <BookMarked className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1.5">Adapt to Screenplay</h3>
                    <p className="text-slate-400 text-sm">
                      Convert a story, transcript, or novel into a professional TV/Film screenplay
                    </p>
                    <div className="flex items-center gap-2 text-emerald-400 mt-3 text-sm">
                      Get Started <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* YouTube Mode */}
            {mode === 'youtube' && !generating && (
              <motion.div
                key="youtube"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <button
                  onClick={() => { setMode('select'); setShowManualInput(false); setError(''); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>

                <div className="bg-slate-800/50 rounded-xl p-6">
                  <label className="flex items-center gap-2 text-amber-400 font-medium mb-4">
                    <Youtube className="w-5 h-5 text-red-400" />
                    YouTube Video URL
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => { setYoutubeUrl(e.target.value); setShowManualInput(false); setError(''); }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {showManualInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-amber-400 font-medium">Manual Transcript Required</h4>
                        <p className="text-slate-400 text-sm mt-1">
                          YouTube is blocking automatic extraction. Please copy the transcript and paste it below.
                        </p>
                      </div>
                    </div>
                    
                    <label className="flex items-center gap-2 text-amber-400 font-medium mb-2">
                      <ClipboardPaste className="w-4 h-4" />
                      Paste Transcript Here
                    </label>
                    <textarea
                      value={manualTranscript}
                      onChange={(e) => setManualTranscript(e.target.value)}
                      placeholder="Paste the transcript text here..."
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none font-mono text-sm"
                    />
                  </motion.div>
                )}

                <div className="bg-slate-800/50 rounded-xl p-6">
                  <label className="flex items-center gap-2 text-amber-400 font-medium mb-4">
                    <Clock className="w-5 h-5" />
                    Target Runtime: {runtime} minutes
                  </label>
                  <div className="flex items-center gap-4 mb-3">
                    <input
                      type="range"
                      min="1"
                      max="240"
                      step="1"
                      value={runtime}
                      onChange={(e) => setRuntime(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue={runtimeMMSS}
                        key={`yt-${runtime}`}
                        placeholder="MM:SS"
                        onBlur={(e) => handleRuntimeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRuntimeInput((e.target as HTMLInputElement).value); }}
                        className="w-20 px-2 py-1.5 text-center text-sm bg-slate-900 border border-slate-600 rounded-lg text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-xs">MM:SS</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>1 min</span>
                    <span>60 min</span>
                    <span>120 min</span>
                    <span>240 min</span>
                  </div>
                </div>

                <button
                  onClick={showManualInput ? handleManualTranscriptSubmit : handleYoutubeSubmit}
                  disabled={showManualInput ? !manualTranscript.trim() : !youtubeUrl || loading}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    <><FileText className="w-5 h-5" /> Generate Screenplay</>
                  )}
                </button>
              </motion.div>
            )}

            {/* Concept Mode - Genre Selection */}
            {mode === 'concept' && conceptStep === 'genre' && (
              <motion.div
                key="genre"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <button
                  onClick={() => { setMode('select'); resetConceptFlow(); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm">1</div>
                    <span className="text-amber-400 font-medium">Genre</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm">2</div>
                    <span className="text-slate-500">Ideas</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm">3</div>
                    <span className="text-slate-500">Concepts</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm">4</div>
                    <span className="text-slate-500">Screenplay</span>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <h3 className="text-xl font-semibold text-white mb-2">Select a Story Genre</h3>
                  <p className="text-slate-400">Choose a genre to generate story ideas</p>
                </div>

                {/* Search */}
                <input
                  type="text"
                  value={genreSearch}
                  onChange={(e) => setGenreSearch(e.target.value)}
                  placeholder="Search genres..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />

                {/* Genre Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto p-1">
                  {filteredGenres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => setSelectedGenre(genre)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedGenre?.id === genre.id
                          ? 'bg-amber-500/20 border-amber-500'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{genre.icon}</div>
                      <div className="font-medium text-white text-sm">{genre.name}</div>
                      <div className="text-slate-500 text-xs mt-1 line-clamp-2">{genre.description}</div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => { setConceptStep('ideas'); generateStoryIdeas(); }}
                  disabled={!selectedGenre}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" /> Generate Story Ideas
                </button>
              </motion.div>
            )}

            {/* Concept Mode - Story Ideas */}
            {mode === 'concept' && conceptStep === 'ideas' && (
              <motion.div
                key="ideas"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <button
                  onClick={goBackInConceptFlow}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back to Genres
                </button>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Genre</span>
                  </div>
                  <div className="w-8 h-0.5 bg-green-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm">2</div>
                    <span className="text-amber-400 font-medium">Ideas</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm">3</div>
                    <span className="text-slate-500">Concepts</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm">4</div>
                    <span className="text-slate-500">Screenplay</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Select a Story Idea</h3>
                    <p className="text-slate-400 text-sm">Genre: <span className="text-amber-400">{selectedGenre?.icon} {selectedGenre?.name}</span></p>
                  </div>
                  <button
                    onClick={generateStoryIdeas}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="ml-3 text-slate-300">Generating story ideas...</span>
                  </div>
                ) : (
                  <>
                    {/* Custom Idea Option */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useCustomIdea}
                          onChange={(e) => { setUseCustomIdea(e.target.checked); if (e.target.checked) setSelectedIdea(null); }}
                          className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <span className="text-white font-medium">Use custom story idea</span>
                          <p className="text-slate-500 text-sm">Enter your own story idea instead</p>
                        </div>
                      </label>
                      {useCustomIdea && (
                        <textarea
                          value={customIdea}
                          onChange={(e) => setCustomIdea(e.target.value)}
                          placeholder="Enter your story idea or subject..."
                          rows={3}
                          className="mt-3 w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                        />
                      )}
                    </div>

                    {/* Generated Ideas */}
                    {!useCustomIdea && (
                      <div className="grid gap-3 max-h-[350px] overflow-y-auto">
                        {storyIdeas.map((idea) => (
                          <button
                            key={idea.id}
                            onClick={() => setSelectedIdea(idea)}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              selectedIdea?.id === idea.id
                                ? 'bg-amber-500/20 border-amber-500'
                                : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <h4 className="font-semibold text-white">{idea.title}</h4>
                              {selectedIdea?.id === idea.id && (
                                <CheckCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-slate-400 text-sm mt-1">{idea.premise}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={() => { setConceptStep('concepts'); generateConcepts(); }}
                  disabled={(useCustomIdea ? !customIdea : !selectedIdea) || loading}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-5 h-5" /> Generate Story Concepts
                </button>
              </motion.div>
            )}

            {/* Concept Mode - Story Concepts */}
            {mode === 'concept' && conceptStep === 'concepts' && (
              <motion.div
                key="concepts"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <button
                  onClick={goBackInConceptFlow}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back to Ideas
                </button>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Genre</span>
                  </div>
                  <div className="w-8 h-0.5 bg-green-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Ideas</span>
                  </div>
                  <div className="w-8 h-0.5 bg-green-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-sm">3</div>
                    <span className="text-amber-400 font-medium">Concepts</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold text-sm">4</div>
                    <span className="text-slate-500">Screenplay</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Select a Story Concept</h3>
                    <p className="text-slate-400 text-sm">
                      Based on: <span className="text-amber-400">{useCustomIdea ? customIdea.slice(0, 50) + '...' : selectedIdea?.title}</span>
                    </p>
                  </div>
                  <button
                    onClick={generateConcepts}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="ml-3 text-slate-300">Generating story concepts...</span>
                  </div>
                ) : (
                  <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                    {concepts.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => setSelectedConcept(concept)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedConcept?.id === concept.id
                            ? 'bg-amber-500/20 border-amber-500'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-semibold text-white">{concept.title}</h4>
                          {selectedConcept?.id === concept.id && (
                            <CheckCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-slate-400 text-sm mt-2">{concept.synopsis}</p>
                        <div className="flex flex-wrap gap-3 mt-3 text-xs">
                          <span className="text-purple-400">✨ {concept.dramaticElement || concept.paranormalElement}</span>
                          <span className="text-pink-400">❤️ {concept.emotionalHook}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Runtime Selector */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <label className="flex items-center gap-2 text-amber-400 font-medium mb-3">
                    <Clock className="w-5 h-5" />
                    Target Runtime: {runtime} minutes
                  </label>
                  <div className="flex items-center gap-4 mb-3">
                    <input
                      type="range"
                      min="1"
                      max="240"
                      step="1"
                      value={runtime}
                      onChange={(e) => setRuntime(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        defaultValue={runtimeMMSS}
                        key={`concept-${runtime}`}
                        placeholder="MM:SS"
                        onBlur={(e) => handleRuntimeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRuntimeInput((e.target as HTMLInputElement).value); }}
                        className="w-20 px-2 py-1.5 text-center text-sm bg-slate-900 border border-slate-600 rounded-lg text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
                      />
                      <span className="text-slate-500 text-xs">MM:SS</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>1 min</span>
                    <span>60 min</span>
                    <span>120 min</span>
                    <span>240 min</span>
                  </div>
                </div>

                <button
                  onClick={handleConceptSubmit}
                  disabled={!selectedConcept || loading}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <PenTool className="w-5 h-5" /> Generate Screenplay
                </button>
              </motion.div>
            )}

            {/* Convert Mode */}
            {mode === 'convert' && !generating && !convertComplete && (
              <motion.div
                key="convert"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => { setMode('select'); resetConvertFlow(); }}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Adapt to Screenplay</h3>
                    <p className="text-slate-400 text-sm">Upload or paste your story, transcript, or novel</p>
                  </div>
                </div>

                {/* Persona badge */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-start gap-3">
                  <PenTool className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-400 font-medium text-sm">Award-Winning Professional Screenwriter</p>
                    <p className="text-slate-400 text-xs mt-0.5">30+ years adapting novels, stories, and transcripts for major studios and networks</p>
                  </div>
                </div>

                {/* Input mode toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setConvertInputMode('file')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      convertInputMode === 'file'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Upload className="w-4 h-4" /> Upload File
                  </button>
                  <button
                    onClick={() => setConvertInputMode('text')}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      convertInputMode === 'text'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <ClipboardPaste className="w-4 h-4" /> Paste Text
                  </button>
                </div>

                {convertInputMode === 'file' ? (
                  <div className="space-y-4">
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                        convertFile
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      {convertFile ? (
                        <div className="space-y-2">
                          <FileText className="w-10 h-10 text-emerald-400 mx-auto" />
                          <p className="text-white font-medium">{convertFile.name}</p>
                          <p className="text-slate-400 text-sm">{(convertFile.size / 1024).toFixed(1)} KB</p>
                          <button
                            onClick={() => setConvertFile(null)}
                            className="text-red-400 text-sm hover:text-red-300 mt-2"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                          <p className="text-white font-medium mb-1">Drop your file here or click to browse</p>
                          <p className="text-slate-500 text-sm">Supports .txt, .md, .doc, .docx, .pdf</p>
                          <input
                            type="file"
                            accept=".txt,.md,.doc,.docx,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setConvertFile(file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Title (optional)"
                      value={convertTitle}
                      onChange={(e) => setConvertTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <textarea
                      placeholder="Paste your story, transcript, or novel text here..."
                      value={convertText}
                      onChange={(e) => setConvertText(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono text-sm"
                    />
                    <p className="text-slate-500 text-xs text-right">{convertText.length.toLocaleString()} characters</p>
                  </div>
                )}

                {/* Runtime */}
                <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span className="text-white text-sm font-medium">Target Runtime:</span>
                  <input
                    type="text"
                    defaultValue={runtimeMMSS}
                    onBlur={(e) => handleRuntimeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRuntimeInput((e.target as HTMLInputElement).value); }}
                    className="w-20 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="MM:SS"
                  />
                  <span className="text-slate-500 text-xs">MM:SS (1-240 min)</span>
                </div>

                <button
                  onClick={handleConvertSubmit}
                  disabled={generating || (convertInputMode === 'file' ? !convertFile : convertText.trim().length < 50)}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-700 text-white disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <BookMarked className="w-5 h-5" />
                  Adapt to Screenplay
                </button>
              </motion.div>
            )}

            {/* Convert Complete */}
            {mode === 'convert' && convertComplete && !generating && (
              <motion.div
                key="convert-complete"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Screenplay Adapted!</h3>
                  <p className="text-slate-400">{screenplayTitle} • {runtime} minutes</p>
                  <p className="text-emerald-400 text-sm mt-1">By Award-Winning Professional Screenwriter AI</p>
                </div>

                {/* Download Options */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h4 className="text-emerald-400 font-medium mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Download Screenplay
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => downloadScreenplay('txt')}
                      className="p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-center"
                    >
                      <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <span className="text-white font-medium">TXT</span>
                      <p className="text-slate-500 text-xs mt-1">Plain Text</p>
                    </button>
                    <button
                      onClick={() => downloadScreenplay('doc')}
                      className="p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-center"
                    >
                      <FileText className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <span className="text-white font-medium">DOC</span>
                      <p className="text-slate-500 text-xs mt-1">Word 97-2003</p>
                    </button>
                    <button
                      onClick={() => downloadScreenplay('docx')}
                      className="p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-center"
                    >
                      <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <span className="text-white font-medium">DOCX</span>
                      <p className="text-slate-500 text-xs mt-1">Word Document</p>
                    </button>
                  </div>
                </div>

                {/* Screenplay Preview */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h4 className="text-emerald-400 font-medium mb-4">Screenplay Preview</h4>
                  <div className="bg-slate-900 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono text-sm">
                      {screenplay.slice(0, 2000)}{screenplay.length > 2000 && '\n\n... [Preview truncated]'}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { resetConvertFlow(); }}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" /> Convert Another
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Use as Screenplay Source
                  </button>
                </div>
              </motion.div>
            )}

            {/* Generating State */}
            {(generating || conceptStep === 'generating') && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Generating Screenplay</h3>
                  <p className="text-slate-400">{progress}</p>
                </div>

                {screenplay && (
                  <div className="bg-slate-800/50 rounded-xl p-6 max-h-96 overflow-y-auto">
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono text-sm">
                      {screenplay}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}

            {/* Complete - Screenplay Preview with Download */}
            {mode === 'concept' && conceptStep === 'complete' && !generating && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Progress Indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Genre</span>
                  </div>
                  <div className="w-8 h-0.5 bg-green-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Ideas</span>
                  </div>
                  <div className="w-8 h-0.5 bg-green-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Concepts</span>
                  </div>
                  <div className="w-8 h-0.5 bg-green-500" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm"><CheckCircle className="w-4 h-4" /></div>
                    <span className="text-green-400 font-medium">Complete</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Screenplay Complete!</h3>
                  <p className="text-slate-400">{screenplayTitle} • {runtime} minutes</p>
                </div>

                {/* Download Options */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h4 className="text-amber-400 font-medium mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Download Screenplay
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => downloadScreenplay('txt')}
                      className="p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-center"
                    >
                      <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <span className="text-white font-medium">TXT</span>
                      <p className="text-slate-500 text-xs mt-1">Plain Text</p>
                    </button>
                    <button
                      onClick={() => downloadScreenplay('doc')}
                      className="p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-center"
                    >
                      <FileText className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                      <span className="text-white font-medium">DOC</span>
                      <p className="text-slate-500 text-xs mt-1">Word 97-2003</p>
                    </button>
                    <button
                      onClick={() => downloadScreenplay('docx')}
                      className="p-4 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition-all text-center"
                    >
                      <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <span className="text-white font-medium">DOCX</span>
                      <p className="text-slate-500 text-xs mt-1">Word Document</p>
                    </button>
                  </div>
                </div>

                {/* Screenplay Preview */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h4 className="text-amber-400 font-medium mb-4">Screenplay Preview</h4>
                  <div className="bg-slate-900 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                    <pre className="text-slate-300 whitespace-pre-wrap font-mono text-sm">
                      {screenplay.slice(0, 2000)}{screenplay.length > 2000 && '\n\n... [Preview truncated]'}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetConceptFlow}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" /> Create Another
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Continue to Prompts
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
