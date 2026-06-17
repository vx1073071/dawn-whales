// @ts-nocheck
// R285 ML#4: TW11Coverage — TradingView 11大功能覆盖 (5h)
// 1 时段高亮 2 十字准星 3 数据窗口 4 自定周期 5 模板保存
// 6 多屏 7 指标叠加 8 价格线 9 区间统计 10 快捷键 11 快照
// TW11覆盖: 对标TradingView核心功能
import React, { useState, useCallback, useMemo } from 'react';
import { Crosshair, Layers, Save, Monitor, Clock, Camera, Hash, Maximize2, BarChart3, Keyboard } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────
interface TW11Settings {
  highlightSession: boolean;       // 1. 时段高亮 (亚洲/欧洲/美洲)
  crosshairMode: 'normal' | 'magnet'; // 2. 十字准星 (普通/吸附)
  showDataWindow: boolean;         // 3. 数据窗口 (悬浮显示OHLCV)
  customPeriod: string;            // 4. 自定义周期 (如 "3h", "45m")
  autoSaveTemplate: boolean;       // 5. 模板自动保存
  multiScreenLayout: 'single' | '2x1' | '2x2' | '3x1' | '4x1'; // 6. 多屏布局
  maxIndicatorOverlay: number;     // 7. 最大指标叠� (3/5/10/unlimited)
  priceLine: boolean;              // 8. 价格线 (水平价格标记)
  rangeStats: boolean;             // 9. 区间统计 (选中后显示涨跌幅)
  shortcuts: boolean;              // 10. 快捷键
  snapshotQuality: 'high' | 'normal'; // 11. 快照质量
}

const DEFAULT_SETTINGS: TW11Settings = {
  highlightSession: true, crosshairMode: 'normal', showDataWindow: true,
  customPeriod: '', autoSaveTemplate: true, multiScreenLayout: 'single',
  maxIndicatorOverlay: 5, priceLine: true, rangeStats: true,
  shortcuts: true, snapshotQuality: 'high',
};

// ─── Trading Sessions ──────────────────────────────────────────────
const SESSIONS = [
  { name: '亚洲', emoji: '🌏', hours: '09:00-16:00', tz: 'Asia/Tokyo', color: '#f59e0b20', border: '#f59e0b' },
  { name: '欧洲', emoji: '🌍', hours: '09:00-17:30', tz: 'Europe/London', color: '#3b82f620', border: '#3b82f6' },
  { name: '美洲', emoji: '🌎', hours: '09:30-16:00', tz: 'America/New_York', color: '#22c55e20', border: '#22c55e' },
];

// ─── Shortcuts ─────────────────────────────────────────────────────
const SHORTCUTS = [
  { key: 'T', desc: '趋势线' },{ key: 'H', desc: '水平线' },{ key: 'V', desc: '垂直线' },
  { key: 'F', desc: '斐波那契' },{ key: 'R', desc: '矩形' },{ key: 'C', desc: '十字准星' },
  { key: 'Alt+S', desc: '截图' },{ key: 'Alt+F', desc: '全屏' },{ key: 'Space', desc: '十字光标开关' },
  { key: '1-9', desc: '切换周期' },{ key: '↑↓', desc: '缩放' },{ key: '←→', desc: '平移' },
];

interface Props { dark?: boolean; settings?: TW11Settings; onSettingsChange?: (s: TW11Settings) => void; }

