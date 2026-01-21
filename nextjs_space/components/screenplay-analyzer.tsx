'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Loader2, X, CheckCircle, AlertCircle,
  Camera, Sun, Film, Palette, Sparkles
} from 'lucide-react';
import { AnalysisRecommendations, SelectionState } from '@/lib/types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['.txt', '.docx', '.pdf'];
      const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      if (!validTypes.includes(ext)) {
        setError('Please upload a .txt, .docx, or .pdf file');
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
      const validTypes = ['.txt', '.docx', '.pdf'];
      const ext = droppedFile.name.toLowerCase().slice(droppedFile.name.lastIndexOf('.'));
      if (!validTypes.includes(ext)) {
        setError('Please upload a .txt, .docx, or .pdf file');
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

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/screenplay/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setScreenplay(data.screenplay);
      setAnalysis(data.analysis);

      onAnalysisComplete({
        screenplay: data.screenplay,
        analysis: data.analysis,
        characters: data.analysis.characters || [],
        environments: data.analysis.environments || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze screenplay');
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
        // Use 'camera' key to match prompt-builder's Selections interface
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
      // Use 'camera' key to match prompt-builder's Selections interface
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
          <h2 className="text-2xl font-bold text-amber-400">Screenplay Analyzer</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
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
                {/* File Upload */}
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
                    accept=".txt,.docx,.pdf"
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
                      <p className="text-slate-500 text-xs mt-4">Supports .txt, .docx, .pdf</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={analyzeScreenplay}
                  disabled={!file || loading}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 text-slate-900 disabled:text-slate-500 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Screenplay...</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> Analyze & Get Recommendations</>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="analysis"
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
                      <p className="text-white font-medium">{analysis.title || 'Untitled'}</p>
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

                {/* Recommendations */}
                <div className="bg-slate-800/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Visual Recommendations</h3>
                    <button
                      onClick={applyAllRecommendations}
                      className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-400 text-sm transition-colors"
                    >
                      Apply All
                    </button>
                  </div>

                  <div className="space-y-4">
                    {analysis.recommendations.imageType && (
                      <RecommendationRow
                        icon={<Palette className="w-5 h-5" />}
                        label="Image Type"
                        value={analysis.recommendations.imageType.recommended}
                        reason={analysis.recommendations.imageType.reason}
                        onApply={() => applyRecommendation('imageType', analysis.recommendations.imageType!.recommended)}
                      />
                    )}
                    {analysis.recommendations.cameraBody && (
                      <RecommendationRow
                        icon={<Camera className="w-5 h-5" />}
                        label="Camera Body"
                        value={analysis.recommendations.cameraBody.recommended}
                        reason={analysis.recommendations.cameraBody.reason}
                        onApply={() => applyRecommendation('cameraBody', analysis.recommendations.cameraBody!.recommended)}
                      />
                    )}
                    {analysis.recommendations.focalLength && (
                      <RecommendationRow
                        icon={<Camera className="w-5 h-5" />}
                        label="Focal Length"
                        value={analysis.recommendations.focalLength.recommended}
                        reason={analysis.recommendations.focalLength.reason}
                        onApply={() => applyRecommendation('focalLength', analysis.recommendations.focalLength!.recommended)}
                      />
                    )}
                    {analysis.recommendations.lensType && (
                      <RecommendationRow
                        icon={<Camera className="w-5 h-5" />}
                        label="Lens Type"
                        value={analysis.recommendations.lensType.recommended}
                        reason={analysis.recommendations.lensType.reason}
                        onApply={() => applyRecommendation('lensType', analysis.recommendations.lensType!.recommended)}
                      />
                    )}
                    {analysis.recommendations.lighting && analysis.recommendations.lighting[0] && (
                      <RecommendationRow
                        icon={<Sun className="w-5 h-5" />}
                        label="Lighting"
                        value={analysis.recommendations.lighting[0].type}
                        reason={analysis.recommendations.lighting[0].reason}
                        onApply={() => {}}
                      />
                    )}
                    {analysis.recommendations.filmStock && (
                      <RecommendationRow
                        icon={<Film className="w-5 h-5" />}
                        label="Film Stock"
                        value={analysis.recommendations.filmStock.recommended}
                        reason={analysis.recommendations.filmStock.reason}
                        onApply={() => applyRecommendation('filmStock', analysis.recommendations.filmStock!.recommended)}
                      />
                    )}
                    {analysis.recommendations.photographerStyle && (
                      <RecommendationRow
                        icon={<Sparkles className="w-5 h-5" />}
                        label="Photographer Style"
                        value={analysis.recommendations.photographerStyle.recommended}
                        reason={analysis.recommendations.photographerStyle.reason}
                        onApply={() => applyRecommendation('photographerStyle', analysis.recommendations.photographerStyle!.recommended)}
                      />
                    )}
                    {analysis.recommendations.movieStyle && (
                      <RecommendationRow
                        icon={<Film className="w-5 h-5" />}
                        label="Movie Style"
                        value={analysis.recommendations.movieStyle.recommended}
                        reason={analysis.recommendations.movieStyle.reason}
                        onApply={() => applyRecommendation('movieStyle', analysis.recommendations.movieStyle!.recommended)}
                      />
                    )}
                  </div>
                </div>

                {/* Characters & Environments */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Characters ({analysis.characters?.length || 0})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {analysis.characters?.map((char, i) => (
                        <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-amber-400 font-medium">{char.name}</p>
                          <p className="text-slate-400 text-sm">{char.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Environments ({analysis.environments?.length || 0})</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {analysis.environments?.map((env, i) => (
                        <div key={i} className="bg-slate-900/50 rounded-lg p-3">
                          <p className="text-amber-400 font-medium">{env.name}</p>
                          <p className="text-slate-400 text-sm">{env.description}</p>
                        </div>
                      ))}
                    </div>
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
  icon,
  label,
  value,
  reason,
  onApply
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  reason: string;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-900/50 rounded-lg">
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
