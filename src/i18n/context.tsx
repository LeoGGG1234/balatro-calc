import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Translations } from './types';
import en from './locales/en';
import zhCN from './locales/zh-CN';

export type Language = 'en' | 'zh-CN';

const LOCALES: Record<Language, Translations> = {
  en,
  'zh-CN': zhCN,
};

interface I18nContextValue {
  lang: Language;
  t: Translations;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('balatro-calc-lang');
    if (saved === 'en' || saved === 'zh-CN') return saved;
    // Default to Chinese if browser language is Chinese
    if (navigator.language.startsWith('zh')) return 'zh-CN';
    return 'en';
  });

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'en' ? 'zh-CN' : 'en';
      localStorage.setItem('balatro-calc-lang', next);
      return next;
    });
  }, []);

  const setLangAndSave = useCallback((l: Language) => {
    localStorage.setItem('balatro-calc-lang', l);
    setLang(l);
  }, []);

  return (
    <I18nContext.Provider value={{ lang, t: LOCALES[lang], setLang: setLangAndSave, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
