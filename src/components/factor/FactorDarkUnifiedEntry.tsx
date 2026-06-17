// @ts-nocheck
// R280 ML#1: Dark Theme + Unified Factor Entry Hub
// Global dark/light toggle applied to all factor pages + single unified navigation portal for all 620+ factors
// 全量暗色主题切换 + 统一因子入口 (6h)

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Globe, Search, Layers, BarChart3, TrendingUp, Star, Filter, ChevronRight, Zap, Shield, Compass } from 'lucide-react';

// ─── Theme Engine ──────────────────────────────────────────────────
type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeConfig {
  mode: ThemeMode;
  colors: {
    bg: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSecondary: string;
    accent: string;
    accentBg: string;
    error: string;
    success: string;
    warning: string;
  };
}

const DARK_THEME: ThemeConfig = {
  mode: 'dark',
  colors: {
    bg: '#0a0e1a',
    surface: '#111827',
    surfaceHover: '#1a2236',
    border: '#1e293b',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.12)',
    error: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
  },
};

const LIGHT_THEME: ThemeConfig = {
  mode: 'light',
  colors: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceHover: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#64748b',
    accent: '#2563eb',
    accentBg: 'rgba(37,99,235,0.08)',
    error: '#dc2626',
    success: '#16a34a',
    warning: '#d97706',
  },
};

function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

function resolveTheme(mode: ThemeMode): ThemeConfig {
  if (mode === 'system') return getSystemTheme() === 'dark' ? DARK_THEME : LIGHT_THEME;
  return mode === 'light' ? LIGHT_THEME : DARK_THEME;
}

// ─── Mock: 620+ factor catalog ─────────────────────────────────────
interface FactorEntry {
  id: string;
  name: string;
  nameCN: string;
  category: string;
  categoryCN: string;
  market: string;
  marketCN: string;
  ic: number;
  stars: number;
  isNew: boolean;
  isHot: boolean;
  tags: string[];
}

