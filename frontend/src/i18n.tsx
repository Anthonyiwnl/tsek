import { useEffect, useSyncExternalStore } from 'react';
import translations from './translations.json';
import './language-switch.css';

type Language = 'en' | 'fil';
const key = 'tsek.language';
let fallback: Language = 'en';
const snapshot = (): Language => {
  try { return localStorage.getItem(key) === 'fil' ? 'fil' : 'en'; } catch { return fallback; }
};
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener('tsek-language', notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener('tsek-language', notify); };
}
const sources = new Map(Object.values(translations).flatMap(value => [[value.en, value], [value.fil, value]]));
export function useCopy() {
  const language = useSyncExternalStore(subscribe, snapshot, () => 'en' as Language);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const t = (id: keyof typeof translations) => translations[id][language];
  // Server messages stay verbatim when unknown; never translate user document contents.
  const source = (text: string) => sources.get(text)?.[language] ?? text;
  return { t, source, language };
}
export function LanguageSwitch() {
  const { language } = useCopy();
  return <label className="language-switch"><span lang="en">Language</span><select aria-label="Language / Wika" value={language} onChange={event => {
    fallback = event.target.value === 'fil' ? 'fil' : 'en';
    try { localStorage.setItem(key, fallback); } catch { /* Session-only preference when storage is unavailable. */ }
    window.dispatchEvent(new Event('tsek-language'));
  }}><option value="en" lang="en">English</option><option value="fil" lang="fil">Filipino</option></select></label>;
}
