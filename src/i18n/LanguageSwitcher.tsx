import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-HK', label: '香港繁體' },
  { code: 'zh-TW', label: '台灣繁體' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language || 'zh-CN';

  return (
    <select
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-[#D4A853]/50 cursor-pointer"
    >
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
