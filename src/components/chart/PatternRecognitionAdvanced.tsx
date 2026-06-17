import { useState, useMemo } from 'react';

// ── 31 Pattern Recognition Frontend ── ML#2 R269 (6h)
// 31 chart patterns: 20 classic + 5 harmonics + 6 Elliott wave

interface ChartPattern {
  id: string;
  name: string;
  fullName: string;
  type: 'reversal_bull' | 'reversal_bear' | 'continuation_bull' | 'continuation_bear' | 'harmonic' | 'elliott';
  emoji: string;
  reliability: string; // "8/10"
  description: string;
  visualHint: string;
  detectCondition: string;
  isNew?: boolean;
}

const PATTERNS_31: ChartPattern[] = [
  // ── Classic 20 ──
  { id: 'double_bottom', name: '双底(W底)', fullName: 'Double Bottom', type: 'reversal_bull', emoji: 'W', reliability: '8/10', description: '两次探底形成W形，放量突破颈线确认反转', visualHint: '两低点接近，中间反弹形成W', detectCondition: '低点差值<2%，间隔>5K线', },
  { id: 'double_top', name: '双顶(M顶)', fullName: 'Double Top', type: 'reversal_bear', emoji: 'M', reliability: '8/10', description: '两次冲顶形成M形，跌破颈线确认反转', visualHint: '两高点接近，中间回落形成M', detectCondition: '高点差值<2%，间隔>5K线', },
  { id: 'head_shoulders', name: '头肩顶', fullName: 'Head & Shoulders Top', type: 'reversal_bear', emoji: '👤', reliability: '9/10', description: '左肩→头部(最高)→右肩，跌破颈线确认', visualHint: '三峰：中峰最高，两侧较低', detectCondition: '中峰>左右肩，颈线水平', },
  { id: 'inv_head_shoulders', name: '头肩底', fullName: 'Inverse H&S', type: 'reversal_bull', emoji: '👤', reliability: '9/10', description: '左肩→头部(最低)→右肩，突破颈线确认', visualHint: '三谷：中谷最深，两侧较浅', detectCondition: '中谷<左右谷，颈线水平', },
  { id: 'asc_triangle', name: '上升三角', fullName: 'Ascending Triangle', type: 'continuation_bull', emoji: '△', reliability: '7/10', description: '水平上轨+上升下轨，大概率向上突破', visualHint: '上轨平+下轨上斜', detectCondition: '高点接近水平，低点抬高', },
  { id: 'desc_triangle', name: '下降三角', fullName: 'Descending Triangle', type: 'continuation_bear', emoji: '▽', reliability: '7/10', description: '水平下轨+下降上轨，大概率向下突破', visualHint: '下轨平+上轨下斜', detectCondition: '低点接近水平，高点降低', },
  { id: 'sym_triangle', name: '对称三角', fullName: 'Symmetrical Triangle', type: 'continuation_bull', emoji: '▶', reliability: '6/10', description: '收敛三角形，突破方向=原趋势', visualHint: '上下轨向中间收敛', detectCondition: '高低点都在收敛', },
  { id: 'bull_flag', name: '看涨旗形', fullName: 'Bull Flag', type: 'continuation_bull', emoji: '🚩', reliability: '7/10', description: '急速拉升→小回调旗形→继续上攻', visualHint: '旗杆(急涨)+旗面(阴跌倾斜)', detectCondition: '旗杆幅度>5%，旗面价格微跌', },
  { id: 'bear_flag', name: '看跌旗形', fullName: 'Bear Flag', type: 'continuation_bear', emoji: '🏴', reliability: '7/10', description: '急速下跌→小反弹旗形→继续下跌', visualHint: '旗杆(急跌)+旗面(微反弹)', detectCondition: '旗杆幅度>5%，旗面价格微涨', },
  { id: 'bull_pennant', name: '看涨三角旗', fullName: 'Bull Pennant', type: 'continuation_bull', emoji: '▶️', reliability: '7/10', description: '大幅拉升后收敛盘整，突破续涨', visualHint: '大阳线+小三角收敛', detectCondition: '前涨>3%，收敛区间窄<2%', },
  { id: 'bear_pennant', name: '看跌三角旗', fullName: 'Bear Pennant', type: 'continuation_bear', emoji: '◀️', reliability: '7/10', description: '大幅下跌后收敛盘整，突破续跌', visualHint: '大阴线+小三角收敛', detectCondition: '前跌>3%，收敛区间窄<2%', },
  { id: 'cup_handle', name: '杯柄', fullName: 'Cup & Handle', type: 'continuation_bull', emoji: '☕', reliability: '8/10', description: '杯形杯体+小幅回撤手柄，突破=大涨', visualHint: 'U形杯+R形柄', detectCondition: '杯体宽度>20K线，柄回撤<15%', },
  { id: 'wedge_rising', name: '上升楔形', fullName: 'Rising Wedge', type: 'reversal_bear', emoji: '🔺', reliability: '7/10', description: '收敛上升楔形，通常向下突破', visualHint: '两条上升线向中间收敛', detectCondition: '上下轨都上升，距离缩小', },
  { id: 'wedge_falling', name: '下降楔形', fullName: 'Falling Wedge', type: 'reversal_bull', emoji: '🔻', reliability: '7/10', description: '收敛下降楔形，通常向上突破', visualHint: '两条下降线向中间收敛', detectCondition: '上下轨都下降，距离缩小', },
  { id: 'round_bottom', name: '圆弧底', fullName: 'Rounding Bottom', type: 'reversal_bull', emoji: '🔄', reliability: '7/10', description: '圆弧形的底部反转，放量突破确认', visualHint: '缓慢的U型底部', detectCondition: '底部持续时间>15K线', },
  { id: 'island_reversal', name: '岛形反转', fullName: 'Island Reversal', type: 'reversal_bull', emoji: '🏝', reliability: '8/10', description: '跳空跳回形成的孤立K线区域', visualHint: '两个缺口中间的孤立区域', detectCondition: '前后均有跳空缺口', },
  { id: 'morning_star', name: '早晨之星', fullName: 'Morning Star', type: 'reversal_bull', emoji: '🌅', reliability: '6/10', description: '大阴→十字星(跳空)→大阳，底部反转', visualHint: '阴+星+阳三根K线', detectCondition: '第三根阳线收复跌幅', },
  { id: 'evening_star', name: '黄昏之星', fullName: 'Evening Star', type: 'reversal_bear', emoji: '🌇', reliability: '6/10', description: '大阳→十字星(跳空)→大阴，顶部反转', visualHint: '阳+星+阴三根K线', detectCondition: '第三根阴线跌破前阳', },
  { id: 'three_white', name: '红三兵', fullName: 'Three White Soldiers', type: 'continuation_bull', emoji: '🕯🕯🕯', reliability: '6/10', description: '连续三根实体递增的阳线', visualHint: '三阳连续实体递增', detectCondition: '三根阳线，实体递增', },
  { id: 'three_black', name: '三只乌鸦', fullName: 'Three Black Crows', type: 'continuation_bear', emoji: '🦅🦅🦅', reliability: '6/10', description: '连续三根实体递增的阴线', visualHint: '三阴连续实体递增', detectCondition: '三根阴线，实体递增', },

  // ── Harmonics 5 (NEW) ──
  { id: 'gartley', name: 'Gartley 222', fullName: 'Gartley 222 Pattern', type: 'harmonic', emoji: '🦋', reliability: '7/10', description: 'XA 0.618回撤 + AB=CD + BC 0.382-0.886', visualHint: 'M或W形对称回撤', detectCondition: 'XA 0.618/AB=CD/BC 0.382-0.886', isNew: true, },
  { id: 'bat', name: '蝙蝠', fullName: 'Bat Pattern', type: 'harmonic', emoji: '🦇', reliability: '7/10', description: 'XA 0.382-0.5 + BC 0.382-0.886, 0.886位入场', visualHint: '长XA+紧凑AB=CD', detectCondition: 'XA 0.382-0.5/D到0.886', isNew: true, },
  { id: 'crab', name: '螃蟹', fullName: 'Crab Pattern', type: 'harmonic', emoji: '🦀', reliability: '7/10', description: 'XA 0.382-0.618 + BC 0.382-0.886, D到1.618', visualHint: '极端扩展的Fib', detectCondition: 'D=1.618XA', isNew: true, },
  { id: 'butterfly', name: '蝴蝶', fullName: 'Butterfly Pattern', type: 'harmonic', emoji: '🦋', reliability: '6/10', description: 'B点超过X, D点超过X但接近1.272', visualHint: '超过起点的回撤', detectCondition: 'D>X, 约1.272XA', isNew: true, },
  { id: 'shark', name: '鲨鱼', fullName: 'Shark 5-0', type: 'harmonic', emoji: '🦈', reliability: '6/10', description: '5-0结构: B到0.618XA, C到1.13-1.618, D到0.886', visualHint: '5个转折点的快速反转', detectCondition: 'BC>XA, CD回撤0.886', isNew: true, },

  // ── Elliott Wave 6 (NEW) ──
  { id: 'elliott_impulse', name: '推动5浪', fullName: 'Elliott Impulse 5-Wave', type: 'elliott', emoji: '🌊', reliability: '5/10', description: '1-2-3-4-5推动浪结构', visualHint: '5浪上升/下降推动', detectCondition: '浪3最长，浪1/5接近等长', isNew: true, },
  { id: 'elliott_correction', name: 'ABC修正', fullName: 'Elliott ABC Correction', type: 'elliott', emoji: '🔤', reliability: '5/10', description: 'A-B-C三浪修正结构', visualHint: '3浪反方向修正', detectCondition: '反方向3浪结构', isNew: true, },
  { id: 'elliott_flat', name: '平台型ABC', fullName: 'Flat 3-3-5', type: 'elliott', emoji: '⏹', reliability: '5/10', description: '3-3-5平台修正：横向整理', visualHint: 'A=3浪/B=3浪/C=5浪', detectCondition: 'A浪弱势，B回撤深', isNew: true, },
  { id: 'elliott_zigzag', name: '锯齿型ABC', fullName: 'Zigzag 5-3-5', type: 'elliott', emoji: '⚡', reliability: '5/10', description: '5-3-5锯齿修正：快速深度回调', visualHint: 'A=5浪/B=3浪/C=5浪', detectCondition: 'A浪强势，B回撤浅', isNew: true, },
  { id: 'elliott_triangle', name: '三角型', fullName: 'Triangle Correction', type: 'elliott', emoji: '△', reliability: '5/10', description: 'ABCDE收敛三角形修正', visualHint: '5波窄幅收敛', detectCondition: '5波高低点收敛', isNew: true, },
  { id: 'elliott_diagonal', name: '终结楔形', fullName: 'Ending Diagonal', type: 'elliott', emoji: '▽', reliability: '5/10', description: '上升/下降终结楔形的5浪结构', visualHint: '楔形内的5浪', detectCondition: '楔形区间内的5浪', isNew: true, },
];