const ALL_FACTORS: FactorEntry[] = (() => {
  const markets = [
    { id: 'US', cn: '美股', emoji: '🇺🇸' },
    { id: 'HK', cn: '港股', emoji: '🇭🇰' },
    { id: 'CN', cn: 'A股', emoji: '🇨🇳' },
    { id: 'JP', cn: '日本', emoji: '🇯🇵' },
    { id: 'IN', cn: '印度', emoji: '🇮🇳' },
    { id: 'KR', cn: '韩国', emoji: '🇰🇷' },
    { id: 'TW', cn: '台湾', emoji: '🇹🇼' },
    { id: 'EU', cn: '欧洲', emoji: '🇪🇺' },
    { id: 'BR', cn: '巴西', emoji: '🇧🇷' },
    { id: 'SA', cn: '沙特', emoji: '🇸🇦' },
    { id: 'SG', cn: '新加坡', emoji: '🇸🇬' },
    { id: 'AU', cn: '澳洲', emoji: '🇦🇺' },
    { id: 'GB', cn: '英国', emoji: '🇬🇧' },
    { id: 'VN', cn: '越南', emoji: '🇻🇳' },
    { id: 'ID', cn: '印尼', emoji: '🇮🇩' },
    { id: 'MY', cn: '马来西亚', emoji: '🇲🇾' },
    { id: 'GLOBAL', cn: '全球', emoji: '🌐' },
  ];

  const categories = [
    { id: 'VALUE', cn: '价值' },
    { id: 'GROWTH', cn: '成长' },
    { id: 'MOMENTUM', cn: '动量' },
    { id: 'QUALITY', cn: '质量' },
    { id: 'SIZE', cn: '规模' },
    { id: 'VOLATILITY', cn: '波动' },
    { id: 'LIQUIDITY', cn: '流动性' },
    { id: 'FLOW', cn: '资金流' },
    { id: 'MACRO', cn: '宏观' },
    { id: 'SENTIMENT', cn: '情绪' },
    { id: 'ESG', cn: 'ESG' },
    { id: 'OPTIONS', cn: '期权' },
    { id: 'FI', cn: '固收' },
    { id: 'ALT', cn: '另类' },
    { id: 'ACADEMIC', cn: '学术' },
  ];

  const factorNames: Record<string, string[]> = {
    'VALUE': ['PE_TTM', 'PB_LF', 'Dividend_Yield', 'EV_EBITDA', 'PS_TTM', 'FCF_Yield', 'Earnings_Yield'],
    'GROWTH': ['Revenue_YoY', 'Earnings_YoY', 'ROE_TTM', 'EPS_5Y_CAGR', 'FCF_Growth'],
    'MOMENTUM': ['MOM_1M', 'MOM_3M', 'MOM_6M', 'MOM_12M', 'RSI_14'],
    'QUALITY': ['ROIC', 'Gross_Margin', 'Net_Margin', 'Asset_Turnover', 'Debt_Equity', 'F_Score'],
    'SIZE': ['Market_Cap', 'Float_Cap', 'Revenue_Rank', 'Employee_Count'],
    'VOLATILITY': ['Vol_20D', 'Beta_60D', 'Idio_Vol', 'Max_Drawdown', 'VaR_95'],
    'LIQUIDITY': ['Turnover_Rate', 'Amihud', 'Bid_Ask_Spread', 'Depth', 'Amplitude_5D'],
    'FLOW': ['Foreign_Flow', 'Institution_Flow', 'Major_Flow', 'Insider_Trade', 'Northbound'],
    'MACRO': ['GDP_Beta', 'CPI_Beta', 'PMI_Sensitivity', 'Rate_Sensitivity', 'VIX_Correlation'],
    'SENTIMENT': ['Short_Interest', 'Analyst_Revision', 'Dragon_Tiger', 'Put_Call_Ratio', 'News_Sentiment'],
    'ESG': ['MSCI_ESG', 'Carbon_Intensity', 'Board_Diversity', 'Controversy', 'Green_Revenue'],
    'OPTIONS': ['IV_Rank', 'IV_Percentile', 'Skew', 'PCR', 'GEX', 'Max_Pain'],
    'FI': ['Yield_Curve', 'Credit_Spread', 'Duration', 'OAS', 'Breakeven'],
    'ALT': ['CV_Foot_Traffic', 'Satellite_Parking', 'Credit_Card_Spend', 'Web_Traffic', 'NY_Wind_Direction', 'Port_Wait_Time'],
    'ACADEMIC': ['Fama_French_HML', 'French_CMA', 'Pastor_Stambaugh', 'Kelly_Alpha', 'Novy_Marx_GP', 'Ball_Brown_PEAD', 'Jegadeesh_MOM'],
  };

  const result: FactorEntry[] = [];
  let id = 600;
  for (const m of markets) {
    for (const c of categories) {
      const names = factorNames[c.id] || [];
      for (let i = 0; i < Math.min(names.length, 2 + Math.floor(Math.random() * 3)); i++) {
        id++;
        result.push({
          id: `${m.id}_${c.id}_${names[i] || `F${i + 1}`}_${id}`,
          name: `${c.id} ${names[i] || `Factor ${i + 1}`}`,
          nameCN: `${c.cn}·${names[i] || `因子${i + 1}`}`,
          category: c.id,
          categoryCN: c.cn,
          market: m.id,
          marketCN: `${m.emoji} ${m.cn}`,
          ic: +(Math.random() * 0.08 - 0.01).toFixed(3),
          stars: Math.floor(Math.random() * 5) + 1,
          isNew: Math.random() < 0.15,
          isHot: Math.random() < 0.08,
          tags: [],
        });
      }
    }
  }
  return result;
})();

// ─── Sub components ────────────────────────────────────────────────

function ThemeToggle({ theme, setTheme, config }: { theme: ThemeMode; setTheme: (t: ThemeMode) => void; config: ThemeConfig }) {
  const modes: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun size={14} />, label: 'Light' },
    { value: 'system', icon: <Globe size={14} />, label: 'System' },
    { value: 'dark', icon: <Moon size={14} />, label: 'Dark' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: config.colors.surfaceHover,
        borderRadius: 8,
        padding: 3,
      }}
    >
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setTheme(m.value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: theme === m.value ? 600 : 400,
            background: theme === m.value ? config.colors.accent : 'transparent',
            color: theme === m.value ? '#fff' : config.colors.textSecondary,
            transition: 'all 0.2s',
          }}
        >
          {m.icon}
          <span style={{ display: 'none' }}>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

