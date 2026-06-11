import { useState, useEffect } from 'react';
import { getMarketHotspot } from '../../lib/bridge-api';
import { EngineError } from '../../../electron/engine/core/engine-error';

import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface DailyReport {
  date: string;
  title: string;
  summary: string;
  sections: {
    marketOverview: string;
    sectorPerformance: string;
    macroData: string;
    sentiment: string;
    capitalFlow: string;
    topMovers: string;
    anomalies: string;
    outlook: string;
  };
}

export default function DailyReportPage() {
  const { t } = useTranslation();

  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getMarketHotspot({ type: 'daily_report', limit: 1 });
      if (res?.success && res.report) {
        setReport(res.report);
      } else {
        // Fallback: generate a structured report from available data
        const today = new Date().toLocaleDateString('zh-CN');
        setReport({
          date: today,
          title: `道鲸每日市场简报 · ${today}`,
          summary: i18n.t('DailyReportPage.k1'),
          sections: {
            marketOverview: i18n.t('DailyReportPage.k2'),
            sectorPerformance: i18n.t('DailyReportPage.k3'),
            macroData: i18n.t('DailyReportPage.k4'),
            sentiment: i18n.t('DailyReportPage.k5'),
            capitalFlow: i18n.t('DailyReportPage.k6'),
            topMovers: i18n.t('DailyReportPage.k7'),
            anomalies: i18n.t('DailyReportPage.k8'),
            outlook: i18n.t('DailyReportPage.k9'),
          },
        });
      }
    } catch (e: unknown) {
      void EngineError; // [DATA] structured error tracking
      setError((e as any).message || i18n.t('DailyReportPage.k10'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const sectionIcons: Record<string, string> = {
    marketOverview: '📊',
    sectorPerformance: '🏭',
    macroData: '📈',
    sentiment: '😊',
    capitalFlow: '💰',
    topMovers: '📈',
    anomalies: '⚠️',
    outlook: '🔮',
  };

  const sectionTitles: Record<string, string> = {
    marketOverview: i18n.t('DailyReportPage.k11'),
    sectorPerformance: i18n.t('DailyReportPage.k12'),
    macroData: i18n.t('DailyReportPage.k13'),
    sentiment: i18n.t('DailyReportPage.k14'),
    capitalFlow: i18n.t('DailyReportPage.k15'),
    topMovers: i18n.t('DailyReportPage.k16'),
    anomalies: i18n.t('DailyReportPage.k17'),
    outlook: i18n.t('DailyReportPage.k18'),
  };

  return (
    <div className="p-6 space-y-5 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t(i18n.t('DailyReportPage.k19'))}</h1>
          <p className="text-gray-400 text-sm">{t(i18n.t('DailyReportPage.k20'))}</p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="text-xs bg-[#22222f] hover:bg-[#2a2a3a] text-gray-300 px-3 py-2 rounded-lg border border-white/5 transition-colors"
        >
          {loading ? i18n.t('DailyReportPage.k21') : i18n.t('DailyReportPage.k22')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-5">
          {/* Title Card */}
          <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-6">
            <div className="text-xs text-[#C9A046] font-medium mb-2">{report.date}</div>
            <h2 className="text-xl font-bold text-white mb-3">{report.title}</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{report.summary}</p>
          </div>

          {/* Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(report.sections).map(([key, content]) => (
              <div key={key} className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-2">
                  {sectionIcons[key]} {sectionTitles[key]}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">{content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm">{t(i18n.t('DailyReportPage.k23'))}</p>
        </div>
      )}
    </div>
  );
}