const PatternRecognitionAdvanced = () => {
  const [filter, setFilter] = useState<'all' | 'reversal' | 'continuation' | 'harmonic' | 'elliott'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [detected] = useState<Set<string>>(new Set(['double_bottom', 'asc_triangle', 'bull_flag']));

  const filtered = useMemo(() => {
    if (filter === 'all') return PATTERNS_31;
    if (filter === 'reversal') return PATTERNS_31.filter(p => p.type.startsWith('reversal'));
    if (filter === 'continuation') return PATTERNS_31.filter(p => p.type.startsWith('continuation'));
    return PATTERNS_31.filter(p => p.type === filter);
  }, [filter]);

  const stats = useMemo(() => ({
    total: PATTERNS_31.length,
    detected: detected.size,
    classic: PATTERNS_31.filter(p => !p.isNew).length,
    newCount: PATTERNS_31.filter(p => p.isNew).length,
    avgReliability: PATTERNS_31.reduce((s, p) => s + parseInt(p.reliability), 0) / PATTERNS_31.length,
  }), [detected]);

  const typeColor = (type: string) => {
    if (type.startsWith('reversal_bull')) return '#16a34a';
    if (type.startsWith('reversal_bear')) return '#dc2626';
    if (type.startsWith('continuation_bull')) return '#2563eb';
    if (type.startsWith('continuation_bear')) return '#f59e0b';
    if (type === 'harmonic') return '#a855f7';
    return '#06b6d4';
  };

  return (
    <div className="pattern-recognition-adv" style={{ padding: 12, fontFamily: 'system-ui', fontSize: 12, maxWidth: 500 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🔍 形态识别 ({stats.total})</span>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#64748b' }}>
          <span>✅ {stats.detected}</span>
          <span style={{ color: '#f59e0b' }}>🆕 {stats.newCount}</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, marginBottom: 8, fontSize: 9 }}>
        <div style={{ padding: 4, background: '#f0fdf4', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{stats.detected}</div>
          <div style={{ color: '#64748b' }}>已检测</div>
        </div>
        <div style={{ padding: 4, background: '#f8fafc', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{stats.classic}</div>
          <div style={{ color: '#64748b' }}>经典</div>
        </div>
        <div style={{ padding: 4, background: '#fefce8', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{stats.newCount}</div>
          <div style={{ color: '#64748b' }}>新增</div>
        </div>
        <div style={{ padding: 4, background: '#f8fafc', borderRadius: 4, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 12 }}>{stats.avgReliability.toFixed(1)}</div>
          <div style={{ color: '#64748b' }}>均可靠</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { key: 'all' as const, label: '全部', count: PATTERNS_31.length },
          { key: 'reversal' as const, label: '反转', count: PATTERNS_31.filter(p => p.type.startsWith('reversal')).length },
          { key: 'continuation' as const, label: '持续', count: PATTERNS_31.filter(p => p.type.startsWith('continuation')).length },
          { key: 'harmonic' as const, label: '和谐', count: PATTERNS_31.filter(p => p.type === 'harmonic').length },
          { key: 'elliott' as const, label: '波浪', count: PATTERNS_31.filter(p => p.type === 'elliott').length },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '2px 8px', borderRadius: 10, border: 'none', fontSize: 9, cursor: 'pointer',
            background: filter === f.key ? '#3b82f6' : '#f1f5f9',
            color: filter === f.key ? 'white' : '#64748b',
          }}>
            {f.label} {f.count}
          </button>
        ))}
      </div>

      {/* Pattern Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, maxHeight: 350, overflowY: 'auto' }}>
        {filtered.map(p => {
          const isDetected = detected.has(p.id);
          const isSelected = selected === p.id;
          return (
            <div key={p.id} onClick={() => setSelected(isSelected ? null : p.id)} style={{
              padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${isSelected ? typeColor(p.type) : isDetected ? typeColor(p.type) + '40' : '#e5e7eb'}`,
              background: isSelected ? typeColor(p.type) + '08' : 'white',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 14 }}>{p.emoji}</span>
                <span style={{ fontWeight: 600, fontSize: 10 }}>{p.name}</span>
                {p.isNew && <span style={{ fontSize: 7, background: '#fef3c7', color: '#f59e0b', padding: '0 3px', borderRadius: 3 }}>NEW</span>}
                {isDetected && <span style={{ fontSize: 8, color: '#16a34a' }}>✓</span>}
              </div>
              <div style={{ fontSize: 8, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>可靠 {p.reliability}</span>
                <span style={{ color: typeColor(p.type) }}>
                  {p.type === 'harmonic' ? '和谐' : p.type === 'elliott' ? '波浪' :
                    p.type.startsWith('reversal') ? '反转' : '持续'}
                </span>
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div style={{ marginTop: 4, padding: 6, background: '#f8fafc', borderRadius: 4, fontSize: 9 }}>
                  <div style={{ lineHeight: 1.5, marginBottom: 4 }}>{p.description}</div>
                  <div style={{ color: '#94a3b8' }}>👁 {p.visualHint}</div>
                  <div style={{ color: '#94a3b8', marginTop: 2 }}>📐 {p.detectCondition}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>📭 无匹配形态</div>
      )}
    </div>
  );
};

export { PATTERNS_31 };
export default PatternRecognitionAdvanced;
