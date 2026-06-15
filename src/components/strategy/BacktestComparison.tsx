// ── R220 ML#1: BacktestComparison — 回测一键对比(保存快照+并排) ──────────
// 保存当前回测为快照, 调整参数后重跑, 一键并排对比
// 差异高亮(收益/夏普/回撤变好=绿色, 变差=红色)
// 支持 2 个版本并排(预留扩展到 N)
// 9语言i18n, 紧凑响应式

import { useState, useCallback, useMemo } from 'react';
import { Button, Card, Tag, Space, Modal, Empty, Input, message } from 'antd';
import {
  SaveOutlined, SwapOutlined, TrophyOutlined, RiseOutlined,
  FallOutlined, CloseCircleOutlined,
  CameraOutlined, DeleteOutlined, CopyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import i18n from '../../i18n';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BacktestSnapshot {
  id: string;
  name: string;
  savedAt: number;
  strategyId: string;
  params: Record<string, number>;
  result: {
    totalReturn: number;
    annualizedReturn: number;
    maxDrawdown: number;
    sharpe: number;
    winRate: number;
    trades: number;
    profitFactor: number;
    finalCapital: number;
  };
  note?: string;
}

export interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  trades: number;
  profitFactor: number;
  finalCapital: number;
}

export interface BacktestComparisonProps {
  currentResult: BacktestResult;
  currentParams: Record<string, number>;
  currentName?: string;
  snapshots?: BacktestSnapshot[];
  strategyId?: string;
  onSaveSnapshot?: (snap: BacktestSnapshot) => void;
  onDeleteSnapshot?: (id: string) => void;
  onApplyParams?: (params: Record<string, number>) => void;
  locale?: string;
}

const I18N = (k: string) => i18n.t(`backtestCompare.${k}`);

// ── 差异工具 ───────────────────────────────────────────────────────────────

function diffIndicator(cur: number, base: number, higherIsBetter = true): { icon: React.ReactNode; text: string; cls: string; delta: number } {
  const delta = cur - base;
  if (Math.abs(delta) < 0.001) return { icon: '—', text: '0', cls: 'neutral', delta };
  const isBetter = higherIsBetter ? delta > 0 : delta < 0;
  return {
    icon: isBetter ? <RiseOutlined /> : <FallOutlined />,
    text: `${delta > 0 ? '+' : ''}${delta.toFixed(2)}`,
    cls: isBetter ? 'better' : 'worse',
    delta,
  };
}

// ── 单指标行 ───────────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  current: number;
  base: number;
  formatter: (v: number) => string;
  higherIsBetter?: boolean;
  note?: string;
}