function CategoryNav({ config, selected, onSelect, counts }: { config: ThemeConfig; selected: string; onSelect: (c: string) => void; counts: Record<string, number> }) {
  const categories = [
    { id: 'ALL', cn: '全部', icon: <Layers size={14} /> },
    { id: 'VALUE', cn: '价值', icon: <BarChart3 size={14} /> },
    { id: 'GROWTH', cn: '成长', icon: <TrendingUp size={14} /> },
    { id: 'MOMENTUM', cn: '动量', icon: <Zap size={14} /> },
    { id: 'QUALITY', cn: '质量', icon: <Star size={14} /> },
    { id: 'ESG', cn: 'ESG', icon: <Shield size={14} /> },
    { id: 'ACADEMIC', cn: '学术', icon: <Compass size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 14px',
            borderRadius: 20,
            border: selected === c.id ? `1.5px solid ${config.colors.accent}` : `1px solid ${config.colors.border}`,
            background: selected === c.id ? config.colors.accentBg : 'transparent',
            color: selected === c.id ? config.colors.accent : config.colors.textSecondary,
            fontSize: 13,
            fontWeight: selected === c.id ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {c.icon}
          {c.cn}
          <span style={{ fontSize: 11, opacity: 0.6 }}>{counts[c.id] || ''}</span>
        </button>
      ))}
    </div>
  );
}