export default function TW11Coverage({ dark = true, settings: extSettings, onSettingsChange }: Props) {
  const [settings, setSettings] = useState<TW11Settings>(extSettings || DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<string>('sessions');

  const c = dark ? {
    bg: '#0a0e1a', s: '#111827', sh: '#1a2236', b: '#1e293b', t: '#e2e8f0', t2: '#64748b',
    a: '#3b82f6', ab: '#1e3a5f', ok: '#22c55e', er: '#ef4444', wa: '#f59e0b',
  } : {
    bg: '#f8fafc', s: '#ffffff', sh: '#f1f5f9', b: '#e2e8f0', t: '#0f172a', t2: '#64748b',
    a: '#2563eb', ab: '#dbeafe', ok: '#16a34a', er: '#dc2626', wa: '#d97706',
  };

  const update = useCallback((patch: Partial<TW11Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next); onSettingsChange?.(next);
  }, [settings, onSettingsChange]);

  const tabs = [
    { id: 'sessions', icon: <Clock size={13}/>, label: '时段' },
    { id: 'crosshair', icon: <Crosshair size={13}/>, label: '准星' },
    { id: 'layout', icon: <Monitor size={13}/>, label: '布局' },
    { id: 'data', icon: <Hash size={13}/>, label: '数据' },
    { id: 'shortcuts', icon: <Keyboard size={13}/>, label: '快捷键' },
  ];

  return <div style={{ padding: 14, background: c.bg, color: c.t, fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto', borderRadius: 14 }}>
    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      ⚙️ 图表设置 <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: c.ab, color: c.a }}>TW11</span>
    </div>

    {/* Tab bar */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {tabs.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: activeTab === tab.id ? 600 : 400,
        cursor: 'pointer', border: 'none', background: activeTab === tab.id ? c.a : c.sh, color: activeTab === tab.id ? '#fff' : c.t2,
      }}>{tab.icon} {tab.label}</button>)}
    </div>

    {/* ── Tab Content ── */}
    {activeTab === 'sessions' && <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>1. 交易时段高亮</div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={settings.highlightSession} onChange={e => update({ highlightSession: e.target.checked })}/>
          在图表上显示不同时段背景色
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SESSIONS.map(s => <div key={s.name} style={{ padding: '8px 12px', borderRadius: 8, background: s.color, border: `1px solid ${s.border}30` }}>
          <span style={{ fontSize: 14, marginRight: 6 }}>{s.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{s.name}: {s.hours} ({s.tz})</span>
        </div>)}
      </div>
    </div>}

    {activeTab === 'crosshair' && <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>2. 十字准星模式</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { v: 'normal', l: '📌 普通模式 — 十字线跟随鼠标自由移动' },
          { v: 'magnet', l: '🧲 吸附模式 — 十字线自动吸附到OHLC价格' },
        ].map(m => <label key={m.v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: settings.crosshairMode === m.v ? c.ab : c.sh, cursor: 'pointer', fontSize: 12 }}>
          <input type="radio" name="crosshair" checked={settings.crosshairMode === m.v} onChange={() => update({ crosshairMode: m.v as any })}/>
          {m.l}
        </label>)}
      </div>
    </div>}

    {activeTab === 'layout' && <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>6. 多屏布局 + 4. 自定周期 + 5. 模板</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, marginBottom: 10 }}>
        {['single', '2x1', '3x1'].map(l => <button key={l} onClick={() => update({ multiScreenLayout: l as any })} style={{
          padding: '10px', borderRadius: 8, fontSize: 11, fontWeight: settings.multiScreenLayout === l ? 600 : 400,
          cursor: 'pointer', border: settings.multiScreenLayout === l ? `2px solid ${c.a}` : `1px solid ${c.b}`,
          background: settings.multiScreenLayout === l ? c.ab : c.sh, color: settings.multiScreenLayout === l ? c.a : c.t2,
        }}>{l === 'single' ? '1图' : l === '2x1' ? '2图并排' : '3图并排'}</button>)}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: c.t2, marginBottom: 4 }}>自定义周期</div>
        <input value={settings.customPeriod} onChange={e => update({ customPeriod: e.target.value })} placeholder="如: 3h, 45m, 2D" style={{
          width: '100%', padding: '6px 10px', borderRadius: 6, background: c.sh, border: `1px solid ${c.b}`, color: c.t, fontSize: 12, outline: 'none', boxSizing: 'border-box',
        }}/>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
        <input type="checkbox" checked={settings.autoSaveTemplate} onChange={e => update({ autoSaveTemplate: e.target.checked })}/>
        <Save size={13}/> 自动保存图表模板
      </label>
    </div>}

    {activeTab === 'data' && <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>3. 数据窗口 + 7. 指标 + 8. 价线 + 9. 统计 + 11. 快照</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { key: 'showDataWindow', label: '📊 3. 悬浮数据窗口 (OHLCV)', v: settings.showDataWindow },
          { key: 'priceLine', label: '💲 8. 价格线 (水平价标)', v: settings.priceLine },
          { key: 'rangeStats', label: '📏 9. 区间统计 (选中显示涨跌幅)', v: settings.rangeStats },
        ].map((item: any) => <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input type="checkbox" checked={item.v} onChange={e => update({ [item.key]: e.target.checked })}/>
          {item.label}
        </label>)}
        <div style={{ fontSize: 11, color: c.t2, marginTop: 4 }}>7. 最大指标叠加</div>
        <select value={settings.maxIndicatorOverlay} onChange={e => update({ maxIndicatorOverlay: +e.target.value })} style={{ padding: '6px', borderRadius: 6, background: c.sh, border: `1px solid ${c.b}`, color: c.t, fontSize: 11 }}>
          {[3,5,10,99].map(n => <option key={n} value={n}>{n === 99 ? '无限制' : `${n}个`}</option>)}
        </select>
        <div style={{ fontSize: 11, color: c.t2 }}>11. 快照质量</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ v: 'normal', l: '普通' },{ v: 'high', l: '高清' }].map(q => <button key={q.v} onClick={() => update({ snapshotQuality: q.v as any })} style={{
            flex: 1, padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: settings.snapshotQuality === q.v ? 600 : 400,
            cursor: 'pointer', border: settings.snapshotQuality === q.v ? `1px solid ${c.a}` : `1px solid ${c.b}`,
            background: settings.snapshotQuality === q.v ? c.ab : c.sh, color: settings.snapshotQuality === q.v ? c.a : c.t2,
          }}>{q.l}</button>)}
        </div>
      </div>
    </div>}

    {activeTab === 'shortcuts' && <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>10. 快捷键列表</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, marginBottom: 10 }}>
        <input type="checkbox" checked={settings.shortcuts} onChange={e => update({ shortcuts: e.target.checked })}/>
        启用键盘快捷键
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {SHORTCUTS.map(s => <div key={s.key} style={{ padding: '4px 8px', borderRadius: 4, background: c.sh, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ fontWeight: 600, color: c.a }}>{s.key}</span>
          <span style={{ color: c.t2 }}>{s.desc}</span>
        </div>)}
      </div>
    </div>}
  </div>;
}

export { DEFAULT_SETTINGS, SESSIONS, SHORTCUTS, type TW11Settings };
