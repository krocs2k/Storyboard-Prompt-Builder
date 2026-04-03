'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Loader2, X, CheckCircle, AlertCircle,
  Camera, Sun, Film, Palette, Sparkles
} from 'lucide-react';
import { AnalysisRecommendations, SelectionState, DialogueLine } from '@/lib/types';
import { authFetch } from '@/lib/utils';

interface ScreenplayAnalyzerProps {
  onAnalysisComplete: (data: {
    screenplay: string;
    analysis: AnalysisRecommendations;
    characters: Array<{ name: string; description: string }>;
    environments: Array<{ name: string; description: string }>;
    dialogueLines: DialogueLine[];
  }) => void;
  onRecommendationsApply: (selections: Partial<SelectionState>) => void;
  currentSelections: SelectionState;
  onClose: () => void;
}

const PROGRESS_STEPS = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'reading', label: 'Reading File', icon: FileText },
  { id: 'analyzing', label: 'Analyzing', icon: Sparkles },
  { id: 'extracting', label: 'Extracting Dialogue', icon: FileText },
  { id: 'complete', label: 'Complete', icon: CheckCircle },
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
  const [currentProgressStep, setCurrentProgressStep] = useState(0);
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
    setCurrentProgressStep(1);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const progressInterval = setInterval(() => {
        setCurrentProgressStep(prev => {
          if (prev < 3) return prev + 1;
          return prev;
        });
      }, 1500);

      const response = await authFetch('/api/screenplay/analyze', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setCurrentProgressStep(4);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setScreenplay(data.screenplay);
      setAnalysis(data.analysis);
      setDialogueLines(data.dialogueLines || []);

      // Pass all data including dialogue lines to parent
      onAnalysisComplete({
        screenplay: data.screenplay,
        analysis: data.analysis,
        characters: data.analysis.characters || [],
        environments: data.analysis.environments || [],
        dialogueLines: data.dialogueLines || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze screenplay');
      setCurrentProgressStep(0);
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = (category: string, value: string) => {
    const selections: Partial<SelectionState> = {};
    
    switch (category) {
      case 'imageType':
        selections.imageType = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'cameraBody':
        (selections as Record<string, unknown>).camera = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'focalLength':
        selections.focalLength = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'lensType':
        selections.lensType = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'filmStock':
        selections.filmStock = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'aspectRatio':
        selections.aspectRatio = value;
        break;
      case 'photographerStyle':
        selections.photographer = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'movieStyle':
        selections.movie = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'filterEffect':
        selections.filter = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
      case 'lighting':
        selections.lighting = { id: value.toLowerCase().replace(/\s+/g, '-'), name: value };
        break;
    }

    onRecommendationsApply(selections);
  };

  const applyAllRecommendations = () => {
    if (!analysis?.recommendations) return;

    const r = analysis.recommendations;
    const selections: Partial<SelectionState> = {};

    if (r.imageType?.recommended) {
      selections.imageType = { id: r.imageType.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.imageType.recommended };
    }
    if (r.cameraBody?.recommended) {
      (selections as Record<string, unknown>).camera = { id: r.cameraBody.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.cameraBody.recommended };
    }
    if (r.focalLength?.recommended) {
      selections.focalLength = { id: r.focalLength.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.focalLength.recommended };
    }
    if (r.lensType?.recommended) {
      selections.lensType = { id: r.lensType.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.lensType.recommended };
    }
    if (r.filmStock?.recommended) {
      selections.filmStock = { id: r.filmStock.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.filmStock.recommended };
    }
    if (r.aspectRatio?.recommended) {
      selections.aspectRatio = r.aspectRatio.recommended;
    }
    if (r.photographerStyle?.recommended) {
      selections.photographer = { id: r.photographerStyle.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.photographerStyle.recommended };
    }
    if (r.movieStyle?.recommended) {
      selections.movie = { id: r.movieStyle.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.movieStyle.recommended };
    }
    if (r.filterEffect?.recommended) {
      selections.filter = { id: r.filterEffect.recommended.toLowerCase().replace(/\s+/g, '-'), name: r.filterEffect.recommended };
    }
    if (r.lighting?.[0]) {
      selections.lighting = { id: r.lighting[0].type.toLowerCase().replace(/\s+/g, '-'), name: r.lighting[0].type };
    }

    onRecommendationsApply(selections);
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
          <h2 className="text-2xl font-bold text-amber-400">Upload Screenplay</h2>
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
                key="recommendations"
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

                {/* Visual Recommendations for Sections 1, 3, 4, 5 */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Visual Recommendations</h3>
                    <button
                      onClick={applyAllRecommendations}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-400 text-sm transition-colors"
                    >
                      Apply All to Sections 1, 3, 4, 5
                    </button>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">These recommendations will be applied to the main prompt builder sections.</p>

                  <div className="space-y-4">
                    {/* Section 1: Image Type */}
                    {analysis.recommendations.imageType && (
                      <RecommendationRow
                        section={1}
                        icon={<Palette className="w-5 h-5" />}
                        label="Image Type"
                        value={analysis.recommendations.imageType.recommended}
                        reason={analysis.recommendations.imageType.reason}
                        onApply={() => applyRecommendation('imageType', analysis.recommendations.imageType!.recommended)}
                      />
                    )}
                    
                    {/* Section 3: Lighting */}
                    {analysis.recommendations.lighting && analysis.recommendations.lighting[0] && (
                      <RecommendationRow
                        section={3}
                        icon={<Sun className="w-5 h-5" />}
                        label="Lighting"
                        value={analysis.recommendations.lighting[0].type}
                        reason={analysis.recommendations.lighting[0].reason}
                        onApply={() => applyRecommendation('lighting', analysis.recommendations.lighting![0].type)}
                      />
                    )}
                    
                    {/* Section 4: Camera Gear */}
                    {analysis.recommendations.cameraBody && (
                      <RecommendationRow
                        section={4}
                        icon={<Camera className="w-5 h-5" />}
                        label="Camera Body"
                        value={analysis.recommendations.cameraBody.recommended}
                        reason={analysis.recommendations.cameraBody.reason}
                        onApply={() => applyRecommendation('cameraBody', analysis.recommendations.cameraBody!.recommended)}
                      />
                    )}
                    {analysis.recommendations.focalLength && (
                      <RecommendationRow
                        section={4}
                        icon={<Camera className="w-5 h-5" />}
                        label="Focal Length"
                        value={analysis.recommendations.focalLength.recommended}
                        reason={analysis.recommendations.focalLength.reason}
                        onApply={() => applyRecommendation('focalLength', analysis.recommendations.focalLength!.recommended)}
                      />
                    )}
                    {analysis.recommendations.lensType && (
                      <RecommendationRow
                        section={4}
                        icon={<Camera className="w-5 h-5" />}
                        label="Lens Type"
                        value={analysis.recommendations.lensType.recommended}
                        reason={analysis.recommendations.lensType.reason}
                        onApply={() => applyRecommendation('lensType', analysis.recommendations.lensType!.recommended)}
                      />
                    )}
                    {analysis.recommendations.filmStock && (
                      <RecommendationRow
                        section={4}
                        icon={<Film className="w-5 h-5" />}
                        label="Film Stock"
                        value={analysis.recommendations.filmStock.recommended}
                        reason={analysis.recommendations.filmStock.reason}
                        onApply={() => applyRecommendation('filmStock', analysis.recommendations.filmStock!.recommended)}
                      />
                    )}
                    {analysis.recommendations.aspectRatio && (
                      <RecommendationRow
                        section={4}
                        icon={<Film className="w-5 h-5" />}
                        label="Aspect Ratio"
                        value={analysis.recommendations.aspectRatio.recommended}
                        reason={analysis.recommendations.aspectRatio.reason}
                        onApply={() => applyRecommendation('aspectRatio', analysis.recommendations.aspectRatio!.recommended)}
                      />
                    )}
                    
                    {/* Section 5: Style & Aesthetics */}
                    {analysis.recommendations.photographerStyle && (
                      <RecommendationRow
                        section={5}
                        icon={<Sparkles className="w-5 h-5" />}
                        label="Photographer Style"
                        value={analysis.recommendations.photographerStyle.recommended}
                        reason={analysis.recommendations.photographerStyle.reason}
                        onApply={() => applyRecommendation('photographerStyle', analysis.recommendations.photographerStyle!.recommended)}
                      />
                    )}
                    {analysis.recommendations.movieStyle && (
                      <RecommendationRow
                        section={5}
                        icon={<Film className="w-5 h-5" />}
                        label="Movie Style"
                        value={analysis.recommendations.movieStyle.recommended}
                        reason={analysis.recommendations.movieStyle.reason}
                        onApply={() => applyRecommendation('movieStyle', analysis.recommendations.movieStyle!.recommended)}
                      />
                    )}
                    {analysis.recommendations.filterEffect && (
                      <RecommendationRow
                        section={5}
                        icon={<Sparkles className="w-5 h-5" />}
                        label="Filter Effect"
                        value={analysis.recommendations.filterEffect.recommended}
                        reason={analysis.recommendations.filterEffect.reason}
                        onApply={() => applyRecommendation('filterEffect', analysis.recommendations.filterEffect!.recommended)}
                      />
                    )}
                  </div>
                </div>

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

function RecommendationRow({
  section,
  icon,
  label,
  value,
  reason,
  onApply
}: {
  section: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  reason: string;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
        {section}
      </div>
      <div className="text-amber-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-white font-medium truncate">{value}</p>
        <p className="text-slate-500 text-xs truncate">{reason}</p>
      </div>
      <button
        onClick={onApply}
        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded text-amber-400 text-sm transition-colors flex-shrink-0"
      >
        Apply
      </button>
    </div>
  );
}
