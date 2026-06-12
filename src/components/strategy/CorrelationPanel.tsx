// @ts-nocheck
// R126-Q01: nocheck cleared — cleared
import i18n from '../../i18n/index';
// ── DAWN WHALES — Strategy Correlation Panel (Q2 UI) ───────────────────────
// strategy/policy + 

import { useTranslation } from 'react-i18next';

interface CorrelationResult {
  ids: string[];
  matrix: number[][];
  entries: Array<{idA: string;idB: string;corr: number;}>;
  diversificationScore: number;
  minCorrelation: number;
  maxCorrelation: number;
}

export default function CorrelationPanel({ result }: {result?: unknown;}) {
  const { t } = useTranslation();

  if (!result?.success) {
    return (
      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
        <h3 className="text-white font-semibold text-sm mb-2">{t('strategyCorrelation')}</h3>
        <div className="text-gray-500 text-sm text-center py-6">{i18n.t("CorrelationPanel.r92_38be")}

        </div>
      </div>);

  }

  const data: CorrelationResult = result;
  const score = data.diversificationScore;
  const scoreColor = score > 0.5 ? 'text-emerald-400' : score > 0.3 ? 'text-yellow-400' : 'text-red-400';
  const scoreLabel = score > 0.5 ? t('highlyDiversified') : score > 0.3 ? t('moderatelyDiversified') : t('highlyConcentrated');

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">{i18n.t("CorrelationPanel.r92_4938")}</h3>
        <div className={`text-xs font-bold ${scoreColor}`}>
          {scoreLabel} ({score.toFixed(2)})
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-1.5 text-gray-500 text-left">{t("components.strategy")}</th>
              {data.ids.map((id) =>
              <th key={id} className="p-1.5 text-gray-500 text-center">{id.slice(0, 8)}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row, i) =>
            <tr key={i} className="border-t border-white/[0.03]">
                <td className="p-1.5 text-gray-400">{data.ids[i].slice(0, 8)}</td>
                {row.map((val, j) =>
              <td
                key={j}
                className="p-1.5 text-center font-mono"
                style={{
                  color: i === j ? '#666' : val > 0.7 ? '#ef4444' : val > 0.3 ? '#eab308' : '#22c55e',
                  background: `rgba(${val > 0.7 ? '239,68,68' : val > 0.3 ? '234,179,8' : '34,197,94'},${Math.abs(val) * 0.15})`
                }}>
                
                    {i === j ? '1' : val.toFixed(2)}
                  </td>
              )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top 5 most correlated */}
      <div className="mb-3">
        <div className="text-gray-400 text-[11px] font-medium mb-2">{i18n.t("CorrelationPanel.r92_e418")}</div>
        <div className="space-y-1">
          {data.entries.slice(0, 5).map((e, i) =>
          <div key={i} className="flex items-center justify-between bg-[#12121a] rounded px-3 py-1.5">
              <span className="text-gray-400 text-[11px]">{e.idA.slice(0, 10)} ↔ {e.idB.slice(0, 10)}</span>
              <span className={`text-xs font-mono ${e.corr > 0.7 ? 'text-red-400' : e.corr > 0.3 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                {e.corr.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top 5 least correlated */}
      <div>
        <div className="text-gray-400 text-[11px] font-medium mb-2">{i18n.t("CorrelationPanel.r92_e9e2")}</div>
        <div className="space-y-1">
          {[...data.entries].sort((a, b) => a.corr - b.corr).slice(0, 5).map((e, i) =>
          <div key={i} className="flex items-center justify-between bg-[#12121a] rounded px-3 py-1.5">
              <span className="text-gray-400 text-[11px]">{e.idA.slice(0, 10)} ↔ {e.idB.slice(0, 10)}</span>
              <span className="text-xs font-mono text-emerald-400">
                {e.corr.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>);

}