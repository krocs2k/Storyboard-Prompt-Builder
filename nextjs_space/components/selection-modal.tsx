'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Check, Camera, Film, Palette, Sun, Aperture, ImageIcon } from 'lucide-react';
import Image from 'next/image';

interface Option {
  id: string;
  name: string;
  description?: string;
  image?: string;
  style?: string;
}

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  selectedId: string | null;
  onSelect: (option: Option) => void;
  showDescription?: boolean;
  filterStyle?: string;
}

export function SelectionModal({
  isOpen,
  onClose,
  title,
  options,
  selectedId,
  onSelect,
  showDescription = false,
  filterStyle,
}: SelectionModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    let filtered = options ?? [];
    
    if (filterStyle) {
      filtered = filtered?.filter((o) => o?.style === filterStyle) ?? [];
    }
    
    if (search) {
      const lower = search?.toLowerCase() ?? '';
      filtered = filtered?.filter(
        (o) =>
          (o?.name?.toLowerCase()?.includes(lower) ?? false) ||
          (o?.description?.toLowerCase()?.includes(lower) ?? false)
      ) ?? [];
    }
    
    return filtered;
  }, [options, search, filterStyle]);

  const getPlaceholderIcon = (name: string) => {
    const lower = name?.toLowerCase() ?? '';
    if (lower?.includes('camera') || lower?.includes('shot') || lower?.includes('angle')) return Camera;
    if (lower?.includes('film') || lower?.includes('movie')) return Film;
    if (lower?.includes('light') || lower?.includes('sun')) return Sun;
    if (lower?.includes('lens') || lower?.includes('focal')) return Aperture;
    if (lower?.includes('color') || lower?.includes('style')) return Palette;
    return ImageIcon;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl max-w-5xl w-full max-h-[85vh] overflow-hidden border border-amber-500/20 shadow-2xl shadow-amber-500/10"
          onClick={(e) => e?.stopPropagation?.()}
        >
          {/* Header */}
          <div className="p-6 border-b border-amber-500/20 bg-slate-900/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-amber-100">{title ?? ''}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-amber-500/20 rounded-lg transition-colors text-amber-400"
              >
                <X size={24} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/50" size={20} />
              <input
                type="text"
                placeholder="Search options..."
                value={search ?? ''}
                onChange={(e) => setSearch(e?.target?.value ?? '')}
                className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-amber-500/20 rounded-lg text-amber-50 placeholder-amber-500/40 focus:outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Grid */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)] custom-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(filteredOptions ?? [])?.map((option) => {
                const isSelected = selectedId === option?.id;
                const PlaceholderIcon = getPlaceholderIcon(option?.name ?? '');
                
                return (
                  <motion.button
                    key={option?.id ?? Math.random()}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onSelect?.(option);
                      onClose?.();
                    }}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all duration-300 group ${
                      isSelected
                        ? 'border-amber-400 shadow-lg shadow-amber-500/30'
                        : 'border-slate-700 hover:border-amber-500/50'
                    }`}
                  >
                    {/* Image or Placeholder */}
                    <div className="aspect-square relative bg-gradient-to-br from-slate-800 to-slate-900">
                      {option?.image ? (
                        <Image
                          src={option?.image ?? ''}
                          alt={option?.name ?? ''}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 20vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center mb-2">
                            <PlaceholderIcon className="text-amber-400" size={32} />
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity ${
                        option?.image ? 'opacity-80 group-hover:opacity-90' : 'opacity-0'
                      }`} />
                      
                      {/* Selected Check */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                          <Check size={16} className="text-slate-900" />
                        </div>
                      )}
                    </div>
                    
                    {/* Label */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-black/50">
                      <p className="text-xs sm:text-sm font-medium text-amber-50 line-clamp-2">
                        {option?.name ?? ''}
                      </p>
                      {showDescription && option?.description && (
                        <p className="text-xs text-amber-200/60 line-clamp-1 mt-1">
                          {option?.description ?? ''}
                        </p>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
            
            {(filteredOptions?.length ?? 0) === 0 && (
              <div className="text-center py-12 text-amber-400/60">
                <Search size={48} className="mx-auto mb-4 opacity-50" />
                <p>No options found matching your search.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
