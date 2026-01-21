'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube, Lightbulb, Clock, Loader2, ChevronRight, RefreshCw,
  CheckCircle, FileText, X, AlertCircle, ClipboardPaste
} from 'lucide-react';
import { StoryConcept } from '@/lib/types';

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

export default function ScreenplayCreator({ onScreenplayCreated, onClose }: ScreenplayCreatorProps) {
  const [mode, setMode] = useState<'select' | 'youtube' | 'concept'>('select');
  const [runtime, setRuntime] = useState(15);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [storyIdea, setStoryIdea] = useState('');
  const [concepts, setConcepts] = useState<StoryConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<StoryConcept | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [screenplay, setScreenplay] = useState('');
  const [error, setError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualTranscript, setManualTranscript] = useState('');

  const fetchTranscript = useCallback(async (useManual = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/youtube-transcript', {
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

  const generateConcepts = useCallback(async () => {
    setLoading(true);
    setError('');
    setConcepts([]);
    try {
      const response = await fetch('/api/screenplay/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyIdea, runtime }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConcepts(data.concepts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate concepts');
    } finally {
      setLoading(false);
    }
  }, [storyIdea, runtime]);

  const generateScreenplay = useCallback(async (sourceType: 'youtube' | 'concept', transcript?: string) => {
    setGenerating(true);
    setProgress('Starting screenplay generation...');
    setScreenplay('');
    setError('');

    try {
      const body = sourceType === 'youtube'
        ? { sourceType, transcript, runtime }
        : { sourceType, storyConcept: `${selectedConcept?.title}\n\n${selectedConcept?.synopsis}\n\nParanormal Element: ${selectedConcept?.paranormalElement}\n\nEmotional Hook: ${selectedConcept?.emotionalHook}`, runtime };

      const response = await fetch('/api/screenplay/generate', {
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
                parseAndComplete(parsed.screenplay, sourceType);
                return;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate screenplay');
    } finally {
      setGenerating(false);
    }
  }, [runtime, selectedConcept]);

  const parseAndComplete = (content: string, sourceType: 'youtube' | 'concept') => {
    // Parse characters and environments from the screenplay
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

    // Extract title from the screenplay
    const titleMatch = content.match(/(?:TITLE:|"([^"]+)"|COLD OPEN|TEASER)\s*\n?([^\n]+)?/i);
    const title = titleMatch?.[1] || titleMatch?.[2] || selectedConcept?.title || 'Untitled Screenplay';

    onScreenplayCreated({
      title: title.trim(),
      content,
      runtime,
      characters: characters.length > 0 ? characters : [{ name: 'HOST', description: 'The show host' }],
      environments: environments.length > 0 ? environments : [{ name: 'STUDIO', description: 'TV studio set' }],
      sourceType,
      sourceUrl: sourceType === 'youtube' ? youtubeUrl : undefined,
      storyIdea: sourceType === 'concept' ? storyIdea : undefined,
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
        className="bg-slate-900 border border-amber-500/30 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-amber-400">AI Screenplay Creator</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <p className="text-slate-300 text-center mb-8">
                  Choose how you want to create your screenplay in the style of "Ghostly Encounters"
                </p>

                {/* Runtime Selector */}
                <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
                  <label className="flex items-center gap-2 text-amber-400 font-medium mb-4">
                    <Clock className="w-5 h-5" />
                    Target Runtime: {runtime} minutes
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={runtime}
                    onChange={(e) => setRuntime(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-sm text-slate-500 mt-2">
                    <span>5 min</span>
                    <span>15 min</span>
                    <span>25 min</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* YouTube Option */}
                  <button
                    onClick={() => setMode('youtube')}
                    className="group p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-500/30 transition-colors">
                      <Youtube className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">From YouTube Testimonial</h3>
                    <p className="text-slate-400 text-sm">
                      Extract a story from a YouTube video transcript and transform it into a dramatic screenplay
                    </p>
                    <div className="flex items-center gap-2 text-amber-400 mt-4 text-sm">
                      Get Started <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Story Concept Option */}
                  <button
                    onClick={() => setMode('concept')}
                    className="group p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all"
                  >
                    <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500/30 transition-colors">
                      <Lightbulb className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">From Story Idea</h3>
                    <p className="text-slate-400 text-sm">
                      Provide a story idea and get 5 unique concepts to choose from, then generate a full screenplay
                    </p>
                    <div className="flex items-center gap-2 text-amber-400 mt-4 text-sm">
                      Get Started <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

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
                  <p className="text-slate-500 text-sm mt-2">
                    The transcript will be automatically extracted from the video.
                  </p>
                </div>

                {/* Manual Transcript Input - Shows when auto-extract fails */}
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
                          YouTube is blocking automatic extraction. Please copy the transcript from the video and paste it below.
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                      <p className="text-slate-300 text-sm font-medium mb-2">How to get the transcript:</p>
                      <ol className="text-slate-400 text-sm space-y-1 list-decimal list-inside">
                        <li>Open the video on YouTube</li>
                        <li>Click the <strong>...</strong> (More) button below the video</li>
                        <li>Click <strong>Show transcript</strong></li>
                        <li>Click the three dots in the transcript panel and select <strong>Toggle timestamps</strong> to hide timestamps (optional)</li>
                        <li>Select all text and copy (Ctrl/Cmd + A, then Ctrl/Cmd + C)</li>
                      </ol>
                    </div>
                    
                    <label className="flex items-center gap-2 text-amber-400 font-medium mb-2">
                      <ClipboardPaste className="w-4 h-4" />
                      Paste Transcript Here
                    </label>
                    <textarea
                      value={manualTranscript}
                      onChange={(e) => setManualTranscript(e.target.value)}
                      placeholder="Paste the transcript text here..."
                      rows={8}
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none font-mono text-sm"
                    />
                    {manualTranscript && (
                      <p className="text-slate-500 text-xs mt-2">
                        {manualTranscript.split(/\s+/).filter(w => w).length} words
                      </p>
                    )}
                  </motion.div>
                )}

                <div className="bg-slate-800/50 rounded-xl p-6">
                  <label className="flex items-center gap-2 text-amber-400 font-medium mb-4">
                    <Clock className="w-5 h-5" />
                    Target Runtime: {runtime} minutes
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="25"
                    value={runtime}
                    onChange={(e) => setRuntime(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {showManualInput ? (
                  <button
                    onClick={handleManualTranscriptSubmit}
                    disabled={!manualTranscript.trim() || loading}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                    ) : (
                      <><FileText className="w-5 h-5" /> Generate Screenplay from Pasted Transcript</>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleYoutubeSubmit}
                    disabled={!youtubeUrl || loading}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Importing Transcript...</>
                    ) : (
                      <><FileText className="w-5 h-5" /> Generate Screenplay</>
                    )}
                  </button>
                )}
              </motion.div>
            )}

            {mode === 'concept' && !generating && (
              <motion.div
                key="concept"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <button
                  onClick={() => { setMode('select'); setConcepts([]); setSelectedConcept(null); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>

                {concepts.length === 0 ? (
                  <>
                    <div className="bg-slate-800/50 rounded-xl p-6">
                      <label className="flex items-center gap-2 text-amber-400 font-medium mb-4">
                        <Lightbulb className="w-5 h-5" />
                        Story Idea or Subject
                      </label>
                      <textarea
                        value={storyIdea}
                        onChange={(e) => setStoryIdea(e.target.value)}
                        placeholder="e.g., A family moves into an old Victorian house and discovers the previous owners never really left..."
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none resize-none"
                      />
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-6">
                      <label className="flex items-center gap-2 text-amber-400 font-medium mb-4">
                        <Clock className="w-5 h-5" />
                        Target Runtime: {runtime} minutes
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="25"
                        value={runtime}
                        onChange={(e) => setRuntime(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <button
                      onClick={generateConcepts}
                      disabled={!storyIdea || loading}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Generating Concepts...</>
                      ) : (
                        <><Lightbulb className="w-5 h-5" /> Generate 5 Story Concepts</>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Select a Story Concept</h3>
                      <button
                        onClick={generateConcepts}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                    </div>

                    <div className="space-y-4">
                      {concepts.map((concept) => (
                        <button
                          key={concept.id}
                          onClick={() => setSelectedConcept(concept)}
                          className={`w-full p-4 rounded-xl border text-left transition-all ${
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
                          <div className="flex gap-4 mt-3 text-xs">
                            <span className="text-purple-400">👻 {concept.paranormalElement}</span>
                            <span className="text-pink-400">❤️ {concept.emotionalHook}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleConceptSubmit}
                      disabled={!selectedConcept}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <FileText className="w-5 h-5" /> Generate Screenplay
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {generating && (
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
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
