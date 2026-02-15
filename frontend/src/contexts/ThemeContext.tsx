import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'teal' | 'gold' | 'blood' | 'ice' | 'shadow';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: { id: Theme; name: string; color: string }[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const AVAILABLE_THEMES = [
  { id: 'teal' as Theme, name: 'Mystic Teal', color: '#4ecdc4' },
  { id: 'gold' as Theme, name: 'Royal Gold', color: '#d4af37' },
  { id: 'blood' as Theme, name: 'War Crimson', color: '#dc2626' },
  { id: 'ice' as Theme, name: 'Frost Blue', color: '#60a5fa' },
  { id: 'shadow' as Theme, name: 'Dark Purple', color: '#8b5cf6' },
];

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('teal');

  useEffect(() => {
    const savedTheme = localStorage.getItem('monarchy-theme') as Theme;
    if (savedTheme && AVAILABLE_THEMES.find(t => t.id === savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === 'teal') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('monarchy-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: AVAILABLE_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
