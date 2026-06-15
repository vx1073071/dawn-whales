// ── R198 ML P14-01: CommodityOnboarding — 大宗商品3步入门向导 ──────────
// Step 1: Pick commodities (🥇Precious / 🛢️Energy / 🔩Metals / 🌾Agri)
// Step 2: See core factors explained in plain language
// Step 3: Learn to read signals (what does 🟢 mean for Roll Yield?)
// Animated stepper with commodity visuals. Skip/save to localStorage.

import React, { useState } from 'react';
import { Button, Steps, Card, Tag, Tooltip } from 'antd';

// ── Types ───────────────────────────────────────────────────────────
type CommodityCategory = 'precious' | 'energy' | 'metals' | 'agri';

interface CommodityProfile {
  code: string;
  name: string;
  nameCN: string;
  emoji: string;
  category: CommodityCategory;
  description: string;
  keyFactors: string[];
}

interface CommodityOnboardingProps {
  onComplete?: (selections: { categories: CommodityCategory[]; commodities: string[] }) => void;
  onSkip?: () => void;
}

// ── Data ─────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS: { id: CommodityCategory; emoji: string; name: string; nameCN: string; desc: string }[] = [
  { id: 'precious', emoji: '🥇', name: 'Precious Metals', nameCN: '贵金属', desc: 'Gold, Silver, Platinum. Safe haven + inflation hedge.' },
  { id: 'energy', emoji: '🛢️', name: 'Energy', nameCN: '能源', desc: 'Crude, Natural Gas, RBOB. Geopolitical + weather driven.' },
  { id: 'metals', emoji: '🔩', name: 'Industrial Metals', nameCN: '工业金属', desc: 'Copper, Aluminum, Zinc. Economic cycle barometer.' },
  { id: 'agri', emoji: '🌾', name: 'Agriculture', nameCN: '农产品', desc: 'Corn, Soybeans, Wheat. Weather + planting cycles.' },
];

const COMMODITIES: CommodityProfile[] = [
  { code: 'GC', name: 'Gold', nameCN: '黄金', emoji: '🥇', category: 'precious', description: 'Central bank buying + safe haven demand.', keyFactors: ['CMD_MOMENTUM_12M', 'CMD_GOLD_ETF', 'CMD_GOLD_SUMMER'] },
  { code: 'SI', name: 'Silver', nameCN: '白银', emoji: '🥈', category: 'precious', description: 'Industrial + monetary dual demand.', keyFactors: ['CMD_MOMENTUM_12M', 'CMD_VOLATILITY', 'CMD_BALANCE_SHEET'] },
  { code: 'CL', name: 'Crude Oil', nameCN: '原油', emoji: '🛢️', category: 'energy', description: 'Geopolitics + OPEC + demand cycles.', keyFactors: ['CMD_ROLL_YIELD', 'CMD_EIA_CRUDE', 'CMD_SEASONALITY'] },
  { code: 'NG', name: 'Natural Gas', nameCN: '天然气', emoji: '🔥', category: 'energy', description: 'Weather-driven. Storage is key.', keyFactors: ['CMD_NATGAS_STORAGE', 'CMD_SEASONALITY', 'CMD_BASIS'] },
  { code: 'HG', name: 'Copper', nameCN: '铜', emoji: '🔩', category: 'metals', description: 'Dr. Copper = economic health indicator.', keyFactors: ['CMD_LME_INVENTORY', 'CMD_MOMENTUM_12M', 'CMD_BALANCE_SHEET'] },
  { code: 'AL', name: 'Aluminum', nameCN: '铝', emoji: '🪶', category: 'metals', description: 'Energy-intensive smelting. Power costs matter.', keyFactors: ['CMD_LME_INVENTORY', 'CMD_ROLL_YIELD', 'CMD_MOMENTUM_12M'] },
  { code: 'ZC', name: 'Corn', nameCN: '玉米', emoji: '🌽', category: 'agri', description: 'Planting progress + ethanol demand.', keyFactors: ['CMD_SEASONALITY', 'CMD_BASIS', 'CMD_MOMENTUM_12M'] },
  { code: 'ZS', name: 'Soybeans', nameCN: '大豆', emoji: '🫘', category: 'agri', description: 'China import demand + Brazil harvest.', keyFactors: ['CMD_ROLL_YIELD', 'CMD_SEASONALITY', 'CMD_BALANCE_SHEET'] },
];

