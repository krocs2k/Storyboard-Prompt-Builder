'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, X, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useTheme, ThemeDefinition } from '@/lib/theme-context';

function getDeviceIcon(os: string) {
  if (os.includes('Phone')) return Smartphone;
  if (os.includes('Tablet')) return Tablet;
  return Monitor;
}

function ThemeCard({ t, isActive, onSelect }: { t: ThemeDefinition; isActive: boolean; onSelect: () => void }) {
  const DeviceIcon = getDeviceIcon(t.os);
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left w-full ${
        isActive
          ? 'border-white/30 bg-white/10 shadow-lg'
          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10'
      }`}
    >
      {/* Color preview */}
      <div
        className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center shadow-inner"
        style={{ backgroundColor: t.preview.bg, boxShadow: `inset 0 0 12px ${t.preview.accent}30` }}
      >
        <div
          className="w-4 h-4 rounded-full shadow-lg"
          style={{ backgroundColor: t.preview.accent, boxShadow: `0 0 8px ${t.preview.accent}80` }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white/90 truncate">{t.name}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <DeviceIcon size={10} className="text-white/40 flex-shrink-0" />
          <span className="text-[11px] text-white/40 truncate">{t.os}</span>
        </div>
      </div>

      {/* Check */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: t.preview.accent }}
        >
          <Check size={12} className="text-white" strokeWidth={3} />
        </motion.div>
      )}
    </motion.button>
  );
}

export default function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-[60]" ref={panelRef}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="absolute bottom-16 right-0 w-[340px] max-h-[70vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50"
            style={{ background: 'rgba(10, 10, 18, 0.92)', backdropFilter: 'blur(24px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white/90 tracking-wide">App Theme</h3>
                <p className="text-[11px] text-white/40 mt-0.5">Choose your OS-inspired look</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
              >
                <X size={16} />
              </button>
            </div>

            {/* Theme grid */}
            <div className="p-3 space-y-1.5 overflow-y-auto max-h-[calc(70vh-64px)] custom-scrollbar">
              {themes.map((t) => (
                <ThemeCard
                  key={t.id}
                  t={t}
                  isActive={theme === t.id}
                  onSelect={() => {
                    setTheme(t.id);
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all border ${
          open
            ? 'bg-white/15 border-white/20 shadow-white/5'
            : 'bg-black/60 border-white/10 hover:bg-black/70 hover:border-white/15 shadow-black/40'
        }`}
        style={{ backdropFilter: 'blur(12px)' }}
        title="Change theme"
      >
        <Palette size={20} className={`transition-colors ${open ? 'text-white/90' : 'text-white/60'}`} />
      </motion.button>
    </div>
  );
}
