'use client';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export function TextInput({ label, value, onChange, placeholder, multiline = false }: TextInputProps) {
  const baseClasses = "w-full px-4 py-3 bg-slate-800/50 border border-amber-500/20 rounded-xl text-amber-50 placeholder-amber-500/40 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all";
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-amber-300/80">{label ?? ''}</label>
      {multiline ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange?.(e?.target?.value ?? '')}
          placeholder={placeholder ?? ''}
          rows={3}
          className={`${baseClasses} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange?.(e?.target?.value ?? '')}
          placeholder={placeholder ?? ''}
          className={baseClasses}
        />
      )}
    </div>
  );
}
