'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Frame, Sun, Camera, Sparkles, FileText, Copy, Check, 
  Trash2, Film, Aperture, Image as ImageIcon, Save, History
} from 'lucide-react';
import { SectionCard } from './section-card';
import { SelectionButton } from './selection-button';
import { SelectionModal } from './selection-modal';
import { TextInput } from './text-input';
import { DropdownSelect } from './dropdown-select';
import {
  imageTypes, shotTypes, lightingSources, cameraBodies, focalLengths,
  lensTypes, filmStocks, aspectRatios, photographerStyles, movieStyles, filterEffects,
  ImageType, LightingSource, CameraBody, FocalLength, LensType, FilmStock,
  PhotographerStyle, MovieStyle, FilterEffect
} from '@/lib/data';

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
      await navigator?.clipboard?.writeText(constructedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
            className="text-amber-100/60 text-lg max-w-2xl mx-auto"
          >
            Craft cinematic image prompts with precision. Select your visual style, framing, lighting, and more.
          </motion.p>
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
      </div>

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
