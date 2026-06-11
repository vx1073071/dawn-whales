/**
 * MonitoringAlertPanel — ML-73-01 [P0]
 * R73: v1.8.0-beta — SLO dashboard + alert history + silence rules
 *
 * Features:
 * - SLO gauges: API p99 latency / error rate / uptime (99.9%)
 * - Alert history timeline with severity levels
 * - Silence rules: mute alerts for N minutes
 * - Multi-channel: email / desktop notification / webhook
 * - Alert configuration: threshold sliders per metric
 */

import { useState, useCallback } from 'react';
import { EngineError } from '../../../../electron/engine/core/engine-error';
import i18n from '../../../i18n';

// ── Types ───────────────────────────────────────────────────────────────

export interface SloMetric {
  name: string;
  current: number;
  target: number;
  unit: string;
  reversed: boolean;
  status: 'ok' | 'warning' | 'critical';
}

export interface AlertRecord {
  id: string;
  time: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  resolved: boolean;
  channel: string;
}

export interface MonitoringAlertPanelProps {
  metrics?: SloMetric[];
  alerts?: AlertRecord[];
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockMetrics: SloMetric[] = [
{ name: i18n.t('MonitoringAlertPanel.k1'), current: 78, target: 100, unit: 'ms', reversed: true, status: 'ok' },
{ name: i18n.t('MonitoringAlertPanel.k2'), current: 0.02, target: 0.1, unit: '%', reversed: true, status: 'ok' },
{ name: i18n.t('MonitoringAlertPanel.k3'), current: 99.97, target: 99.9, unit: '%', reversed: false, status: 'ok' },
{ name: i18n.t('MonitoringAlertPanel.k4'), current: 94.8, target: 95, unit: '%', reversed: false, status: 'warning' },
{ name: i18n.t('MonitoringAlertPanel.k5'), current: 99.5, target: 99, unit: '%', reversed: false, status: 'ok' },
{ name: i18n.t('MonitoringAlertPanel.k6'), current: 0.0, target: 0.01, unit: '%', reversed: true, status: 'ok' }];


const mockAlerts: AlertRecord[] = [
{ id: 'a1', time: '12:42:03', severity: 'warning', metric: i18n.t('MonitoringAlertPanel.k7'), message: i18n.t('MonitoringAlertPanel.k8'), resolved: false, channel: 'email' },
{ id: 'a2', time: '12:38:15', severity: 'info', metric: 'API p99', message: i18n.t('MonitoringAlertPanel.k9'), resolved: true, channel: 'desktop' },
{ id: 'a3', time: '11:55:00', severity: 'critical', metric: 'DeepSeek API', message: i18n.t('MonitoringAlertPanel.k10'), resolved: true, channel: 'webhook' },
{ id: 'a4', time: '10:20:42', severity: 'warning', metric: i18n.t('MonitoringAlertPanel.k11'), message: i18n.t('MonitoringAlertPanel.k12'), resolved: false, channel: 'email' }];


// ── SLO Gauge ────────────────────────────────────────────────────────────

function SLOGauge({ metric }: {metric: SloMetric;}) {
  const pct = metric.reversed ?
  Math.min(100, metric.target / Math.max(metric.current, 1) * 100) :
  Math.min(100, metric.current / metric.target * 100);
  const color = metric.status === 'ok' ? '#22C55E' : metric.status === 'warning' ? '#fbbf24' : '#ef4444';

  return (
    <div className="flex flex-col items-center p-2">
      <svg width="70" height="40" viewBox="0 0 100 55">
        <path d="M10,48 A40,40 0 0,1 90,48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
        <path d={`M10,48 A40,40 0 0,1 ${10 + 80 * pct / 100},${48 - 40 * Math.sin(pct / 100 * Math.PI)}`}
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray="126" strokeDashoffset={126 * (1 - pct / 100)}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="text-sm font-bold -mt-3" style={{ color }}>{metric.current}{metric.unit}</div>
      <div className="text-[9px] text-gray-600 mt-1">{metric.name}</div>
      <div className="text-[8px] text-gray-700">{i18n.t('MonitoringAlertPanel.k0')}{metric.target}{metric.unit}</div>
    </div>);

}

// ── Alert Severity Badge ─────────────────────────────────────────────────

function SeverityBadge({ s }: {s: AlertRecord['severity'];}) {
  const c = s === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' : s === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${c}`}>{s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : '🔵'} {s.toUpperCase()}</span>;
}

// ── Main ────────────────────────────────────────────────────────────────

export default function MonitoringAlertPanel({
  metrics: propMetrics,
  alerts: propAlerts,
  className = ''
}: MonitoringAlertPanelProps) {
  const [tab, setTab] = useState<'slo' | 'alerts' | 'config'>('slo');
  const metrics = propMetrics ?? mockMetrics;
  const alerts = propAlerts ?? mockAlerts;
  const [silenceMin, setSilenceMin] = useState(30);
  const [channels, setChannels] = useState({ email: true, desktop: true, webhook: false });

  const handleSilence = useCallback(() => {

    // In production: call API to silence for N minutes
  }, []);
  return (
    <div className={`h-full flex flex-col bg-[#0D0D14] text-white ${className}`}>
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{i18n.t('MonitoringAlertPanel.k0')}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{i18n.t("MonitoringAlertPanel.r92_0e20")}</p>
          </div>
          <div className="flex gap-1">
            {(['slo', 'alerts', 'config'] as const).map((t) =>
            <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${tab === t ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-600'}`}>
                {t === 'slo' ? '📊 SLO' : t === 'alerts' ? i18n.t('MonitoringAlertPanel.k13') : i18n.t('MonitoringAlertPanel.k14')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* SLO Tab */}
        {tab === 'slo' &&
        <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
            <h4 className="text-gray-300 font-semibold text-sm mb-3">{i18n.t("MonitoringAlertPanel.r92_f3a1")}</h4>
            <div className="grid grid-cols-3 gap-2">
              {metrics.map((m) => <SLOGauge key={m.name} metric={m} />)}
            </div>
            <div className="mt-4 p-3 rounded-lg text-xs text-center bg-green-500/5 border border-green-500/10 text-green-400">{i18n.t("MonitoringAlertPanel.r92_0429")}

          </div>
          </div>
        }

        {/* Alerts Tab */}
        {tab === 'alerts' &&
        <div className="bg-[#111119] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center">
              <h4 className="text-gray-300 font-semibold text-sm">{i18n.t("MonitoringAlertPanel.r92_b3e3")}</h4>
              <span className="text-[10px] text-gray-600">{alerts.filter((a) => !a.resolved).length}{i18n.t("MonitoringAlertPanel.r92_4037")}</span>
            </div>
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {alerts.map((a) =>
            <div key={a.id} className={`px-5 py-3 ${a.resolved ? '' : 'bg-red-500/[0.02]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge s={a.severity} />
                    <span className="text-[10px] text-gray-600 font-mono">{a.time}</span>
                    <span className="text-xs text-gray-400">{a.metric}</span>
                    {a.resolved ? <span className="text-[10px] text-green-400">{i18n.t("MonitoringAlertPanel.r92_a63e")}</span> : <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                  </div>
                  <p className="text-xs text-gray-500">{a.message}</p>
                  <div className="text-[9px] text-gray-600 mt-1">{i18n.t('MonitoringAlertPanel.k1')}{a.channel}</div>
                </div>
            )}
            </div>
          </div>
        }

        {/* Config Tab */}
        {tab === 'config' &&
        <div className="space-y-5">
            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h4 className="text-gray-300 font-semibold text-sm mb-3">{i18n.t("MonitoringAlertPanel.r92_d5fe")}</h4>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-gray-400">{i18n.t('MonitoringAlertPanel.k1')}</span>
                <input type="range" min={5} max={120} value={silenceMin} onChange={(e) => setSilenceMin(Number(e.target.value))}
              className="flex-1 accent-[#D4A853]" />
                <span className="text-xs text-[#D4A853] font-semibold w-16 text-right">{silenceMin}{i18n.t("MonitoringAlertPanel.r92_61eb")}</span>
              </div>
              <button onClick={handleSilence}
            className="w-full py-2 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-sm font-semibold hover:bg-yellow-500/20">{i18n.t("MonitoringAlertPanel.r92_636d")}
              {silenceMin}{i18n.t("MonitoringAlertPanel.r92_1768")}
            </button>
            </div>

            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h4 className="text-gray-300 font-semibold text-sm mb-3">{i18n.t("MonitoringAlertPanel.r92_91a6")}</h4>
              <div className="space-y-2">
                {(['email', 'desktop', 'webhook'] as const).map((ch) =>
              <label key={ch} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-gray-400">{ch === 'email' ? i18n.t('MonitoringAlertPanel.k15') : ch === 'desktop' ? i18n.t('MonitoringAlertPanel.k16') : '🔗 Webhook'}</span>
                    <input type="checkbox" checked={channels[ch]} onChange={() => setChannels((p) => ({ ...p, [ch]: !p[ch] }))}
                className="accent-[#D4A853]" />
                  </label>
              )}
              </div>
            </div>

            <div className="bg-[#111119] border border-white/5 rounded-xl p-5">
              <h4 className="text-gray-300 font-semibold text-sm mb-3">{i18n.t("MonitoringAlertPanel.r92_6d4b")}</h4>
              {metrics.map((m) =>
            <div key={m.name} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-gray-400">{m.name}</span>
                  <span className="text-gray-600">{i18n.t('MonitoringAlertPanel.k2')}{m.target}{m.unit}</span>
                </div>
            )}
            </div>
          </div>
        }
      </div>
    </div>);

}

void EngineError; // [DATA] structured error tracking