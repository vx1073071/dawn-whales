// ── R169 P2-D6: Timing Config Panel ──────────────────────────────────────────
// Factor rotation timing configuration panel:
//   - Factor groups with enable/weight/rotation settings
//   - Auto-normalizing weights (sum to 100%)
//   - Presets: Momentum, Value-Defensive, Balanced, Custom
//   - Mini backtest preview (1yr return, Sharpe, max drawdown)
//   - Save/Load configs to localStorage
//
// Ant Design forms + ECharts donut chart, dark theme

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Card, Slider, Select, Switch, Button, InputNumber,
  Tag, Modal, message, Space, Divider, Empty,
} from 'antd';
import {
  SaveOutlined, FolderOpenOutlined, ThunderboltOutlined,
  DashboardOutlined, SafetyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────

interface FactorGroup {
  key: string;
  nameCN: string;
  factors: string[];
  enabled: boolean;
  weight: number; // 0-100
  rotationFreq: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  rebalanceThreshold: number; // %
}

interface TimingPreset {
  name: string;
  nameCN: string;
  icon: React.ReactNode;
  weights: Record<string, number>; // groupKey → weight
}

interface TimingConfig {
  name: string;
  groups: FactorGroup[];
  savedAt: string;
}

interface BacktestPreview {
  annualReturn: number;
  sharpe: number;
  maxDrawdown: number;
  volatility: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_GROUPS: FactorGroup[] = [
  {
    key: 'momentum', nameCN: '动量类', factors: ['MOM_12M', 'RSI_14', 'ADX'],
    enabled: true, weight: 25, rotationFreq: 'monthly', rebalanceThreshold: 5,
  },
  {
    key: 'value', nameCN: '价值类', factors: ['HML', 'YIELD'],
    enabled: true, weight: 25, rotationFreq: 'quarterly', rebalanceThreshold: 10,
  },
  {
    key: 'quality', nameCN: '质量类', factors: ['QUAL'],
    enabled: true, weight: 25, rotationFreq: 'monthly', rebalanceThreshold: 5,
  },
  {
    key: 'lowvol', nameCN: '低波类', factors: ['VOL_60D'],
    enabled: true, weight: 15, rotationFreq: 'weekly', rebalanceThreshold: 3,
  },
  {
    key: 'size', nameCN: '小盘类', factors: ['SMB', 'MKT'],
    enabled: false, weight: 10, rotationFreq: 'quarterly', rebalanceThreshold: 10,
  },
];

const PRESETS: TimingPreset[] = [
  {
    name: 'momentum', nameCN: '动量优先',
    icon: <ThunderboltOutlined />,
    weights: { momentum: 40, value: 15, quality: 25, lowvol: 15, size: 5 },
  },
  {
    name: 'defensive', nameCN: '价值防御',
    icon: <SafetyOutlined />,
    weights: { momentum: 10, value: 45, quality: 20, lowvol: 25, size: 0 },
  },
  {
    name: 'balanced', nameCN: '均衡配置',
    icon: <DashboardOutlined />,
    weights: { momentum: 25, value: 25, quality: 25, lowvol: 15, size: 10 },
  },
  {
    name: 'custom', nameCN: '自定义',
    icon: <SettingOutlined />,
    weights: {},
  },
];

const ROTATION_LABELS: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
};

// Simulate backtest based on config weights
function simulateBacktest(groups: FactorGroup[]): BacktestPreview {
  const enabled = groups.filter((g) => g.enabled);
  if (enabled.length === 0) return { annualReturn: 0, sharpe: 0, maxDrawdown: 0, volatility: 0 };

  // Momentum-heavy → higher return & volatility; lowvol-heavy → lower drawdown
  let momWeight = 0, valWeight = 0, qualWeight = 0, lowVol = 0;
  enabled.forEach((g) => {
    const w = g.weight / 100;
    if (g.key === 'momentum') momWeight = w;
    else if (g.key === 'value') valWeight = w;
    else if (g.key === 'quality') qualWeight = w;
    else if (g.key === 'lowvol') lowVol = w;
  });

  const annualReturn = 0.06 + momWeight * 0.12 + valWeight * 0.03 + qualWeight * 0.06 - lowVol * 0.02;
  const volatility = 0.12 + momWeight * 0.08 - lowVol * 0.05;
  const sharpe = annualReturn / (volatility || 0.01);
  const maxDrawdown = 0.15 + momWeight * 0.10 - qualWeight * 0.05 - lowVol * 0.08;

  return {
    annualReturn: Number((annualReturn * 100).toFixed(1)),
    sharpe: Number(sharpe.toFixed(2)),
    maxDrawdown: Number((maxDrawdown * 100).toFixed(1)),
    volatility: Number((volatility * 100).toFixed(1)),
  };
}

// ── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'dw_timing_configs';

function loadSavedConfigs(): TimingConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConfigsToStorage(configs: TimingConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

// ── Dark theme ────────────────────────────────────────────────────────────────

const darkCard = '#161b22';
const darkCardInner = '#1a1f2e';
const darkText = '#e5e7eb';
const darkGrid = '#21262d';
const darkSubText = '#8b949e';

// ── Component ────────────────────────────────────────────────────────────────

const TimingConfigPanel: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<FactorGroup[]>(DEFAULT_GROUPS);
  const [activePreset, setActivePreset] = useState<string>('balanced');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [configName, setConfigName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState<TimingConfig[]>([]);

  useEffect(() => {
    setSavedConfigs(loadSavedConfigs());
  }, []);

  // ── Auto-normalize weights ────────────────────────────────────────────────

  const normalizeWeights = useCallback((gs: FactorGroup[]): FactorGroup[] => {
    const enabled = gs.filter((g) => g.enabled);
    if (enabled.length === 0) return gs;
    const total = enabled.reduce((s, g) => s + g.weight, 0);
    if (total === 100) return gs;
    const scale = 100 / (total || 100);
    return gs.map((g) => ({
      ...g,
      weight: g.enabled ? Math.round(g.weight * scale) : g.weight,
    }));
  }, []);

  const updateGroup = useCallback(
    (key: string, patch: Partial<FactorGroup>) => {
      setGroups((prev) => {
        const next = prev.map((g) => (g.key === key ? { ...g, ...patch } : g));
        return normalizeWeights(next);
      });
    },
    [normalizeWeights],
  );

  // ── Preset selection ──────────────────────────────────────────────────────

  const applyPreset = useCallback((preset: TimingPreset) => {
    setActivePreset(preset.name);
    if (preset.name === 'custom') return;
    const updated = groups.map((g) => ({
      ...g,
      enabled: (preset.weights[g.key] ?? 0) > 0,
      weight: preset.weights[g.key] ?? 0,
    }));
    setGroups(normalizeWeights(updated));
  }, [groups, normalizeWeights]);

  // ── Save / Load ───────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!configName.trim()) {
      message.warning(t('timingConfig.enterName', 'Please enter a config name'));
      return;
    }
    const config: TimingConfig = {
      name: configName.trim(),
      groups: JSON.parse(JSON.stringify(groups)),
      savedAt: new Date().toISOString(),
    };
    const existing = loadSavedConfigs();
    const updated = existing.filter((c) => c.name !== config.name);
    updated.push(config);
    saveConfigsToStorage(updated);
    setSavedConfigs(updated);
    setSaveModalOpen(false);
    setConfigName('');
    message.success(t('timingConfig.saved', 'Config saved'));
  }, [configName, groups, t]);

  const handleLoad = useCallback((config: TimingConfig) => {
    setGroups(config.groups);
    setActivePreset('custom');
    setLoadModalOpen(false);
    message.success(t('timingConfig.loaded', 'Config loaded'));
  }, [t]);

  const handleDelete = useCallback((name: string) => {
    const updated = savedConfigs.filter((c) => c.name !== name);
    saveConfigsToStorage(updated);
    setSavedConfigs(updated);
  }, [savedConfigs]);

  // ── Donut chart ────────────────────────────────────────────────────────────

  const donutOption = useMemo(() => {
    const enabled = groups.filter((g) => g.enabled && g.weight > 0);
    const colors: Record<string, string> = {
      momentum: '#00e676', value: '#448aff', quality: '#ffc107',
      lowvol: '#e040fb', size: '#69f0ae',
    };
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: darkGrid,
        textStyle: { color: darkText, fontSize: 11 },
        formatter: '{b}: {c}%',
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['50%', '55%'],
          avoidLabelOverlap: false,
          itemStyle: { borderColor: '#0d1117', borderWidth: 2 },
          label: {
            color: darkText,
            fontSize: 11,
            formatter: '{b}\n{c}%',
          },
          data: enabled.map((g) => ({
            value: g.weight,
            name: g.nameCN,
            itemStyle: { color: colors[g.key] || '#666' },
          })),
        },
      ],
    };
  }, [groups]);

  // ── Backtest preview ───────────────────────────────────────────────────────

  const backtestPreview = useMemo(() => simulateBacktest(groups), [groups]);

  // ── Weight total indicator ─────────────────────────────────────────────────

  const weightTotal = useMemo(
    () => groups.filter((g) => g.enabled).reduce((s, g) => s + g.weight, 0),
    [groups],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4" style={{ background: darkCard, minHeight: '100vh' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold" style={{ color: darkText }}>
          ⏱ {t('timingConfig.title', 'Factor Timing Config')}
        </h2>
        <Space>
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => { setSavedConfigs(loadSavedConfigs()); setLoadModalOpen(true); }}
            style={{ background: '#21262d', borderColor: darkGrid, color: darkText }}
          >
            {t('timingConfig.load', 'Load')}
          </Button>
          <Button
            size="small"
            icon={<SaveOutlined />}
            onClick={() => setSaveModalOpen(true)}
            style={{ background: '#21262d', borderColor: darkGrid, color: darkText }}
          >
            {t('timingConfig.save', 'Save')}
          </Button>
        </Space>
      </div>

      {/* ── Presets ────────────────────────────────────────────────────────── */}
      <Card
        size="small"
        title={<span style={{ color: darkText, fontSize: 14 }}>🎯 {t('timingConfig.presets', 'Presets')}</span>}
        style={{ background: darkCardInner, borderColor: darkGrid }}
        styles={{ header: { background: darkCardInner, borderColor: darkGrid } }}
      >
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.name}
              size="small"
              type={activePreset === p.name ? 'primary' : 'default'}
              icon={p.icon}
              onClick={() => applyPreset(p)}
              style={
                activePreset === p.name
                  ? { background: '#1890ff', borderColor: '#1890ff' }
                  : { background: '#21262d', borderColor: darkGrid, color: darkText }
              }
            >
              {p.nameCN}
            </Button>
          ))}
        </div>
      </Card>

      {/* ── Factor Groups + Donut ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Groups config */}
        <Card
          size="small"
          className="lg:col-span-2"
          title={
            <span style={{ color: darkText, fontSize: 14 }}>
              ⚙ {t('timingConfig.groups', 'Factor Groups')}
            </span>
          }
          style={{ background: darkCardInner, borderColor: darkGrid }}
          styles={{ header: { background: darkCardInner, borderColor: darkGrid } }}
        >
          <div className="space-y-4">
            {groups.map((g) => (
              <div
                key={g.key}
                className="p-3 rounded"
                style={{
                  background: g.enabled ? '#1a2332' : '#11151a',
                  border: `1px solid ${g.enabled ? darkGrid : '#1a1a1a'}`,
                  opacity: g.enabled ? 1 : 0.6,
                }}
              >
                {/* Row 1: Enable + Name + Weight */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Switch
                    size="small"
                    checked={g.enabled}
                    onChange={(checked) => updateGroup(g.key, { enabled: checked })}
                  />
                  <span
                    className="font-medium text-sm"
                    style={{ color: g.enabled ? darkText : darkSubText, minWidth: 60 }}
                  >
                    {g.nameCN}
                  </span>
                  <Tag
                    color="blue"
                    style={{
                      background: '#1f2937',
                      border: 'none',
                      color: darkSubText,
                      fontSize: 10,
                    }}
                  >
                    {g.factors.join(', ')}
                  </Tag>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs" style={{ color: darkSubText }}>
                      {t('timingConfig.weight', 'Weight')}:
                    </span>
                    <InputNumber
                      size="small"
                      min={0}
                      max={100}
                      value={g.weight}
                      onChange={(v) => updateGroup(g.key, { weight: v ?? 0 })}
                      disabled={!g.enabled}
                      style={{ width: 65, background: '#0d1117', borderColor: darkGrid, color: darkText }}
                    />
                    <span className="text-xs" style={{ color: darkSubText }}>%</span>
                  </div>
                </div>

                {/* Row 2: Rotation + Rebalance */}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: darkSubText }}>
                      {t('timingConfig.rotation', 'Rotation')}:
                    </span>
                    <Select
                      size="small"
                      value={g.rotationFreq}
                      onChange={(v) => updateGroup(g.key, { rotationFreq: v })}
                      disabled={!g.enabled}
                      style={{ width: 100 }}
                      dropdownStyle={{ background: '#161b22' }}
                    >
                      {Object.entries(ROTATION_LABELS).map(([k, v]) => (
                        <Select.Option key={k} value={k}>{v}</Select.Option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: darkSubText }}>
                      {t('timingConfig.rebalance', 'Rebalance')}:
                    </span>
                    <Slider
                      style={{ width: 100, margin: 0 }}
                      min={1}
                      max={20}
                      step={1}
                      value={g.rebalanceThreshold}
                      onChange={(v) => updateGroup(g.key, { rebalanceThreshold: v })}
                      disabled={!g.enabled}
                      tooltip={{ formatter: (v?: number) => `${v}%` }}
                    />
                    <span className="text-xs" style={{ color: darkSubText }}>
                      {g.rebalanceThreshold}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Weight total */}
          <Divider style={{ borderColor: darkGrid, margin: '12px 0' }} />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: darkText }}>
              {t('timingConfig.totalWeight', 'Total Weight')}:
            </span>
            <Tag
              color={weightTotal === 100 ? 'green' : weightTotal > 100 ? 'red' : 'orange'}
              style={{ fontWeight: 'bold' }}
            >
              {weightTotal}%
            </Tag>
            {weightTotal !== 100 && (
              <span className="text-xs" style={{ color: darkSubText }}>
                {t('timingConfig.autoNormalize', 'Auto-normalized on next change')}
              </span>
            )}
          </div>
        </Card>

        {/* Donut chart */}
        <Card
          size="small"
          title={
            <span style={{ color: darkText, fontSize: 14 }}>
              🍩 {t('timingConfig.distribution', 'Distribution')}
            </span>
          }
          style={{ background: darkCardInner, borderColor: darkGrid }}
          styles={{ header: { background: darkCardInner, borderColor: darkGrid } }}
        >
          {groups.filter((g) => g.enabled && g.weight > 0).length > 0 ? (
            <ReactECharts
              option={donutOption}
              style={{ height: 240 }}
              opts={{ renderer: 'svg' }}
              theme="dark"
            />
          ) : (
            <Empty description={t('timingConfig.noFactors', 'No factors enabled')} />
          )}
        </Card>
      </div>

      {/* ── Backtest Preview ───────────────────────────────────────────────── */}
      <Card
        size="small"
        title={
          <span style={{ color: darkText, fontSize: 14 }}>
            🔬 {t('timingConfig.backtestPreview', 'Backtest Preview (1yr simulated)')}
          </span>
        }
        style={{ background: darkCardInner, borderColor: darkGrid }}
        styles={{ header: { background: darkCardInner, borderColor: darkGrid } }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded" style={{ background: '#0d1117' }}>
            <div
              className="text-xl font-bold"
              style={{ color: backtestPreview.annualReturn >= 0 ? '#00c853' : '#ff5252' }}
            >
              {backtestPreview.annualReturn > 0 ? '+' : ''}{backtestPreview.annualReturn}%
            </div>
            <div className="text-xs" style={{ color: darkSubText }}>
              {t('timingConfig.annualReturn', 'Annual Return')}
            </div>
          </div>
          <div className="text-center p-3 rounded" style={{ background: '#0d1117' }}>
            <div
              className="text-xl font-bold"
              style={{ color: backtestPreview.sharpe >= 1 ? '#00c853' : backtestPreview.sharpe >= 0.5 ? '#ffab00' : '#ff5252' }}
            >
              {backtestPreview.sharpe}
            </div>
            <div className="text-xs" style={{ color: darkSubText }}>
              {t('timingConfig.sharpe', 'Sharpe Ratio')}
            </div>
          </div>
          <div className="text-center p-3 rounded" style={{ background: '#0d1117' }}>
            <div
              className="text-xl font-bold"
              style={{ color: backtestPreview.maxDrawdown > 20 ? '#ff5252' : backtestPreview.maxDrawdown > 10 ? '#ffab00' : '#00c853' }}
            >
              -{backtestPreview.maxDrawdown}%
            </div>
            <div className="text-xs" style={{ color: darkSubText }}>
              {t('timingConfig.maxDrawdown', 'Max Drawdown')}
            </div>
          </div>
          <div className="text-center p-3 rounded" style={{ background: '#0d1117' }}>
            <div className="text-xl font-bold" style={{ color: darkText }}>
              {backtestPreview.volatility}%
            </div>
            <div className="text-xs" style={{ color: darkSubText }}>
              {t('timingConfig.volatility', 'Volatility')}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Save Modal ─────────────────────────────────────────────────────── */}
      <Modal
        title={t('timingConfig.saveConfig', 'Save Config')}
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onOk={handleSave}
        okText={t('common.save', 'Save')}
        cancelText={t('common.cancel', 'Cancel')}
        styles={{
          content: { background: darkCardInner },
          header: { background: darkCardInner, color: darkText },
          body: { background: darkCardInner },
        }}
      >
        <div className="space-y-2">
          <label className="text-sm" style={{ color: darkText }}>
            {t('timingConfig.configName', 'Config Name')}
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: '#0d1117', border: `1px solid ${darkGrid}`, color: darkText }}
            placeholder={t('timingConfig.configNamePlaceholder', 'e.g. My Momentum Strategy')}
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
          />
        </div>
      </Modal>

      {/* ── Load Modal ─────────────────────────────────────────────────────── */}
      <Modal
        title={t('timingConfig.loadConfig', 'Load Config')}
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        styles={{
          content: { background: darkCardInner },
          header: { background: darkCardInner, color: darkText },
          body: { background: darkCardInner },
        }}
      >
        {savedConfigs.length === 0 ? (
          <Empty description={t('timingConfig.noSaved', 'No saved configs')} />
        ) : (
          <div className="space-y-2">
            {savedConfigs.map((cfg) => (
              <div
                key={cfg.name}
                className="flex items-center justify-between p-3 rounded"
                style={{ background: '#0d1117', border: `1px solid ${darkGrid}` }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: darkText }}>
                    {cfg.name}
                  </div>
                  <div className="text-xs" style={{ color: darkSubText }}>
                    {new Date(cfg.savedAt).toLocaleString()}
                  </div>
                </div>
                <Space>
                  <Button
                    size="small"
                    onClick={() => handleLoad(cfg)}
                    style={{ background: '#21262d', borderColor: darkGrid, color: darkText }}
                  >
                    {t('timingConfig.loadBtn', 'Load')}
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => handleDelete(cfg.name)}
                  >
                    {t('common.delete', 'Delete')}
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TimingConfigPanel;
