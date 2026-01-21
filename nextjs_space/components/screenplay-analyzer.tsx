'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Loader2, X, CheckCircle, AlertCircle,
  Camera, Sun, Film, Palette, Sparkles, Download, Mic,
  Users, MapPin, Clapperboard, List, ChevronRight, Copy
} from 'lucide-react';
import { AnalysisRecommendations, SelectionState, DialogueLine, CharacterPrompt, EnvironmentPrompt } from '@/lib/types';

interface StoryboardBlock {
  blockNumber: number;
  timestampStart: string;
  timestampEnd: string;
  scene: string;
  location: string;
  subjectAction: string;
  environment: string;
  atmosphere: string;
  shotType: string;
  lighting: string;
  prompt: string;
  notes: string;
}

interface ShotlistItem {
  blockNumber: number;
  shotType: string;
  action: string;
  prompt: string;
}

interface StoryboardData {
  blocks: StoryboardBlock[];
  shotlist: Record<string, ShotlistItem[]>;
  summary: {
    totalBlocks: number;
    estimatedRuntime: number;
    uniqueLocations: number;
    locations: string[];
  };
}

interface ScreenplayAnalyzerProps {
  onAnalysisComplete: (data: {
    screenplay: string;
    analysis: AnalysisRecommendations;
    characters: Array<{ name: string; description: string }>;
    environments: Array<{ name: string; description: string }>;
  }) => void;
  onRecommendationsApply: (selections: Partial<SelectionState>) => void;
  currentSelections: SelectionState;
  onClose: () => void;
}

const PROGRESS_STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'reading', label: 'Reading File', icon: FileText },
  { id: 'analyzing', label: 'Analyzing', icon: Sparkles },
  { id: 'extracting', label: 'Extracting Dialogue', icon: Mic },
  { id: 'complete', label: 'Complete', icon: CheckCircle },
];

const WORKFLOW_STEPS = [
  { id: 1, label: 'Voice-Over Prompts', icon: Mic, description: 'Download dialogue with delivery directions' },
  { id: 2, label: 'Character & Environment Prompts', icon: Users, description: 'Generate image prompts for characters and locations' },
  { id: 3, label: 'Storyboard & Shotlist', icon: Clapperboard, description: 'Create visual storyboard and shot breakdown' },
];