function MetricRow({ label, current, base, formatter, higherIsBetter = true, note }: MetricRowProps) {
  const diff = diffIndicator(current, base, higherIsBetter);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #2a2d3e' }}>
      <div style={{ color: '#9ca3af', fontSize: 12 }}>{label}</div>
      <div style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600 }}>{formatter(current)}</div>
      <div style={{ color: '#6b7280', fontSize: 13 }}>{formatter(base)}</div>
      <div style={{
        color: diff.cls === 'better' ? '#22c55e' : diff.cls === 'worse' ? '#ef4444' : '#9ca3af',
        fontSize: 12, fontWeight: 600,
      }}>
        <span style={{ marginRight: 4 }}>{diff.icon}</span>
        {diff.text} {note && <span style={{ color: '#6b7280', fontWeight: 400, fontSize: 10, marginLeft: 4 }}>({note})</span>}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function BacktestComparison({
  currentResult,
  currentParams,
  currentName = '当前回测',
  snapshots: propSnapshots,
  strategyId = 'unknown',
  onSaveSnapshot,
  onDeleteSnapshot,
  onApplyParams,
}: BacktestComparisonProps) {
  const [snapshots, setSnapshots] = useState<BacktestSnapshot[]>(propSnapshots || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNote, setSaveNote] = useState('');

  const selected = useMemo(() => snapshots.find(s => s.id === selectedId) || null, [snapshots, selectedId]);
  const base = selected?.result;

  // ── Save snapshot ──
  const handleSave = useCallback(() => {
    if (!saveName.trim()) {
      message.warning('请输入快照名称');
      return;
    }
    const snap: BacktestSnapshot = {
      id: `snap_${Date.now()}`,
      name: saveName.trim(),
      savedAt: Date.now(),
      strategyId,
      params: { ...currentParams },
      result: { ...currentResult },
      note: saveNote || undefined,
    };
    setSnapshots(prev => [...prev, snap]);
    onSaveSnapshot?.(snap);
    setSaveName('');
    setSaveNote('');
    setShowSave(false);
    setSelectedId(snap.id);
    message.success(`快照已保存: ${snap.name}`);
  }, [saveName, saveNote, currentParams, currentResult, strategyId, onSaveSnapshot]);

  // ── Delete snapshot ──
  const handleDelete = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id));
    onDeleteSnapshot?.(id);
    if (selectedId === id) setSelectedId(null);
  }, [selectedId, onDeleteSnapshot]);

  // ── Apply snapshot params ──
  const handleApply = useCallback(() => {
    if (selected && onApplyParams) {
      onApplyParams(selected.params);
      message.success(`已应用 ${selected.name} 的参数`);
    }
  }, [selected, onApplyParams]);

  // ── Compute summary ──
  const summary = useMemo(() => {
    if (!base) return null;
    const winner = {
      totalReturn: currentResult.totalReturn > base.totalReturn,
      sharpe: currentResult.sharpe > base.sharpe,
      maxDrawdown: currentResult.maxDrawdown < base.maxDrawdown,
      winRate: currentResult.winRate > base.winRate,
      trades: currentResult.trades >= base.trades,
    };
    const wins = Object.values(winner).filter(Boolean).length;
    return { winner, wins, total: 5 };
  }, [base, currentResult]);

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ color: '#e0e0e0', fontSize: 16, fontWeight: 700, margin: 0 }}>
            <SwapOutlined style={{ color: '#60a5fa' }} /> {I18N('title')}
          </h3>
          <p style={{ color: '#6b7280', fontSize: 11, margin: '4px 0 0' }}>{I18N('subtitle')}</p>
        </div>
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => setShowSave(true)} style={{ background: '#C9A046', borderColor: '#C9A046' }}>
            {I18N('saveSnapshot')}
          </Button>
        </Space>
      </div>

      {/* Snapshot selector */}
      {snapshots.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#6b7280', fontSize: 12 }}>
              {I18N('noSnapshots')}
              <br />
              <span style={{ color: '#9ca3af' }}>{I18N('saveHint')}</span>
            </span>
          }
        />
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{I18N('selectBaseline')}</div>
            <Space wrap>
              {snapshots.map(s => (
                <Card
                  key={s.id}
                  size="small"
                  hoverable
                  onClick={() => setSelectedId(s.id)}
                  styles={{ body: { padding: 8 } }}
                  style={{
                    background: selectedId === s.id ? '#D4A85320' : '#1a1a25',
                    border: selectedId === s.id ? '1px solid #D4A853' : '1px solid #2a2d3e',
                    minWidth: 200,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>
                        <CameraOutlined /> {new Date(s.savedAt).toLocaleString()}
                      </div>
                      {s.note && <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 2 }}>📝 {s.note}</div>}
                    </div>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                      danger
                    />
                  </div>
                </Card>
              ))}
            </Space>
          </div>

          {/* Comparison table */}
          {base && (
            <Card size="small" styles={{ body: { padding: 0 } }} style={{ background: '#1a1a25', border: '1px solid #2a2d3e', borderRadius: 10, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', padding: '10px 12px', background: '#0f1117', borderBottom: '1px solid #2a2d3e' }}>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>{I18N('metric')}</div>
                <div style={{ color: '#60a5fa', fontSize: 12, fontWeight: 600 }}>
                  <ThunderboltOutlined /> {currentName} <Tag color="blue" style={{ marginLeft: 4 }}>NEW</Tag>
                </div>
                <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>
                  <CameraOutlined /> {selected?.name}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 600 }}>{I18N('diff')}</div>
              </div>

              <MetricRow label={I18N('totalReturn')} current={currentResult.totalReturn * 100} base={base.totalReturn * 100} formatter={v => `${v.toFixed(2)}%`} higherIsBetter />
              <MetricRow label={I18N('annualized')} current={currentResult.annualizedReturn * 100} base={base.annualizedReturn * 100} formatter={v => `${v.toFixed(2)}%`} higherIsBetter />
              <MetricRow label={I18N('sharpe')} current={currentResult.sharpe} base={base.sharpe} formatter={v => v.toFixed(2)} higherIsBetter />
              <MetricRow label={I18N('maxDD')} current={currentResult.maxDrawdown * 100} base={base.maxDrawdown * 100} formatter={v => `${v.toFixed(2)}%`} higherIsBetter={false} note={I18N('lowerBetter')} />
              <MetricRow label={I18N('winRate')} current={currentResult.winRate * 100} base={base.winRate * 100} formatter={v => `${v.toFixed(1)}%`} higherIsBetter />
              <MetricRow label={I18N('trades')} current={currentResult.trades} base={base.trades} formatter={v => v.toString()} higherIsBetter />
              <MetricRow label={I18N('profitFactor')} current={currentResult.profitFactor} base={base.profitFactor} formatter={v => v.toFixed(2)} higherIsBetter />
            </Card>
          )}

          {/* Summary banner */}
          {base && summary && (
            <div style={{
              background: summary.wins >= 4 ? '#065f46' : summary.wins >= 3 ? '#1e3a8a' : '#7f1d1d',
              border: `1px solid ${summary.wins >= 4 ? '#22c55e' : summary.wins >= 3 ? '#3b82f6' : '#ef4444'}`,
              borderRadius: 8, padding: '12px 16px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {summary.wins >= 4 ? <TrophyOutlined style={{ fontSize: 24, color: '#22c55e' }} /> :
                 summary.wins >= 3 ? <ThunderboltOutlined style={{ fontSize: 24, color: '#3b82f6' }} /> :
                 <CloseCircleOutlined style={{ fontSize: 24, color: '#ef4444' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                    {summary.wins >= 4 ? I18N('winnerCurrent') : summary.wins >= 3 ? I18N('winnerClose') : I18N('winnerBaseline')}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                    {I18N('wins')}: {summary.wins}/{summary.total} · {I18N('metric')} {summary.winner.totalReturn && '📈'}{summary.winner.sharpe && '📊'}{summary.winner.maxDrawdown && '🛡️'}{summary.winner.winRate && '🎯'}{summary.winner.trades && '📋'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {base && (
            <Space>
              <Button icon={<CopyOutlined />} onClick={handleApply}>{I18N('applyParams')}</Button>
              <Button icon={<SwapOutlined />} onClick={() => setSelectedId(null)}>{I18N('clearSelection')}</Button>
            </Space>
          )}

          {/* Param diff */}
          {base && (
            <Card size="small" styles={{ body: { padding: 12 } }} style={{ background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 8, marginTop: 12 }}>
              <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>{I18N('paramDiff')}</div>
              <Space wrap size={4}>
                {Object.keys(currentParams).map(k => {
                  const a = currentParams[k];
                  const b = base && (selected?.params[k] ?? 0);
                  const changed = a !== b;
                  return (
                    <Tag
                      key={k}
                      color={changed ? 'orange' : 'default'}
                      style={{ fontSize: 11 }}
                    >
                      {k}: {changed ? <strong style={{ color: '#f59e0b' }}>{a}</strong> : a}
                      {changed && <span style={{ color: '#6b7280', marginLeft: 4 }}>← {b}</span>}
                    </Tag>
                  );
                })}
              </Space>
            </Card>
          )}
        </>
      )}

      {/* Save modal */}
      <Modal
        open={showSave}
        onCancel={() => setShowSave(false)}
        onOk={handleSave}
        title={I18N('saveTitle')}
        okText={I18N('save')}
        cancelText={I18N('cancel')}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#e0e0e0', fontSize: 13, marginBottom: 4 }}>{I18N('snapshotName')}</div>
          <Input
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            placeholder={I18N('snapshotPlaceholder')}
            maxLength={50}
          />
        </div>
        <div>
          <div style={{ color: '#e0e0e0', fontSize: 13, marginBottom: 4 }}>{I18N('snapshotNote')}</div>
          <Input.TextArea
            value={saveNote}
            onChange={e => setSaveNote(e.target.value)}
            placeholder={I18N('notePlaceholder')}
            rows={3}
            maxLength={200}
          />
        </div>
      </Modal>
    </div>
  );
}
