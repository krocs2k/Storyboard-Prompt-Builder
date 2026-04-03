'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface ThemeDefinition {
  id: string;
  name: string;
  os: string;
  description: string;
  preview: { bg: string; accent: string };
}

export const THEMES: ThemeDefinition[] = [
  { id: 'cinema-gold', name: 'Cinema Gold', os: 'Default', description: 'Cinematic warmth', preview: { bg: '#0f172a', accent: '#f59e0b' } },
  { id: 'macos-sonoma', name: 'macOS Sonoma', os: 'Apple Desktop', description: 'Refined precision', preview: { bg: '#121830', accent: '#007aff' } },
  { id: 'windows-fluent', name: 'Windows 11', os: 'Microsoft Desktop', description: 'Fluent depth', preview: { bg: '#161230', accent: '#604ee8' } },
  { id: 'ios-dynamic', name: 'iOS 18', os: 'Apple Phone', description: 'Bold clarity', preview: { bg: '#1a1a2a', accent: '#0a84ff' } },
  { id: 'material-you', name: 'Material You', os: 'Android', description: 'Organic teal', preview: { bg: '#181c1a', accent: '#03dac6' } },
  { id: 'ubuntu', name: 'Ubuntu', os: 'Linux Desktop', description: 'Aubergine warmth', preview: { bg: '#241424', accent: '#e95420' } },
  { id: 'one-ui', name: 'One UI', os: 'Samsung Phone', description: 'Deep ocean', preview: { bg: '#0e1c37', accent: '#29b6f6' } },
  { id: 'ipados', name: 'iPadOS', os: 'Apple Tablet', description: 'Purple canvas', preview: { bg: '#1e1638', accent: '#785cf6' } },
  { id: 'chromeos', name: 'ChromeOS', os: 'Google Desktop', description: 'Clean minimal', preview: { bg: '#1c1c24', accent: '#4285f4' } },
  { id: 'pixel-tablet', name: 'Pixel Tablet', os: 'Google Tablet', description: 'Warm sage', preview: { bg: '#1c1a16', accent: '#6ab46a' } },
];

interface ThemeContextType {
  theme: string;
  setTheme: (id: string) => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'cinema-gold',
  setTheme: () => {},
  themes: THEMES,
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = 'spb-theme';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState('cinema-gold');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && THEMES.some(t => t.id === saved)) {
        setThemeState(saved);
      }
    } catch {}
    setMounted(true);
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!THEMES.some(t => t.id === id)) return;
    setThemeState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
    document.documentElement.setAttribute('data-theme', id);
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
