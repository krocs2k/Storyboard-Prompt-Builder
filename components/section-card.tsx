'use client';

import { motion } from 'framer-motion';
import { LucideIcon, RotateCcw } from 'lucide-react';

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  sectionNumber: number;
  onReset?: () => void;
}

export function SectionCard({ title, icon: Icon, children, sectionNumber, onReset }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sectionNumber * 0.1 }}
      className="group/card relative bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 rounded-2xl border border-amber-500/15 hover:border-amber-500/30 shadow-premium elevate overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-amber-500/15 bg-gradient-to-r from-amber-500/[0.12] via-amber-500/[0.04] to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 ring-1 ring-amber-300/20 group-hover/card:shadow-amber-500/50 transition-shadow">
              <Icon className="text-slate-900" size={20} />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-[0.14em]">Section {sectionNumber ?? 0}</span>
              <h3 className="text-lg font-bold text-amber-50 leading-tight">{title ?? ''}</h3>
            </div>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              title={`Reset ${title}`}
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </motion.div>
  );
}