function FactorQuickCard({ factor, config, onClick }: { factor: FactorEntry; config: ThemeConfig; onClick: () => void }) {
  const icColor = factor.ic > 0 ? config.colors.success : factor.ic < -0.01 ? config.colors.error : config.colors.warning;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${config.colors.border}`,
        background: config.colors.surface,
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = config.colors.surfaceHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = config.colors.surface; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: config.colors.text }}>{factor.nameCN}</span>
          <span style={{ fontSize: 10, color: config.colors.textSecondary }}>{factor.marketCN}</span>
          {factor.isHot && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: config.colors.error + '20', color: config.colors.error }}>HOT</span>}
          {factor.isNew && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: config.colors.accent + '20', color: config.colors.accent }}>NEW</span>}
        </div>
        <span style={{ fontSize: 11, color: config.colors.textSecondary }}>{factor.categoryCN}</span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: icColor }}>
          {factor.ic > 0 ? '+' : ''}{factor.ic.toFixed(3)}
        </span>
        <div style={{ fontSize: 10, color: config.colors.textSecondary }}>IC</div>
      </div>
      <div style={{ color: config.colors.textSecondary }}>
        <ChevronRight size={14} />
      </div>
    </div>
  );
}

function StatsBar({ config, totalFactors, totalMarkets, totalCats }: { config: ThemeConfig; totalFactors: number; totalMarkets: number; totalCats: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 10,
    }}>
      {[
        { label: '总因子数', value: `620+`, sub: `${totalFactors} active` },
        { label: '覆盖市场', value: `17`, sub: `${totalMarkets} markets` },
        { label: '因子分类', value: `15`, sub: `${totalCats} categories` },
        { label: '平均IC', value: `+0.021`, sub: 'IC >= 2.0 → 68%' },
      ].map((s, i) => (
        <div key={i} style={{
          padding: '14px 16px',
          borderRadius: 10,
          border: `1px solid ${config.colors.border}`,
          background: config.colors.surface,
        }}>
          <div style={{ fontSize: 11, color: config.colors.textSecondary, marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: config.colors.accent, marginBottom: 2 }}>{s.value}</div>
          <div style={{ fontSize: 11, color: config.colors.textSecondary }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

const STORAGE_KEY = 'dawn-factor-theme';

export default function FactorDarkUnifiedEntry() {
  const { t } = useTranslation();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'dark'; } catch { return 'dark'; }
  });
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [market, setMarket] = useState<string>('ALL');
  const [selectedFactor, setSelectedFactor] = useState<FactorEntry | null>(null);

  const config = useMemo(() => resolveTheme(theme), [theme]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  // Apply theme to document
  useEffect(() => {
    const resolved = resolveTheme(theme);
    const root = document.documentElement;
    root.style.setProperty('--factor-bg', resolved.colors.bg);
    root.style.setProperty('--factor-surface', resolved.colors.surface);
    root.style.setProperty('--factor-border', resolved.colors.border);
    root.style.setProperty('--factor-text', resolved.colors.text);
    root.style.setProperty('--factor-accent', resolved.colors.accent);
    root.setAttribute('data-factor-theme', resolved.mode);
    root.setAttribute('data-theme', resolved.mode);
    // global class toggle
    if (resolved.mode === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  }, [theme]);

  const markets = useMemo(() => {
    const set = new Set(ALL_FACTORS.map(f => f.market));
    return ['ALL', ...Array.from(set).sort()];
  }, []);

  const filtered = useMemo(() => {
    return ALL_FACTORS.filter(f => {
      if (category !== 'ALL' && f.category !== category) return false;
      if (market !== 'ALL' && f.market !== market) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.nameCN.includes(q) || f.id.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => Math.abs(b.ic) - Math.abs(a.ic));
  }, [category, market, search]);

  const counts = useMemo(() => {
    const cts: Record<string, number> = { ALL: ALL_FACTORS.length };
    ALL_FACTORS.forEach(f => {
      cts[f.category] = (cts[f.category] || 0) + 1;
    });
    return cts;
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: config.colors.bg,
        color: config.colors.text,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        transition: 'all 0.3s ease',
      }}
    >
      {/* ── Header ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: config.colors.bg + 'dd',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${config.colors.border}`,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: config.colors.accent }}>
            🐄 QUANT MOO
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 8, background: config.colors.accentBg, color: config.colors.accent }}>
            v4.0.0
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Quick nav links */}
          {['因子总览', '因子PK', '模板市场', '因子社区', '场景包'].map((ln, i) => (
            <a key={i} href="#" style={{ fontSize: 13, color: config.colors.textSecondary, textDecoration: 'none', fontWeight: i === 0 ? 600 : 400, borderBottom: i === 0 ? `2px solid ${config.colors.accent}` : 'none', paddingBottom: 2 }}>{ln}</a>
          ))}
        </div>

        <ThemeToggle theme={theme} setTheme={setTheme} config={config} />
      </div>

      {/* ── Stats ── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px' }}>
        <StatsBar config={config} totalFactors={ALL_FACTORS.length} totalMarkets={markets.length - 1} totalCats={15} />

        {/* ── Search + Filters ── */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 10,
              border: `1px solid ${config.colors.border}`,
              background: config.colors.surface,
              flex: 1,
              minWidth: 240,
            }}>
              <Search size={16} style={{ color: config.colors.textSecondary }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索 620+ 因子… PE / Momentum / ESG / IV Rank"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13,
                  color: config.colors.text,
                }}
              />
            </div>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: `1px solid ${config.colors.border}`,
                background: config.colors.surface,
                color: config.colors.text,
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {markets.map(m => (
                <option key={m} value={m}>
                  {m === 'ALL' ? '🌐 全部市场' : `${ALL_FACTORS.find(f => f.market === m)?.marketCN || m}`}
                </option>
              ))}
            </select>
          </div>

          <CategoryNav config={config} selected={category} onSelect={setCategory} counts={counts} />
        </div>

        {/* ── Results ── */}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: config.colors.textSecondary }}>
            {filtered.length} 个因子
          </span>
          <span style={{ fontSize: 12, color: config.colors.textSecondary }}>
            按 |IC| ↓ 排序
          </span>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.slice(0, 80).map(f => (
            <FactorQuickCard key={f.id} factor={f} config={config} onClick={() => setSelectedFactor(f)} />
          ))}
          {filtered.length > 80 && (
            <div style={{ textAlign: 'center', padding: 20, color: config.colors.textSecondary, fontSize: 13 }}>
              显示前 80 / 共 {filtered.length} — 精简搜索以查看更多
            </div>
          )}
        </div>
      </div>

      {/* ── Detail modal ── */}
      {selectedFactor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedFactor(null); }}
        >
          <div style={{
            background: config.colors.surface,
            borderRadius: 16,
            border: `1px solid ${config.colors.border}`,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            color: config.colors.text,
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedFactor.nameCN}</div>
                <div style={{ fontSize: 12, color: config.colors.textSecondary, marginTop: 2 }}>
                  {selectedFactor.name} · {selectedFactor.marketCN}
                </div>
              </div>
              <button onClick={() => setSelectedFactor(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: config.colors.textSecondary, lineHeight: 1,
              }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'IC', value: (selectedFactor.ic > 0 ? '+' : '') + selectedFactor.ic.toFixed(3), color: selectedFactor.ic > 0 ? config.colors.success : config.colors.error },
                { label: '星标', value: '★'.repeat(selectedFactor.stars) + '☆'.repeat(5 - selectedFactor.stars), color: config.colors.warning },
                { label: '分类', value: selectedFactor.categoryCN, color: config.colors.accent },
                { label: '市场', value: selectedFactor.marketCN, color: config.colors.textSecondary },
              ].map((r, i) => (
                <div key={i} style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: config.colors.surfaceHover,
                }}>
                  <div style={{ fontSize: 11, color: config.colors.textSecondary }}>{r.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: r.color, marginTop: 2 }}>{r.value}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedFactor(null)}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                background: config.colors.accent, color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >
              查看完整因子详情 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
