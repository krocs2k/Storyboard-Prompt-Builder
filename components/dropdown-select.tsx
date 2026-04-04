'use client';

import { ChevronDown } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface DropdownSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function DropdownSelect({ label, options, value, onChange }: DropdownSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-amber-300/80">{label ?? ''}</label>
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange?.(e?.target?.value ?? '')}
          className="w-full px-4 py-3 bg-slate-800/50 border border-amber-500/20 rounded-xl text-amber-50 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none cursor-pointer"
        >
          <option value="" className="bg-slate-800">Select {label ?? ''}...</option>
          {(options ?? [])?.map((option) => (
            <option key={option?.id ?? Math.random()} value={option?.id ?? ''} className="bg-slate-800">
              {option?.name ?? ''}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" size={18} />
      </div>
    </div>
  );
}