export default function ScreenplayAnalyzer({
  onAnalysisComplete,
  onRecommendationsApply,
  currentSelections,
  onClose
}: ScreenplayAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisRecommendations | null>(null);
  const [screenplay, setScreenplay] = useState('');
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>([]);
  const [downloadingVO, setDownloadingVO] = useState<'docx' | 'csv' | null>(null);
  const [currentProgressStep, setCurrentProgressStep] = useState(0);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(1);
  
  // Step 2: Character & Environment Prompts
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [characterPrompts, setCharacterPrompts] = useState<CharacterPrompt[]>([]);
  const [environmentPrompts, setEnvironmentPrompts] = useState<EnvironmentPrompt[]>([]);
  
  // Step 3: Storyboard & Shotlist
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [storyboardData, setStoryboardData] = useState<StoryboardData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['.txt', '.md', '.doc', '.docx'];
      const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      if (!validTypes.includes(ext)) {
        setError('Please upload a .txt, .md, .doc, or .docx file');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validTypes = ['.txt', '.md', '.doc', '.docx'];
      const ext = droppedFile.name.toLowerCase().slice(droppedFile.name.lastIndexOf('.'));
      if (!validTypes.includes(ext)) {
        setError('Please upload a .txt, .md, .doc, or .docx file');
        return;
      }
      setFile(droppedFile);
      setError('');
    }
  };

  const analyzeScreenplay = async () => {
    if (!file) return;

    setLoading(true);
    setError('');
    setCurrentProgressStep(1); // Reading File

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate progress steps
      const progressInterval = setInterval(() => {
        setCurrentProgressStep(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 1500);

      const response = await fetch('/api/screenplay/analyze', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setCurrentProgressStep(4); // Complete

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setScreenplay(data.screenplay);
      setAnalysis(data.analysis);
      setDialogueLines(data.dialogueLines || []);

      onAnalysisComplete({
        screenplay: data.screenplay,
        analysis: data.analysis,
        characters: data.analysis.characters || [],
        environments: data.analysis.environments || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze screenplay');
      setCurrentProgressStep(0);
    } finally {
      setLoading(false);
    }
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
            title: analysis?.title || 'Screenplay',
          }),
        });

        if (!response.ok) throw new Error('Failed to download voice-over script');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(analysis?.title || 'Screenplay').replace(/[^a-zA-Z0-9\s-]/g, '')}_VoiceOver.docx`;
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
        a.download = `${(analysis?.title || 'Screenplay').replace(/[^a-zA-Z0-9\s-]/g, '')}_VoiceOver.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download voice-over script');
    } finally {
      setDownloadingVO(null);
    }
  };

  const generateCharacterEnvironmentPrompts = async () => {
    if (!screenplay || !analysis) return;
    
    setGeneratingPrompts(true);
    setError('');
    
    try {
      const response = await fetch('/api/screenplay/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenplay: screenplay.substring(0, 15000),
          characters: analysis.characters || [],
          environments: analysis.environments || [],
          selections: currentSelections,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'completed') {
                setCharacterPrompts(parsed.characterPrompts || []);
                setEnvironmentPrompts(parsed.environmentPrompts || []);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompts');
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const generateStoryboard = async () => {
    if (!screenplay || !analysis) return;
    
    setGeneratingStoryboard(true);
    setError('');
    
    try {
      const response = await fetch('/api/storyboard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenplay: screenplay.substring(0, 15000),
          selections: currentSelections,
          runtime: analysis.estimatedRuntime || 15,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.status === 'completed' && parsed.storyboard) {
                setStoryboardData(parsed.storyboard);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate storyboard');
    } finally {
      setGeneratingStoryboard(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
          <h2 className="text-2xl font-bold text-amber-400">Screenplay Analyzer</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {!analysis ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Progress Indicator */}
                {loading && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      {PROGRESS_STEPS.map((step, index) => {
                        const StepIcon = step.icon;
                        const isActive = index === currentProgressStep;
                        const isComplete = index < currentProgressStep;
                        
                        return (
                          <div key={step.id} className="flex items-center">
                            <div className="flex flex-col items-center">
                              <motion.div
                                animate={{
                                  scale: isActive ? [1, 1.1, 1] : 1,
                                  backgroundColor: isComplete ? '#f59e0b' : isActive ? '#f59e0b' : '#334155'
                                }}
                                transition={{
                                  scale: { repeat: isActive ? Infinity : 0, duration: 1 },
                                  backgroundColor: { duration: 0.3 }
                                }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  isActive ? 'ring-4 ring-amber-500/30' : ''
                                }`}
                              >
                                {isComplete ? (
                                  <CheckCircle className="w-5 h-5 text-slate-900" />
                                ) : isActive ? (
                                  <Loader2 className="w-5 h-5 text-slate-900 animate-spin" />
                                ) : (
                                  <StepIcon className="w-5 h-5 text-slate-500" />
                                )}
                              </motion.div>
                              <span className={`text-xs mt-2 ${
                                isActive || isComplete ? 'text-amber-400' : 'text-slate-500'
                              }`}>
                                {step.label}
                              </span>
                            </div>
                            {index < PROGRESS_STEPS.length - 1 && (
                              <div className={`w-12 h-0.5 mx-2 ${
                                isComplete ? 'bg-amber-500' : 'bg-slate-700'
                              }`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-center">
                      <p className="text-amber-400 font-medium">
                        {PROGRESS_STEPS[currentProgressStep]?.label || 'Processing'}...
                      </p>
                      <p className="text-slate-500 text-sm mt-1">Please wait while we analyze your screenplay</p>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                {!loading && (
                  <>
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                        file
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.doc,.docx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      {file ? (
                        <div className="flex flex-col items-center">
                          <CheckCircle className="w-12 h-12 text-amber-400 mb-4" />
                          <p className="text-white font-medium">{file.name}</p>
                          <p className="text-slate-400 text-sm mt-2">Click to change file</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="w-12 h-12 text-slate-500 mb-4" />
                          <p className="text-white font-medium">Drop your screenplay here</p>
                          <p className="text-slate-400 text-sm mt-2">or click to browse</p>
                          <p className="text-slate-500 text-xs mt-4">Supports .txt, .md, .doc, .docx</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={analyzeScreenplay}
                      disabled={!file || loading}
                      className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-5 h-5" /> Analyze Screenplay
                    </button>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="workflow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Analysis Summary */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Analysis Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm">Title</p>
                      <p className="text-white font-medium truncate">{analysis.title || 'Untitled'}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm">Runtime</p>
                      <p className="text-white font-medium">{analysis.estimatedRuntime || '?'} min</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm">Genre</p>
                      <p className="text-white font-medium">{analysis.genre || 'Unknown'}</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4">
                      <p className="text-slate-400 text-sm">Mood</p>
                      <p className="text-white font-medium">{analysis.mood || 'Unknown'}</p>
                    </div>
                  </div>
                </div>

                {/* Workflow Steps Navigation */}
                <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
                  {WORKFLOW_STEPS.map((step) => {
                    const StepIcon = step.icon;
                    return (
                      <button
                        key={step.id}
                        onClick={() => setActiveWorkflowStep(step.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
                          activeWorkflowStep === step.id
                            ? 'bg-amber-500 text-slate-900'
                            : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        <StepIcon className="w-5 h-5" />
                        <span className="font-medium hidden md:inline">Step {step.id}: {step.label}</span>
                        <span className="font-medium md:hidden">{step.id}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                  {activeWorkflowStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-slate-800/50 rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Mic className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">Voice-Over Prompts</h3>
                            <p className="text-slate-400 text-sm">{dialogueLines.length} dialogue lines extracted</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => downloadVoiceOver('csv')}
                            disabled={downloadingVO !== null || dialogueLines.length === 0}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 border border-slate-600 disabled:border-slate-700 rounded-lg text-white disabled:text-slate-500 text-sm transition-colors flex items-center gap-2"
                          >
                            {downloadingVO === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            CSV
                          </button>
                          <button
                            onClick={() => downloadVoiceOver('docx')}
                            disabled={downloadingVO !== null || dialogueLines.length === 0}
                            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 disabled:bg-slate-800 border border-amber-500/50 disabled:border-slate-700 rounded-lg text-amber-400 disabled:text-slate-500 text-sm transition-colors flex items-center gap-2"
                          >
                            {downloadingVO === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            DOCX
                          </button>
                        </div>
                      </div>
                      
                      {/* Dialogue Preview Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 px-3 text-amber-400 font-medium w-28">Character</th>
                              <th className="text-left py-2 px-3 text-amber-400 font-medium">Dialogue</th>
                              <th className="text-left py-2 px-3 text-amber-400 font-medium w-48">Delivery</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dialogueLines.slice(0, 8).map((line, i) => (
                              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-900/30">
                                <td className="py-2 px-3 text-white font-medium align-top">{line.character}</td>
                                <td className="py-2 px-3 text-slate-300 align-top">{line.dialogue}</td>
                                <td className="py-2 px-3 text-slate-400 italic text-xs align-top">{line.delivery}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {dialogueLines.length > 8 && (
                          <p className="text-slate-500 text-xs mt-2 text-center">
                            Showing 8 of {dialogueLines.length} lines. Download for full script.
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => setActiveWorkflowStep(2)}
                        className="mt-6 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        Continue to Step 2 <ChevronRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}

                  {activeWorkflowStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-slate-800/50 rounded-xl p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-amber-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">Character & Environment Prompts</h3>
                            <p className="text-slate-400 text-sm">
                              {analysis.characters?.length || 0} characters, {analysis.environments?.length || 0} environments
                            </p>
                          </div>
                        </div>
                        {characterPrompts.length === 0 && (
                          <button
                            onClick={generateCharacterEnvironmentPrompts}
                            disabled={generatingPrompts}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-900 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center gap-2"
                          >
                            {generatingPrompts ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="w-4 h-4" /> Generate Prompts</>
                            )}
                          </button>
                        )}
                      </div>

                      {characterPrompts.length > 0 || environmentPrompts.length > 0 ? (
                        <div className="space-y-6">
                          {/* Character Prompts */}
                          {characterPrompts.length > 0 && (
                            <div>
                              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4 text-amber-400" /> Character Prompts
                              </h4>
                              <div className="space-y-3 max-h-64 overflow-y-auto">
                                {characterPrompts.map((char, i) => (
                                  <div key={i} className="bg-slate-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-amber-400 font-medium">{char.name}</p>
                                      <button
                                        onClick={() => copyToClipboard(char.prompt)}
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                        title="Copy prompt"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <p className="text-slate-300 text-sm">{char.prompt}</p>
                                    {char.voicePrompt && (
                                      <div className="mt-2 pt-2 border-t border-slate-700">
                                        <p className="text-slate-500 text-xs mb-1">Voice Prompt:</p>
                                        <p className="text-slate-400 text-xs italic">{char.voicePrompt}</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Environment Prompts */}
                          {environmentPrompts.length > 0 && (
                            <div>
                              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-amber-400" /> Environment Prompts
                              </h4>
                              <div className="space-y-3 max-h-64 overflow-y-auto">
                                {environmentPrompts.map((env, i) => (
                                  <div key={i} className="bg-slate-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-amber-400 font-medium">{env.name}</p>
                                      <button
                                        onClick={() => copyToClipboard(env.prompt)}
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                        title="Copy prompt"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <p className="text-slate-300 text-sm">{env.prompt}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                          <p className="text-slate-400">Click "Generate Prompts" to create image generation prompts</p>
                          <p className="text-slate-500 text-sm mt-1">for characters and environments from your screenplay</p>
                        </div>
                      )}

                      <button
                        onClick={() => setActiveWorkflowStep(3)}
                        className="mt-6 w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        Continue to Step 3 <ChevronRight className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )}

                  {activeWorkflowStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="bg-slate-800/50 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                              <Clapperboard className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">Storyboard & Shotlist</h3>
                              <p className="text-slate-400 text-sm">Visual breakdown with image prompts</p>
                            </div>
                          </div>
                          {!storyboardData && (
                            <button
                              onClick={generateStoryboard}
                              disabled={generatingStoryboard}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-900 disabled:text-slate-400 font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                              {generatingStoryboard ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                              ) : (
                                <><Sparkles className="w-4 h-4" /> Generate Storyboard</>
                              )}
                            </button>
                          )}
                        </div>

                        {generatingStoryboard && (
                          <div className="text-center py-8">
                            <div className="relative w-16 h-16 mx-auto mb-4">
                              <motion.div
                                className="absolute inset-0 border-4 border-amber-500/30 rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              />
                              <motion.div
                                className="absolute inset-2 border-4 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent rounded-full"
                                animate={{ rotate: -360 }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                              />
                              <Clapperboard className="absolute inset-0 m-auto w-6 h-6 text-amber-400" />
                            </div>
                            <p className="text-amber-400 font-medium">Creating Storyboard...</p>
                            <p className="text-slate-500 text-sm mt-1">Breaking down scenes into visual blocks</p>
                          </div>
                        )}

                        {!storyboardData && !generatingStoryboard && (
                          <div className="text-center py-12">
                            <Clapperboard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400">Click "Generate Storyboard" to create visual breakdown</p>
                            <p className="text-slate-500 text-sm mt-1">with shot-by-shot prompts for image generation</p>
                          </div>
                        )}
                      </div>

                      {storyboardData && (
                        <>
                          {/* Storyboard with Prompts */}
                          <div className="bg-slate-800/50 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <Film className="w-5 h-5 text-amber-400" />
                              <h4 className="text-lg font-semibold text-white">Storyboard with Prompts</h4>
                              <span className="text-slate-500 text-sm">({storyboardData.blocks?.length || 0} blocks)</span>
                            </div>
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                              {storyboardData.blocks?.map((block, i) => (
                                <div key={i} className="bg-slate-900/50 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                                        {block.blockNumber}
                                      </span>
                                      <div>
                                        <p className="text-white font-medium text-sm">{block.scene}</p>
                                        <p className="text-slate-500 text-xs">{block.timestampStart} - {block.timestampEnd}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">{block.shotType}</span>
                                      <button
                                        onClick={() => copyToClipboard(block.prompt)}
                                        className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                        title="Copy prompt"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-slate-300 text-sm mt-2">{block.prompt}</p>
                                  {block.notes && (
                                    <p className="text-slate-500 text-xs mt-2 italic">Notes: {block.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Shotlist with Prompts */}
                          <div className="bg-slate-800/50 rounded-xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <List className="w-5 h-5 text-amber-400" />
                              <h4 className="text-lg font-semibold text-white">Shotlist by Location</h4>
                            </div>
                            <div className="space-y-6 max-h-96 overflow-y-auto">
                              {storyboardData.shotlist && Object.entries(storyboardData.shotlist).map(([location, shots], i) => (
                                <div key={i}>
                                  <h5 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> {location}
                                  </h5>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-slate-700">
                                          <th className="text-left py-2 px-3 text-slate-400 font-medium w-16">#</th>
                                          <th className="text-left py-2 px-3 text-slate-400 font-medium w-28">Shot</th>
                                          <th className="text-left py-2 px-3 text-slate-400 font-medium">Prompt</th>
                                          <th className="w-10"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {shots.map((shot, j) => (
                                          <tr key={j} className="border-b border-slate-700/50 hover:bg-slate-900/30">
                                            <td className="py-2 px-3 text-white">{shot.blockNumber}</td>
                                            <td className="py-2 px-3 text-slate-300">{shot.shotType}</td>
                                            <td className="py-2 px-3 text-slate-400 text-xs">{shot.prompt?.substring(0, 150)}...</td>
                                            <td className="py-2 px-3">
                                              <button
                                                onClick={() => copyToClipboard(shot.prompt)}
                                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                                                title="Copy prompt"
                                              >
                                                <Copy className="w-3 h-3" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={onClose}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-semibold rounded-xl transition-all"
                >
                  Continue to Prompt Builder
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
