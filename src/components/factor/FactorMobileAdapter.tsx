// @ts-nocheck
// R280 ML#2: Mobile Factor Page Adaptation
// Responsive layouts for all 25+ factor pages: compact cards, bottom nav, swipe gestures, touch-friendly charts
// 移动端因子页适配 — compact card + bottom nav + swipe + touch chart (6h)

import React, { useState, useCallback, useMemo, useEffect, useRef, TouchEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, BarChart3, Zap, Star, Globe, Layers, Search, Home,
  Activity, Compass, User, Sparkles, ChevronRight, Filter, Moon, Sun
} from 'lucide-react';

// ─── Responsive Detection ──────────────────────────────────────────
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// ─── Swipe Hook ────────────────────────────────────────────────────
function useSwipe(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const startX = useRef(0);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) onSwipeRight?.();
    else onSwipeLeft?.();
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
}

// ─── Mock Data ─────────────────────────────────────────────────────
interface FactorMob {
  id: string;
  name: string;
  nameCN: string;
  cat: string;
  catCN: string;
  ic: number;
  signal: 'LONG' | 'SHORT' | 'NEUTRAL';
  trend: number[];
}

const MOB_FACTORS: FactorMob[] = [
  { id: 'MOM_1M', name: '1M Momentum', nameCN: '1月动量', cat: 'Momentum', catCN: '动量', ic: 0.044, signal: 'LONG', trend: [0.032, 0.035, 0.041, 0.044, 0.046, 0.044] },
  { id: 'PE_TTM', name: 'PE TTM', nameCN: '市盈率TTM', cat: 'Value', catCN: '价值', ic: 0.042, signal: 'LONG', trend: [0.038, 0.04, 0.039, 0.041, 0.043, 0.042] },
  { id: 'ROE_TTM', name: 'ROE TTM', nameCN: 'ROE TTM', cat: 'Quality', catCN: '质量', ic: 0.029, signal: 'LONG', trend: [0.031, 0.03, 0.032, 0.028, 0.029, 0.029] },
  { id: 'F_SCORE', name: 'F-Score', nameCN: '皮氏评分', cat: 'Quality', catCN: '质量', ic: 0.038, signal: 'LONG', trend: [0.035, 0.037, 0.036, 0.039, 0.038, 0.038] },
  { id: 'IV_RANK', name: 'IV Rank', nameCN: 'IV排列', cat: 'Options', catCN: '期权', ic: 0.035, signal: 'SHORT', trend: [-0.028, -0.03, -0.033, -0.034, -0.035, -0.035] },
  { id: 'SHORT_INTEREST', name: 'Short Interest', nameCN: '沽空比例', cat: 'Sentiment', catCN: '情绪', ic: -0.026, signal: 'SHORT', trend: [-0.02, -0.022, -0.024, -0.025, -0.026, -0.026] },
  { id: 'PCR', name: 'Put/Call Ratio', nameCN: 'Put/Call比', cat: 'Options', catCN: '期权', ic: -0.031, signal: 'SHORT', trend: [-0.027, -0.029, -0.03, -0.032, -0.031, -0.031] },
  { id: 'NORTHBOUND', name: 'Northbound Flow', nameCN: '北向资金', cat: 'Flow', catCN: '资金流', ic: 0.033, signal: 'LONG', trend: [0.029, 0.03, 0.031, 0.032, 0.033, 0.033] },
  { id: 'BETA_60D', name: '60D Beta', nameCN: '60日Beta', cat: 'Volatility', catCN: '波动', ic: -0.022, signal: 'SHORT', trend: [-0.018, -0.019, -0.02, -0.021, -0.022, -0.022] },
  { id: 'ESG_MSCI', name: 'MSCI ESG', nameCN: 'MSCI ESG', cat: 'ESG', catCN: 'ESG', ic: 0.028, signal: 'LONG', trend: [0.024, 0.025, 0.026, 0.027, 0.028, 0.028] },
];

const TABS = [
  { id: 'home', icon: <Home size={18} />, label: '首页' },
  { id: 'factors', icon: <Activity size={18} />, label: '因子' },
  { id: 'pk', icon: <Zap size={18} />, label: 'PK' },
  { id: 'discover', icon: <Compass size={18} />, label: '发现' },
  { id: 'me', icon: <User size={18} />, label: '我的' },
];

// ─── Sub Components ────────────────────────────────────────────────