// ── Factor Plain-Language Translations ──────────────────────────────
const FACTOR_PLAIN_LANG: Record<string, { short: string; bullish: string; bearish: string; icon: string }> = {
  CMD_ROLL_YIELD: { short: '换月成本 — 近月比远月便宜还是贵', bullish: '近月便宜→做多更划算→资金会流进来', bearish: '近月贵→做多不划算→空头有利', icon: '🔄' },
  CMD_TERM_STRUCTURE: { short: '期限斜率 — 远期曲线是上翘还是下趴', bullish: '曲线下趴(Backwardation)→现货紧缺→看涨', bearish: '曲线上翘(Contango)→远期供应充足→看跌', icon: '📈' },
  CMD_BASIS: { short: '基差 — 现货贵还是期货贵', bullish: '现货贵(现货溢价)→现货需求旺→做多', bearish: '期货贵(期货溢价)→远期没人接→做空', icon: '⚖️' },
  CMD_MOMENTUM_12M: { short: '12月动量 — 过去一年谁涨最多', bullish: '涨得多→趋势延续→继续持有', bearish: '跌得多→趋势延续→继续做空', icon: '🚀' },
  CMD_MOMENTUM_1M: { short: '1月反转 — 最近一个月谁跌/涨过度了', bullish: '最近跌太多→反弹概率高→做多', bearish: '最近涨太多→回调压力大→做空', icon: '🔄' },
  CMD_VOLATILITY: { short: '波动率 — 价格近期跳得厉不厉害', bullish: '波动率从高位回落→趋势稳定→跟随', bearish: '波动率突然飙升→不确定性大→减仓', icon: '📊' },
  CMD_SKEWNESS: { short: '偏度 — 极端涨跌有没有过头', bullish: '极端下跌→市场恐慌过度→抄底', bearish: '极端上涨→狂热过头→警惕反转', icon: '🔮' },
  CMD_EIA_CRUDE: { short: 'EIA原油库存 — 美国库存多了还是少了', bullish: '库存降得比预期多→需求好→做多', bearish: '库存增得比预期多→供应过剩→做空', icon: '🛢️' },
  CMD_NATGAS_STORAGE: { short: '天然气储气 — 冬天够不够用', bullish: '储气量低于5年均值→冬天可能短缺→做多', bearish: '储气量高于5年均值→供应充裕→做空', icon: '🔥' },
  CMD_LME_INVENTORY: { short: 'LME铜库存 — 伦敦仓库里铜多不多', bullish: '注销仓单占比>40%→马上要出库→短缺信号', bearish: '注册仓单堆积→供应过剩→铜价承压', icon: '🏭' },
  CMD_GOLD_ETF: { short: '黄金ETF持仓 — 大佬们买了多少黄金', bullish: 'ETF持续增持→机构看多→黄金涨', bearish: 'ETF持续减持→资金流出→黄金跌', icon: '🥇' },
  CMD_BALANCE_SHEET: { short: '供需平衡表 — 全球是缺还是过剩', bullish: '赤字(缺口)→供不应求→价格涨', bearish: '盈余(过剩)→供过于求→价格跌', icon: '⚖️' },
  CMD_SEASONALITY: { short: '季节性 — 这个月历史上表现怎么样', bullish: '当前处于旺季→历史胜率>60%→做多', bearish: '当前处于淡季→历史跌多涨少→谨慎', icon: '📅' },
  CMD_GOLD_SUMMER: { short: '黄金夏季效应 — 6-8月是黄金旺季吗', bullish: '过去10年夏季黄金平均+3.2%→做多', bearish: '夏季旺季没出现→需要重新评估', icon: '☀️' },
};

