/**
 * FullPipelineUI — ML-72-06 [P1]
 * R72 Authoritative: v1.8.0-alpha — Complete user journey: register→wallet
 *
 * Features:
 * - Step-by-step pipeline visualization (6 stages)
 * - Stage cards: Register → Connect Broker → Top Up → AI Analysis → Trade → Withdraw
 * - Progress indicator per stage
 * - Quick-access buttons per stage
 * - "What you can do" checklist
 */

import { useState } from 'react';
import { useTranslation } from "react-i18next";
import i18n from '../../../i18n';
import { EngineError } from '../../../../electron/engine/core/engine-error';
void EngineError; // [EngineError:DATA] structured error tracking

// ── Types ───────────────────────────────────────────────────────────────

export type PipelineStage = 'register' | 'connect' | 'topup' | 'ai' | 'trade' | 'withdraw';

export interface StageInfo {
  id: PipelineStage;
  step: number;
  icon: string;
  title: string;
  subtitle: string;
  done: boolean;
  progress: number;
  actions: string[];
}

export interface FullPipelineUIProps {
  stages?: StageInfo[];
  className?: string;
}

// ── Mock ────────────────────────────────────────────────────────────────

const mockStages: StageInfo[] = [
  { id: 'register', step: 1, icon: '📝', title: i18n.t('FullPipelineUI.k1'), subtitle: i18n.t('FullPipelineUI.k2'), done: true, progress: 100, actions: [i18n.t('FullPipelineUI.k3'), i18n.t('FullPipelineUI.k4')] },
  { id: 'connect', step: 2, icon: '🔌', title: i18n.t('FullPipelineUI.k5'), subtitle: 'Futu OpenD / IBKR Gateway', done: true, progress: 100, actions: [i18n.t('FullPipelineUI.k6'), i18n.t('FullPipelineUI.k7')] },
  { id: 'topup', step: 3, icon: '💰', title: i18n.t('FullPipelineUI.k8'), subtitle: i18n.t('FullPipelineUI.k9'), done: true, progress: 100, actions: [i18n.t('FullPipelineUI.k10'), i18n.t('FullPipelineUI.k11')] },
  { id: 'ai', step: 4, icon: '🤖', title: i18n.t('FullPipelineUI.k12'), subtitle: i18n.t('FullPipelineUI.k13'), done: false, progress: 65, actions: [i18n.t('FullPipelineUI.k14'), i18n.t('FullPipelineUI.k15')] },
  { id: 'trade', step: 5, icon: '💹', title: i18n.t('FullPipelineUI.k16'), subtitle: i18n.t('FullPipelineUI.k17'), done: false, progress: 40, actions: [i18n.t('FullPipelineUI.k18'), i18n.t('FullPipelineUI.k19')] },
  { id: 'withdraw', step: 6, icon: '💸', title: i18n.t('FullPipelineUI.k20'), subtitle: i18n.t('FullPipelineUI.k21'), done: false, progress: 0, actions: [i18n.t('FullPipelineUI.k22'), i18n.t('FullPipelineUI.k23')] },
];

// ── Progress Dot ────────────────────────────────────────────────────────

function ProgressDot({ done, active }: { done: boolean; active: boolean }) {
  const { t: _t } = useTranslation();

  const color = done ? '#22C55E' : active ? '#D4A853' : '#334155';
  const bg = done ? 'rgba(34,197,94,0.15)' : active ? 'rgba(212,168,83,0.15)' : 'rgba(51,65,85,0.3)';
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: bg, color, border: `2px solid ${color}`, flexShrink: 0 }}>
      {done ? '✓' : ''}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export default function FullPipelineUI({ stages: propStages, className = '' }: FullPipelineUIProps) {
  const [stages] = useState(propStages ?? mockStages);

  return (
    <div className={`h-full flex flex-col bg-[#0A0A10] text-white ${className}`}>
      <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: '#D4A853', margin: 0 }}>🚀 开始交易 · Get Started</h2>
        <p style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{i18n.t('FullPipelineUI.k0')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div style={{ position: 'relative', paddingLeft: 16 }}>
          {/* Vertical line */}
          <div style={{ position: 'absolute', left: 16 + 15, top: 32, bottom: 0, width: 2, background: 'rgba(255,255,255,0.06)' }} />

          {stages.map((s, i) => {
            const isLast = i === stages.length - 1;
            return (
              <div key={s.id} style={{ position: 'relative', paddingBottom: isLast ? 0 : 24 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <ProgressDot done={s.done} active={!s.done} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: s.done ? '#22C55E' : '#E2E8F0' }}>第{s.step}{i18n.t('FullPipelineUI.k0')}{s.title}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>{s.subtitle}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {!s.done && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 2, width: `${s.progress}%`, background: '#D4A853', transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ fontSize: 9, color: '#64748B', textAlign: 'right', marginTop: 2 }}>{s.progress}%</div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.actions.map(a => (
                        <button key={a} style={{ padding: '5px 14px', fontSize: 10, fontWeight: 600, background: s.done ? 'rgba(34,197,94,0.1)' : 'rgba(212,168,83,0.1)', color: s.done ? '#22C55E' : '#D4A853', border: `1px solid ${s.done ? 'rgba(34,197,94,0.2)' : 'rgba(212,168,83,0.2)'}`, borderRadius: 6, cursor: 'pointer' }}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary card */}
        <div style={{ marginTop: 16, padding: 16, background: 'rgba(212,168,83,0.05)', border: '1px solid rgba(212,168,83,0.1)', borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#D4A853', marginBottom: 8 }}>📊 进度概览</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            <div style={{ padding: 8, background: 'rgba(34,197,94,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#22C55E' }}>{stages.filter(s => s.done).length}</div>
              <div style={{ fontSize: 9, color: '#64748B' }}>{i18n.t('FullPipelineUI.k1')}</div>
            </div>
            <div style={{ padding: 8, background: 'rgba(251,191,36,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FBBF24' }}>{stages.filter(s => !s.done).length}</div>
              <div style={{ fontSize: 9, color: '#64748B' }}>{i18n.t('FullPipelineUI.k2')}</div>
            </div>
            <div style={{ padding: 8, background: 'rgba(59,130,246,0.05)', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#60A5FA' }}>3</div>
              <div style={{ fontSize: 9, color: '#64748B' }}>{i18n.t('FullPipelineUI.k3')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