function MiniSparkline({ data, color, width, height }: { data: number[]; color: string; width: number; height: number }) {
  const max = Math.max(...data, 0.001);
  const min = Math.min(...data, -0.001);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FactorCompactCard({ factor, index, isSwiped, onTap }: { factor: FactorMob; index: number; isSwiped: boolean; onTap: () => void }) {
  const icColor = factor.ic > 0 ? '#22c55e' : '#ef4444';
  return (
    <div
      onClick={onTap}
      style={{
        padding: '10px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid #1e293b',
        transition: 'transform 0.2s',
        transform: isSwiped ? 'translateX(-80px)' : 'none',
      }}
    >
      <span style={{ width: 24, fontSize: 12, color: '#64748b', textAlign: 'right', flexShrink: 0 }}>#{index}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{factor.nameCN}</span>
          {factor.signal === 'LONG' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>L</span>}
          {factor.signal === 'SHORT' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>S</span>}
        </div>
        <span style={{ fontSize: 11, color: '#64748b' }}>{factor.catCN}</span>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: icColor }}>
          {factor.ic > 0 ? '+' : ''}{factor.ic.toFixed(3)}
        </span>
      </div>
      <MiniSparkline data={factor.trend} color={icColor} width={50} height={24} />
      <ChevronRight size={14} style={{ color: '#64748b', flexShrink: 0 }} />
    </div>
  );
}

function FactorFullCard({ factor, onClose }: { factor: FactorMob; onClose: () => void }) {
  const icColor = factor.ic > 0 ? '#22c55e' : '#ef4444';
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: '#0a0e1a',
      overflow: 'auto',
      animation: 'slideUp 0.25s ease',
    }}>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>{factor.nameCN}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {factor.name} · {factor.catCN}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 24, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'IC', value: `${factor.ic > 0 ? '+' : ''}${factor.ic.toFixed(3)}`, color: icColor },
            { label: '信号', value: factor.signal, color: factor.signal === 'LONG' ? '#22c55e' : '#ef4444' },
            { label: '分类', value: factor.catCN, color: '#3b82f6' },
            { label: '6月趋势', value: factor.trend[factor.trend.length-1] > 0 ? '↑上升' : '↓下降', color: factor.trend[factor.trend.length-1] > 0 ? '#22c55e' : '#ef4444' },
          ].map((r, i) => (
            <div key={i} style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#111827',
              border: '1px solid #1e293b',
            }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{r.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.color, marginTop: 4 }}>{r.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, background: '#111827', border: '1px solid #1e293b' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>6月IC趋势</div>
          <MiniSparkline data={factor.trend} color={icColor} width={340} height={60} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: 10,
            background: '#1e293b', color: '#e2e8f0', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>返回</button>
          <button style={{
            flex: 1, padding: '12px', borderRadius: 10,
            background: '#3b82f6', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}>订阅此因子</button>
        </div>
      </div>
    </div>
  );
}

function PocketDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>总因子覆盖</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6' }}>620+</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>15大类 · 17市场</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: '今日最强', value: 'MOM_1M', ic: '+0.044', color: '#22c55e' },
          { label: '最弱因子', value: 'PCR', ic: '-0.031', color: '#ef4444' },
          { label: '平均IC', value: '+0.021', ic: '', color: '#f59e0b' },
          { label: '活跃信号', value: '12', ic: '', color: '#3b82f6' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '12px',
            borderRadius: 10,
            background: '#111827',
            border: '1px solid #1e293b',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            {s.ic && <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.ic}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function PocketFactorList({
  factors, selectedId, setSelectedId, searchText, setSearchText,
}: {
  factors: FactorMob[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  searchText: string;
  setSearchText: (s: string) => void;
}) {
  const filtered = useMemo(() => {
    if (!searchText) return factors;
    const q = searchText.toLowerCase();
    return factors.filter(f => f.nameCN.includes(q) || f.name.toLowerCase().includes(q) || f.catCN.includes(q));
  }, [factors, searchText]);

  if (selectedId) {
    const f = factors.find(x => x.id === selectedId)!;
    return <FactorFullCard factor={f} onClose={() => setSelectedId(null)} />;
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 12,
        background: '#111827',
        border: '1px solid #1e293b',
        marginBottom: 12,
      }}>
        <Search size={15} style={{ color: '#64748b', flexShrink: 0 }} />
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="搜索因子…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: '#e2e8f0',
          }}
        />
      </div>

      {filtered.map((f, i) => (
        <FactorCompactCard
          key={f.id}
          factor={f}
          index={i + 1}
          isSwiped={false}
          onTap={() => setSelectedId(f.id)}
        />
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}>
          无匹配结果
        </div>
      )}
    </div>
  );
}

