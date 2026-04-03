'use client';

import { motion } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';

interface SelectionButtonProps {
  label: string;
  value: string | null;
  onClick: () => void;
  onClear?: () => void;
}

export function SelectionButton({ label, value, onClick, onClear }: SelectionButtonProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-amber-300/80">{label ?? ''}</label>
      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onClick}
          className="flex-1 flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-amber-500/20 hover:border-amber-500/40 rounded-xl text-left transition-all group"
        >
          <span className={value ? 'text-amber-50' : 'text-amber-400/50'}>
            {value ?? `Select ${label ?? ''}...`}
          </span>
          <ChevronRight className="text-amber-400 group-hover:translate-x-1 transition-transform" size={18} />
        </motion.button>
        {value && onClear && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e?.stopPropagation?.();
              onClear?.();
            }}
            className="px-3 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 transition-all"
          >
            <X size={18} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
