import { useTranslation } from 'react-i18next';
import { supportedLanguages, changeLanguage, type SupportedLang } from '@/i18n';
import { useState, useRef, useEffect } from 'react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = supportedLanguages.find((l) => l.code === i18n.language) || supportedLanguages[0];

  async function handleSelect(code: SupportedLang) {
    await changeLanguage(code);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
      >
        <span>{current.label}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-32 bg-[#1a1a25] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code as SupportedLang)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                i18n.language === lang.code
                  ? 'bg-[#C9A046]/20 text-[#D4A853]'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