function PocketPK() {
  const [left, setLeft] = useState(MOB_FACTORS[0]);
  const [right, setRight] = useState(MOB_FACTORS[1]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>⚔️ 因子PK</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { f: left, side: 'A' },
          { f: right, side: 'B' },
        ].map(({ f, side }) => {
          const icColor = f.ic > 0 ? '#22c55e' : '#ef4444';
          return (
            <div key={side} style={{
              padding: 14, borderRadius: 12,
              background: '#111827', border: '1px solid #1e293b',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>因子 {side}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{f.nameCN}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{f.catCN}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: icColor, marginTop: 8 }}>
                {f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}
              </div>
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>IC</div>
              <select
                onChange={(e) => {
                  const found = MOB_FACTORS.find(x => x.id === e.target.value);
                  if (!found) return;
                  if (side === 'A') setLeft(found); else setRight(found);
                }}
                value={f.id}
                style={{
                  marginTop: 10, width: '100%', padding: '4px 8px', borderRadius: 6,
                  border: '1px solid #1e293b', background: '#0a0e1a', color: '#e2e8f0', fontSize: 11,
                  cursor: 'pointer', outline: 'none',
                }}
              >
                {MOB_FACTORS.map(x => (
                  <option key={x.id} value={x.id}>{x.nameCN}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div style={{
        padding: 14, borderRadius: 12, background: '#111827',
        border: '1px solid #1e293b', textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>胜者</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: left.ic > right.ic ? '#22c55e' : '#ef4444' }}>
          {left.ic > right.ic ? `因子A ${left.nameCN} 胜出` : `因子B ${right.nameCN} 胜出`}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          IC差距 {(Math.abs(left.ic - right.ic)).toFixed(3)}
        </div>
      </div>
    </div>
  );
}

function PocketDiscover() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[
        { title: '🔥 今日热门', items: MOB_FACTORS.slice(0, 3) },
        { title: '⭐ 最高星级', items: MOB_FACTORS.slice(3, 6) },
        { title: '🆕 最近上线', items: MOB_FACTORS.slice(6, 9) },
      ].map((section, si) => (
        <div key={si}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 10 }}>{section.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {section.items.map((f, fi) => (
              <div key={fi} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: '#111827', border: '1px solid #1e293b',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>{f.nameCN}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{f.catCN}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: f.ic > 0 ? '#22c55e' : '#ef4444',
                }}>{f.ic > 0 ? '+' : ''}{f.ic.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Mobile Container ─────────────────────────────────────────

export default function FactorMobileAdapter() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('home');
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [dark, setDark] = useState(true);

  // Swipe between tabs
  const tabOrder = ['home', 'factors', 'pk', 'discover', 'me'];
  const swipeNext = useCallback(() => {
    const idx = tabOrder.indexOf(tab);
    if (idx < tabOrder.length - 1) setTab(tabOrder[idx + 1]);
  }, [tab]);
  const swipePrev = useCallback(() => {
    const idx = tabOrder.indexOf(tab);
    if (idx > 0) setTab(tabOrder[idx - 1]);
  }, [tab]);
  const { onTouchStart, onTouchEnd } = useSwipe(swipeNext, swipePrev);

  // Desktop: show "view in mobile" message
  if (!isMobile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0e1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: '#e2e8f0',
      }}>
        <div style={{ fontSize: 48 }}>📱</div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>移动端因子面板</div>
        <div style={{ fontSize: 13, color: '#64748b', maxWidth: 320, textAlign: 'center' }}>
          此组件专为手机和平板优化设计。请缩小浏览器窗口至 768px 以下即可预览移动端布局。
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          当前宽度: {typeof window !== 'undefined' ? window.innerWidth : 0}px
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        minHeight: '100vh',
        background: dark ? '#0a0e1a' : '#f8fafc',
        color: dark ? '#e2e8f0' : '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 480,
        margin: '0 auto',
        transition: 'background 0.3s, color 0.3s',
        touchAction: 'pan-y',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: dark ? '#0a0e1a' : '#f8fafc',
        borderBottom: `1px solid ${dark ? '#1e293b' : '#e2e8f0'}`,
        position: 'sticky', top: 0, zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6' }}>🐄 QM</span>
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 600 }}>v4</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setDark(!dark)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 8,
              color: dark ? '#f59e0b' : '#64748b',
            }}
          >
            {dark ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {tab === 'home' && <PocketDashboard />}
        {tab === 'factors' && (
          <PocketFactorList
            factors={MOB_FACTORS}
            selectedId={selectedFactorId}
            setSelectedId={setSelectedFactorId}
            searchText={searchText}
            setSearchText={setSearchText}
          />
        )}
        {tab === 'pk' && <PocketPK />}
        {tab === 'discover' && <PocketDiscover />}
        {tab === 'me' && (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            <User size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>我的因子</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>已订阅 8 个因子</div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 8px 12px',
        borderTop: `1px solid ${dark ? '#1e293b' : '#e2e8f0'}`,
        background: dark ? '#111827' : '#ffffff',
        position: 'sticky',
        bottom: 0,
        zIndex: 100,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === t.id ? '#3b82f6' : '#64748b',
              padding: '4px 12px',
              transition: 'color 0.15s',
            }}
          >
            {t.icon}
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Slide-up animation style */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
