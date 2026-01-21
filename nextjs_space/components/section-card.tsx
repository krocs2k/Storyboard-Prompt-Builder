'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  sectionNumber: number;
}

export function SectionCard({ title, icon: Icon, children, sectionNumber }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: sectionNumber * 0.1 }}
      className="bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-sm rounded-2xl border border-amber-500/20 shadow-xl shadow-black/20 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Icon className="text-slate-900" size={20} />
          </div>
          <div>
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Section {sectionNumber ?? 0}</span>
            <h3 className="text-lg font-bold text-amber-50">{title ?? ''}</h3>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </motion.div>
  );
}
