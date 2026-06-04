import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { getMarketRegime } from '@/lib/bridge-api';
import { getMarketRegime } from '@/lib/bridge-api';

interface RegimeData {
  current: 'bull' | 'bear' | 'range' | 'volatile' | 'unknown';
  confidence: number;
  duration: number; // days
  transitionProbs: Record<string, number>;
  suggestedStrategy: string;
  riskLevel: string;
  positionSuggestion: string;
  history: { date: string; regime: string }[];
}

const REGIME_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  bull: { icon: '馃悅', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  bear: { icon: '馃惢', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  range: { icon: '馃搳', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  volatile: { icon: '鈿?, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  unknown: { icon: '鉂?, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
};

const MOCK_REGIME: RegimeData = {
  current: 'bull',
  confidence: 78.5,
  duration: 23,
  transitionProbs: { bull: 78.5, bear: 8.2, range: 10.3, volatile: 3.0 },
  suggestedStrategy: 'Trend Following 路 Momentum',
  riskLevel: 'Medium',
  positionSuggestion: '60%-80%',
  history: [
    { date: '2024-05-01', regime: 'range' },
    { date: '2024-05-08', regime: 'range' },
    { date: '2024-05-15', regime: 'bull' },
    { date: '2024-05-22', regime: 'bull' },
    { date: '2024-05-29', regime: 'bull' },
    { date: '2024-06-01', regime: 'bull' },
  ],
};

function getRegimeKey(r: string): string {
  const map: Record<string, string> = {
    bull: 'regimeBull',
    bear: 'regimeBear',
    range: 'regimeRange',
    volatile: 'regimeVolatile',
    unknown: 'regimeUnknown',
  };
  return map[r] || 'regimeUnknown';
}

function getRegimeDescKey(r: string): string {
  const map: Record<string, string> = {
    bull: 'bullDesc',
    bear: 'bearDesc',
    range: 'rangeDesc',
    volatile: 'volatileDesc',
    unknown: 'unknownDesc',
  };
  return map[r] || 'unknownDesc';
}

export default function RegimeMonitorPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<RegimeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRegime() {
      setLoading(true);
      setError(null);
      try {
        const result = await getMarketRegime();
        if (cancelled) return;
        if (result?.success && result.regime) {
          setData({
            current: result.regime.label || result.regime.current || 'unknown',
            confidence: result.regime.confidence || 0,
            duration: result.regime.duration || 0,
            transitionProbs: result.regime.transitionProbs || {},
            suggestedStrategy: result.regime.suggestedStrategy || t('regimeMonitor.suggestedStrategy'),
            riskLevel: result.regime.riskLevel || 'Medium',
            positionSuggestion: result.regime.positionSuggestion || '',
            history: result.regime.history || [],
          });
        } else {
          // Fallback to mock data when IPC unavailable
          setData(MOCK_REGIME);
        }
      } catch {
        if (!cancelled) {
          // IPC failed 鈥?use mock as graceful degradation
          setData(MOCK_REGIME);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRegime();
    return () => { cancelled = true; };
  }, [t]);

  if (loading) return <LoadingSpinner fullscreen text={t('common.loading')} />;
  if (!data) return <LoadingSpinner fullscreen text={t('common.noData')} />;

  const cfg = REGIME_CONFIG[data.current];
  const regimeKey = getRegimeKey(data.current);
  const descKey = getRegimeDescKey(data.current);

  return (
    <div className="p-6 space-y-6 bg-[#0a0a12] min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">馃寠 {t('regimeMonitor.title')}</h1>
          <p className="text-gray-400 text-sm">{t('regimeMonitor.subtitle')}</p>
        </div>
      </div>

      {/* Current Regime Card */}
      <div className={`rounded-xl border p-6 ${cfg.bg}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl">{cfg.icon}</div>
          <div>
            <div className="text-gray-400 text-xs uppercase tracking-wider">{t('regimeMonitor.currentRegime')}</div>
            <div className={`text-2xl font-bold ${cfg.color}`}>{t(`regimeMonitor.${regimeKey}`)}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-gray-400 text-xs">{t('regimeMonitor.regimeConfidence')}</div>
            <div className="text-xl font-bold text-white">{data.confidence.toFixed(1)}%</div>
          </div>
        </div>
        <p className="text-gray-300 text-sm">{t(`regimeMonitor.${descKey}`)}</p>
        <div className="mt-3 text-xs text-gray-500">
          {t('regimeMonitor.regimeDuration')}: <span className="text-gray-300">{data.duration} {t('regimeMonitor.days')}</span>
        </div>
      </div>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SuggestionCard
          label={t('regimeMonitor.suggestedStrategy')}
          value={data.suggestedStrategy}
          icon="馃幆"
        />
        <SuggestionCard
          label={t('regimeMonitor.riskLevel')}
          value={data.riskLevel}
          icon="鈿狅笍"
        />
        <SuggestionCard
          label={t('regimeMonitor.positionSuggestion')}
          value={data.positionSuggestion}
          icon="馃搻"
        />
      </div>

      {/* Transition Probabilities */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">{t('regimeMonitor.regimeTransition')}</h2>
        <div className="space-y-3">
          {Object.entries(data.transitionProbs).sort((a, b) => b[1] - a[1]).map(([regime, prob]) => {
            const rCfg = REGIME_CONFIG[regime];
            const rKey = getRegimeKey(regime);
            return (
              <div key={regime} className="flex items-center gap-3">
                <span className="text-lg">{rCfg?.icon || '鉂?}</span>
                <span className="text-gray-300 text-sm w-20">{t(`regimeMonitor.${rKey}`)}</span>
                <div className="flex-1 h-2 bg-[#12121a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${prob}%`,
                      backgroundColor: regime === data.current ? '#C9A046' : '#374151',
                    }}
                  />
                </div>
                <span className="text-gray-400 text-sm w-12 text-right">{prob.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* History Timeline */}
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4">{t('regimeMonitor.history')}</h2>
        <div className="flex gap-2 flex-wrap">
          {data.history.map((h, i) => {
            const hCfg = REGIME_CONFIG[h.regime];
            const hKey = getRegimeKey(h.regime);
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${hCfg?.bg || 'bg-gray-500/10 border-gray-500/20'}`}
              >
                <span className="text-sm">{hCfg?.icon || '鉂?}</span>
                <span className={`text-xs font-medium ${hCfg?.color || 'text-gray-400'}`}>
                  {t(`regimeMonitor.${hKey}`)}
                </span>
                <span className="text-[10px] text-gray-500">{h.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">
      <div className="text-gray-500 text-xs mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-white font-medium text-sm">{value}</span>
      </div>
    </div>
  );
}
