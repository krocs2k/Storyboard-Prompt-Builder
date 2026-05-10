'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Star, AtSign } from 'lucide-react';

export interface RefToken {
  key: string;
  token: string;
  label: string;
  role: 'character' | 'environment';
  hasPrimary: boolean;
}

interface RefTokenInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  tokens: RefToken[];
}

export function RefTokenInput({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  tokens,
}: RefTokenInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [caretPos, setCaretPos] = useState(0);

  const baseClasses =
    'w-full px-4 py-3 bg-slate-800/50 border border-amber-500/20 rounded-xl text-amber-50 placeholder-amber-500/40 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all';

  // Detect if cursor is currently positioned in an active @-token query
  const updateDropdownState = useCallback(
    (text: string, pos: number) => {
      const textBeforeCaret = text.slice(0, pos);
      const atMatch = textBeforeCaret.match(/@([\w-]*)$/);
      if (atMatch) {
        setQuery(atMatch[1].toLowerCase());
        setShowDropdown(true);
        setActiveIdx(0);
      } else {
        setShowDropdown(false);
      }
    },
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const pos = e.target.selectionStart ?? newValue.length;
    setCaretPos(pos);
    onChange(newValue);
    updateDropdownState(newValue, pos);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const pos = target.selectionStart ?? target.value.length;
    setCaretPos(pos);
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      updateDropdownState(target.value, pos);
    }
  };

  const filtered = tokens.filter(
    (t) => !query || t.label.toLowerCase().includes(query) || t.token.toLowerCase().includes(`@${query}`)
  );

  const insertToken = (tok: RefToken) => {
    const before = value.slice(0, caretPos);
    const after = value.slice(caretPos);
    const replaced = before.replace(/@([\w-]*)$/, tok.token);
    const newValue = `${replaced}${after.startsWith(' ') ? '' : ' '}${after}`;
    onChange(newValue);
    setShowDropdown(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        const newPos = replaced.length + 1;
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const tok = filtered[activeIdx];
      if (tok && tok.hasPrimary) insertToken(tok);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative">
      <label className="text-sm font-medium text-amber-300/80 flex items-center gap-1.5">
        {label}
        {tokens.length > 0 && (
          <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5">
            <AtSign size={10} /> type @ to reference
          </span>
        )}
      </label>
      {multiline ? (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          value={value ?? ''}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          onClick={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
          placeholder={placeholder ?? ''}
          rows={3}
          className={`${baseClasses} resize-none`}
        />
      ) : (
        <input
          ref={(el) => {
            inputRef.current = el;
          }}
          type="text"
          value={value ?? ''}
          onChange={handleChange}
          onKeyUp={handleKeyUp}
          onKeyDown={handleKeyDown}
          onClick={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
          placeholder={placeholder ?? ''}
          className={baseClasses}
        />
      )}

      {showDropdown && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-amber-500/30 bg-slate-900/95 backdrop-blur-md shadow-2xl shadow-black/40">
          {filtered.map((tok, idx) => (
            <button
              type="button"
              key={tok.key}
              onMouseDown={(e) => {
                e.preventDefault();
                if (tok.hasPrimary) insertToken(tok);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              disabled={!tok.hasPrimary}
              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                idx === activeIdx ? 'bg-amber-500/20' : 'bg-transparent'
              } ${tok.hasPrimary ? 'text-amber-100 hover:bg-amber-500/20' : 'text-slate-500 cursor-not-allowed'}`}
            >
              {tok.hasPrimary ? (
                <Star size={10} className="fill-amber-400 text-amber-400" />
              ) : (
                <AtSign size={10} className="text-slate-600" />
              )}
              <span className="font-mono text-amber-300">{tok.token}</span>
              <span className="text-slate-400 truncate">{tok.label}</span>
              <span
                className={`ml-auto text-[9px] uppercase tracking-wider ${
                  tok.role === 'character' ? 'text-cyan-400' : 'text-emerald-400'
                }`}
              >
                {tok.role}
              </span>
              {!tok.hasPrimary && (
                <span className="text-[9px] text-slate-600">no ref</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