// ── Component ────────────────────────────────────────────────────────
const CommodityOnboarding: React.FC<CommodityOnboardingProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<CommodityCategory[]>([]);
  const [animating, setAnimating] = useState(false);

  const toggleCategory = (id: CommodityCategory) => {
    setCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  // toggleCommodity reserved for future individual commodity selection

  const nextStep = () => { setAnimating(true); setTimeout(() => { setStep((s) => s + 1); setAnimating(false); }, 300); };
  const prevStep = () => { setAnimating(true); setTimeout(() => { setStep((s) => s - 1); setAnimating(false); }, 300); };
  const finish = () => {
    localStorage.setItem('commodity-onboarding-done', 'true');
    onComplete?.({ categories, commodities: [] });
  };

  const filteredCommodities = categories.length > 0
    ? COMMODITIES.filter((c) => categories.includes(c.category))
    : COMMODITIES;

  return (
    <div style={styles.container}>
      <Card style={styles.card} bodyStyle={{ padding: 0 }}>
        {/* Progress */}
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${((step + 1) / 3) * 100}%` }} />
        </div>
        <div style={styles.stepsRow}>
          <Steps current={step} size="small" items={[{ title: 'Pick' }, { title: 'Factors' }, { title: 'Signals' }]} />
        </div>

        <div style={{ ...styles.content, opacity: animating ? 0 : 1, transform: animating ? 'translateX(16px)' : 'none', transition: 'opacity 0.25s, transform 0.25s' }}>
          {/* Step 0: Pick Commodities */}
          {step === 0 && (
            <div>
              <h3 style={styles.stepTitle}>🛢️ Pick Your Commodities</h3>
              <p style={styles.stepDesc}>Which commodity markets do you trade or want to track?</p>
              <div style={styles.catGrid}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const sel = categories.includes(cat.id);
                  return (
                    <Card key={cat.id} size="small" style={{ ...styles.catCard, borderColor: sel ? '#d4a853' : '#2a2a4a', background: sel ? '#1e1e3a' : '#0f0f1e' }}
                      onClick={() => toggleCategory(cat.id)}>
                      <div style={styles.catEmoji}>{cat.emoji}</div>
                      <div style={styles.catName}>{cat.name}</div>
                      <div style={styles.catCN}>{cat.nameCN}</div>
                      <div style={styles.catDesc}>{cat.desc}</div>
                      {sel && <span style={styles.check}>✓</span>}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Key Factors */}
          {step === 1 && (
            <div>
              <h3 style={styles.stepTitle}>🔍 Core Factors — Explained in Plain Chinese</h3>
              <p style={styles.stepDesc}>Here are the factors we track for your selected commodities</p>
              <div style={styles.commodityList}>
                {filteredCommodities.map((com) => (
                  <Card key={com.code} size="small" style={styles.comCard}>
                    <div style={styles.comHeader}>
                      <span style={styles.comEmoji}>{com.emoji}</span>
                      <div>
                        <span style={styles.comName}>{com.name}</span>
                        <span style={styles.comCN}> · {com.nameCN}</span>
                      </div>
                      <Tag color="blue" style={{ marginLeft: 'auto' }}>{com.category}</Tag>
                    </div>
                    <div style={styles.factorChips}>
                      {com.keyFactors.map((fid) => {
                        const pl = FACTOR_PLAIN_LANG[fid];
                        if (!pl) return null;
                        return (
                          <Tooltip key={fid} title={<div style={{ fontSize: 12 }}><div>{pl.bullish}</div><div style={{ color: '#f46d43' }}>{pl.bearish}</div></div>}>
                            <Tag style={styles.factorChip}>
                              {pl.icon} {pl.short.substring(0, 18)}...
                            </Tag>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: How to Read Signals */}
          {step === 2 && (
            <div>
              <h3 style={styles.stepTitle}>💡 How to Read Commodity Signals</h3>
              <p style={styles.stepDesc}>Same traffic-light system, commodity-specific meaning</p>
              <div style={styles.signalCards}>
                {[
                  { color: '#66bd63', dot: '🟢', title: 'Green = Bullish (看多)', examples: ['Roll Yield positive = 近月贴水→做多有利', 'EIA draw > expected = 库存降得比预期多', 'Seasonality peak = 旺季来了→胜率高'] },
                  { color: '#d4a853', dot: '🟡', title: 'Yellow = Neutral (震荡/观望)', examples: ['Basis near zero = 期现价格差不多', 'Momentum flat = 价格横盘没有方向', 'Inventory at 5yr avg = 库存不紧不松'] },
                  { color: '#f46d43', dot: '🔴', title: 'Red = Bearish (看空)', examples: ['Roll Yield negative = 近月升水→展期亏钱', 'EIA build > expected = 库存增得比预期多', 'Seasonality trough = 淡季来了→谨慎'] },
                ].map((sig) => (
                  <div key={sig.title} style={{ ...styles.signalCard, borderLeft: `4px solid ${sig.color}` }}>
                    <div style={styles.signalTitle}>{sig.dot} {sig.title}</div>
                    <ul style={styles.signalList}>
                      {sig.examples.map((ex, i) => <li key={i} style={styles.signalItem}>{ex}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
              <div style={styles.tipBox}>
                <span>💡</span>
                <span>Pro tip: 商品因子比股票因子更依赖<b>确认信号</b>。单一因子信号不够,至少2个同方向才行动。</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          {step > 0 ? <Button onClick={prevStep} style={{ color: '#888', border: '1px solid #3a3a5a', background: 'transparent' }}>← Back</Button>
            : <Button onClick={onSkip} style={{ color: '#888', border: 'none', background: 'transparent' }}>Skip for now</Button>}
          <div style={{ flex: 1 }} />
          {step < 2 ? (
            <Button type="primary" onClick={nextStep} style={{ background: 'linear-gradient(135deg, #d4a853, #b8942e)', border: 'none', color: '#1a1a2e', fontWeight: 700 }}
              disabled={step === 0 && categories.length === 0}>Continue →</Button>
          ) : (
            <Button type="primary" onClick={finish} style={{ background: 'linear-gradient(135deg, #1a9850, #66bd63)', border: 'none', color: '#fff', fontWeight: 700 }}>
              🎉 Start Trading Commodities
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', justifyContent: 'center', minHeight: 450, padding: 16, fontFamily: "'Inter', -apple-system, sans-serif" },
  card: { width: '100%', maxWidth: 680, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 14, overflow: 'hidden' },
  progressBar: { height: 3, background: '#2a2a4a' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #d4a853, #b8942e)', transition: 'width 0.4s' },
  stepsRow: { padding: '16px 20px 0' },
  content: { padding: '20px', minHeight: 300 },
  stepTitle: { fontSize: 17, fontWeight: 700, color: '#e0e0e0', margin: 0 },
  stepDesc: { fontSize: 12, color: '#888', margin: '4px 0 14px' },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  catCard: { cursor: 'pointer', textAlign: 'center', position: 'relative', transition: 'all 0.2s' },
  catEmoji: { fontSize: 28, marginBottom: 4 },
  catName: { fontSize: 13, fontWeight: 700, color: '#e0e0e0' },
  catCN: { fontSize: 11, color: '#888' },
  catDesc: { fontSize: 10, color: '#aaa', marginTop: 4, lineHeight: 1.4 },
  check: { position: 'absolute', top: 6, right: 8, width: 20, height: 20, borderRadius: '50%', background: '#d4a853', color: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 },
  commodityList: { display: 'flex', flexDirection: 'column', gap: 8 },
  comCard: { background: '#0f0f1e', border: '1px solid #2a2a4a' },
  comHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  comEmoji: { fontSize: 20 },
  comName: { fontSize: 13, fontWeight: 700, color: '#e0e0e0' },
  comCN: { fontSize: 11, color: '#888' },
  factorChips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  factorChip: { fontSize: 10, padding: '0 6px', cursor: 'help' },
  signalCards: { display: 'flex', flexDirection: 'column', gap: 10 },
  signalCard: { padding: '10px 14px', background: '#0f0f1e', borderRadius: 8 },
  signalTitle: { fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 4 },
  signalList: { margin: 0, paddingLeft: 16 },
  signalItem: { fontSize: 11, color: '#aaa', lineHeight: 1.7 },
  tipBox: { marginTop: 12, padding: '8px 12px', background: 'rgba(212,168,83,0.1)', borderRadius: 6, display: 'flex', gap: 8, fontSize: 11, color: '#d4a853' },
  footer: { display: 'flex', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #2a2a4a', gap: 10 },
};

export { CommodityOnboarding, FACTOR_PLAIN_LANG, COMMODITIES, CATEGORY_OPTIONS };
export type { CommodityOnboardingProps, CommodityCategory, CommodityProfile };
