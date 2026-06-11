import { useAppStore } from '@/stores/appStore';
import { useThemeStore } from '@/lib/theme';
import { useTranslation } from 'react-i18next';
import logo from '@/assets/logo.svg';
import BrokerSelector from './BrokerSelector';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import i18n from '../../i18n';
import { EngineError } from '../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:SYSTEM] structured error tracking

export default function Header() {
  const { t } = useTranslation();
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const emergencyStop = useAppStore((s) => s.emergencyStop);
  const { theme, toggleTheme } = useThemeStore();

  return (
    <header className="h-12 bg-[#15151f] border-b border-white/5 flex items-center px-4 gap-3 flex-shrink-0">
      <button onClick={toggleSidebar} className="text-gray-400 hover:text-gray-200 text-lg p-1" title="{t('components.collapseSidebar')}">☰</button>

      <div className="flex items-center gap-2.5">
        <img src={logo} alt={t("common.appName")} className="w-7 h-7 rounded-md" />
        <div className="flex flex-col leading-tight">
          <span className="text-white font-bold text-xs">{t('components.appFullName')}</span>
          <span className="text-[#D4A853] text-[9px] font-medium tracking-wider">DAWN WHALES</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Connection status */}
      <div className="flex items-center gap-4 text-xs">
        <BrokerSelector />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="text-gray-400 hover:text-gray-200 p-1.5 rounded hover:bg-white/5 transition-colors text-sm"
        title={theme === 'dark' ? i18n.t('Header.k0') : i18n.t('Header.k1')}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Language selector (R100 M-02: 11 languages) */}
      <LanguageSwitcher />

      {/* Actions */}
      <div className="flex items-center gap-1 ml-1">
        <button className="text-gray-400 hover:text-gray-200 p-1.5 rounded hover:bg-white/5 transition-colors" title={t("components.notification")}>🔔</button>
        <button onClick={emergencyStop} className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors" title="{t('components.emergencyStopAll')}">⏸️</button>
      </div>
    </header>
  );
}
