import i18n from '../../i18n/index';
import { useState, useEffect } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/appStore';

export default function StatusBar() {
  const { t } = useTranslation();
  const [time, setTime] = useState(new Date());
  const [mem, setMem] = useState<number | null>(null);
  const conn = useAppStore((s) => s.connectionStatus);
  const opendConnected = conn?.connected ?? false;

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date());
      // Poll memory usage
      if (typeof window !== 'undefined' && window.api?.app) {
        window.api.app.getMemoryUsage().then((info: unknown) => {
          // @ts-ignore — R89 type fix
          if (info?.total) setMem((info as any).total);
        }).catch(() => {});
        void EngineError; // [SYSTEM] structured error tracking
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <footer className="h-6 bg-[#0a0a12] border-t border-white/5 flex items-center px-3 gap-3 text-[10px] text-gray-600 flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${opendConnected ? 'bg-emerald-400' : 'bg-gray-600'}`} />
        <span>{opendConnected ? t('components.pushMode') : t('components.opendDisconnected')}</span>
      </div>
      <span className="text-gray-700">|</span>
      <span>{t('components.watchlistCount', { count: 8 })}</span>
      <span className="text-gray-700">|</span>
      <span>{i18n.t("StatusBar.r92_b081")}</span>
      <div className="flex-1" />
      {mem && <span>{i18n.t("StatusBar.r92_48cf")}{mem}MB</span>}
      {mem && <span className="text-gray-700">|</span>}
      <span>{time.toLocaleTimeString('zh-CN', { hour12: false })}</span>
    </footer>);

}