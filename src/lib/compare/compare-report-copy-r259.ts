// ══ R259 QClaw Task 3: 对比报告文案 ══
// Stock comparison report copy — side-by-side human-readable verdict
// Design: 不是"PE: A=15 B=20"的数据罗列——是\"A比B便宜25%，但B增长更快\"

export interface CompareDimension {
  id: string; label: string; emoji: string;
  aLabel: string; bLabel: string;
  higherIsBetter: boolean | null;
  format: (value: number) => string;
  verdict: (a: number, b: number) => string;
  weight: number; // 综合评分权重
}

// ═══════════════ 8大对比维度 ═══════════════

export const COMPARE_DIMENSIONS: CompareDimension[] = [
  {
    id: 'valuation', label: '估值', emoji: '💰',
    aLabel: '更便宜(PE低)', bLabel: '更便宜(PE低)',
    higherIsBetter: false,
    format: (v) => `${v.toFixed(1)}倍`,
    verdict: (a, b) => {
      const diff = Math.abs(a - b);
      const pct = diff / Math.max(a, b) * 100;
      if (pct < 10) return '两者估值相近，没有明显的便宜或贵。';
      if (a < b) return `{A}比{B}便宜约${pct.toFixed(0)}%（以PE衡量）。但便宜≠该买——确认{B}的高估值是否有\"高增长\"来支撑。`;
      return `{B}比{A}便宜约${pct.toFixed(0)}%（以PE衡量）。但便宜≠该买——确认{A}的高估值是否有\"高增长\"来支撑。`;
    },
    weight: 15,
  },
  {
    id: 'growth', label: '增长', emoji: '🚀',
    aLabel: '增速更高', bLabel: '增速更高',
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    verdict: (a, b) => {
      const diff = Math.abs(a - b);
      if (diff < 3) return '两者增长速度相近。如果估值也相近→看质量（ROE/利润率）来选。';
      if (a > b) return `{A}的收入增速比{B}快${diff.toFixed(1)}个百分点。增长领先=\"赛道上的位置更靠前\"。但验证——这个增速是产品力驱动还是烧钱驱动（看利润率变化）。`;
      return `{B}的收入增速比{A}快${diff.toFixed(1)}个百分点。增长领先=但确认——增速是在加速还是在减速？加速增长>减速增长（即使减速的那个绝对值更高）。`;
    },
    weight: 20,
  },
  {
    id: 'quality', label: '质量', emoji: '⭐',
    aLabel: 'ROE更高', bLabel: 'ROE更高',
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    verdict: (a, b) => {
      const diff = Math.abs(a - b);
      if (diff < 3) return '两者盈利能力相当。看负债率——谁用更少的负债达到了同样的ROE。';
      if (a > b) return `{A}的ROE比{B}高${diff.toFixed(1)}个百分点——投给{A}的每一块钱回报更高。但确认：{A}的高ROE是靠高负债推起来的吗？（看负债率对比）。`;
      return `{B}的ROE比{A}高${diff.toFixed(1)}个百分点。高ROE=\"好生意\"的数学证明。但确认高ROE的可持续性——过去3年的ROE是稳定、上升还是下降？`;
    },
    weight: 15,
  },
  {
    id: 'risk', label: '风险', emoji: '🛡️',
    aLabel: '负债更低', bLabel: '负债更低',
    higherIsBetter: false,
    format: (v) => `${v.toFixed(1)}%`,
    verdict: (a, b) => {
      const aHigh = a > 100; const bHigh = b > 100;
      if (aHigh && bHigh) return '两只股票负债率都超过100%——都是高杠杆运营。如果这是银行业(天然高负债)→正常。如果是其他行业→高风险。';
      if (!aHigh && bHigh) return `{A}的负债率({aVal})远低于{B}({bVal})——{A}是更安全的资产负债表。{B}的高负债=利率上升时成本压力更大。`;
      if (aHigh && !bHigh) return `{B}的负债率({bVal})远低于{A}({aVal})——{B}是更安全的资产负债表。`;
      const diff = Math.abs(a - b);
      if (diff < 20) return '两者负债率都在安全范围内，没有明显的风险差异。';
      if (a < b) return `{A}的负债更少——{A}在\"利率上升\"环境中更有韧性。`;
      return `{B}的负债更少——{B}在\"利率上升\"环境中更有韧性。`;
    },
    weight: 10,
  },
  {
    id: 'income', label: '分红', emoji: '💵',
    aLabel: '股息更高', bLabel: '股息更高',
    higherIsBetter: true,
    format: (v) => `${v.toFixed(2)}%`,
    verdict: (a, b) => {
      if (a === 0 && b === 0) return '两只都不分红——它们把利润全部投入了增长。如果你是\"收息型\"投资者→这两只都不适合你。';
      if (a === 0) return `{B}的分红率是{bVal}，{A}不分红。如果你需要现金流→{B}更合适。但如果{A}把\"不分红的钱\"投入了高速增长→长远来看{A}可能给更好的总回报。`;
      if (b === 0) return `{A}的分红率是{aVal}，{B}不分红。如果你需要现金流→{A}更合适。`;
      const diff = Math.abs(a - b);
      if (diff < 1) return '两者分红水平相当。选分红记录更久的那只（\"连续分红年数\"比\"股息率\"更能反映可靠性）。';
      if (a > b) return `{A}的股息率比{B}高${diff.toFixed(1)}个百分点。但检查：{A}的\"派息率\"是多少？派息率>80%→分红可能不可持续。`;
      return `{B}的股息率比{A}高${diff.toFixed(1)}个百分点。确认派息率——高股息+安全派息率=真安全，高股息+高派息率=危险。`;
    },
    weight: 5,
  },
  {
    id: 'momentum', label: '动量', emoji: '🌊',
    aLabel: '趋势更强', bLabel: '趋势更强',
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    verdict: (a, b) => {
      const aStrong = a > 10; const bStrong = b > 10;
      const aWeak = a < -10; const bWeak = b < -10;
      if (aStrong && bStrong) return '两只都在上涨通道中。看谁在\"加速\"（最近1个月增速 vs 6个月增速）——加速的那个趋势更强。';
      if (aWeak && bWeak) return '两只都在下跌中。在两者都跌的时候选\"跌得少\"+基本面的那个——它跌可能是因为\"被拖下水\"而不是自身问题。';
      if (aStrong && !bStrong) return `{A}的6个月动量(+${a.toFixed(0)}%)远强于{B}(${b.toFixed(0)}%)。短期内{A}的势头更好。但A是不是已经\"透支\"了未来涨幅？（看RSI是否>70）。`;
      if (!aStrong && bStrong) return `{B}的6个月动量(+${b.toFixed(0)}%)远强于{A}(${a.toFixed(0)}%)。{B}短期更强。但{bStrong ? '别追涨——等回调到合理位置再考虑。' : ''}`;
      return '两者短期动量相近。关注接下来1-2周谁能先突破关键阻力位——先突破的那个短期更值得关注。';
    },
    weight: 10,
  },
  {
    id: 'size', label: '规模', emoji: '📏',
    aLabel: '市值更大', bLabel: '市值更大',
    higherIsBetter: true,
    format: (v) => `${v.toFixed(0)}亿`,
    verdict: (a, b) => {
      const ratio = a > b ? a / b : b / a;
      if (ratio < 2) return '两者规模相当。如果在同一行业→它们很可能是\"直接竞争对手\"。';
      const bigger = a > b ? '{A}' : '{B}';
      const smaller = a > b ? '{B}' : '{A}';
      return `${bigger}的市值是${smaller}的${ratio.toFixed(1)}倍。${bigger}=更稳健（\"大象不容易倒下\"），${smaller}=更高成长空间（\"小树能长成大树\"）。这不是谁更好的问题——是你想要\"稳\"还是\"猛\"的问题。`;
    },
    weight: 5,
  },
  {
    id: 'cashflow', label: '现金流', emoji: '💸',
    aLabel: '现金流更强', bLabel: '现金流更强',
    higherIsBetter: true,
    format: (v) => `${v.toFixed(1)}%`,
    verdict: (a, b) => {
      if (a < 0 && b < 0) return '两只的FCF都是负数——都在\"烧钱\"阶段。谁烧得\"更有效率\"（每烧1块钱带来多少收入增长）谁更强。';
      if (a < 0) return `{B}产生了正的自由现金流（{bVal}），{A}在烧钱。{B}=\"在赚钱\"，{A}=\"在花投资人的钱\"。这是根本性的区别。`;
      if (b < 0) return `{A}产生了正的自由现金流（{aVal}），{B}在烧钱。{A}=\"健康\"，{B}=\"依赖外部融资\"。`;
      const diff = Math.abs(a - b);
      if (diff < 2) return '两者现金流都很健康。都\"在赚钱\"的基础上→回到增长和质量维度来选。';
      if (a > b) return `{A}的自由现金流收益率({aVal})高于{B}({bVal})。{A}每赚1块钱有更多能\"真金白银\"留在手里。这是\"安全的利润\"。`;
      return `{B}的自由现金流收益率({bVal})高于{A}({aVal})。现金流比利润更\"真\"——利润可以做账，现金流做不了。`;
    },
    weight: 20,
  },
];

// ═══════════════ 综合评分文案 ═══════════════

export const COMPARE_VERDICT = {
  title: '📊 {A} vs {B} — 综合对比',
  
  scoreHeader: '综合评分（满分100）',

  // 大幅领先
  decisive: (winner: string, loser: string, _scoreDiff: number) => 
    `🏆 ${winner}在多维度上领先${loser}——估值更合理、增长更快、现金流更强。\
${winner}不是你\"一定要买\"——是如果在这两只中选一只，${winner}的\"风险调整后性价比\"更高。\
但提醒：最好的股票不一定在\"对比\"中赢——它可能只是\"没有明显的短板\"。`,

  // 微弱领先
  narrow: (a: string, b: string) => 
    `⚖️ ${a}和${b}非常接近——没有\"碾压\"，只有\"各有优势\"。\
${a}在估值和质量上略好，${b}在增长上更有想象力。\
这种情况下：不选\"赢的那个\"——选\"你更了解的那个\"。你更懂谁的商业模式？更相信谁的未来？那才是你的答案。`,

  // 完全平手
  tie: (a: string, b: string) =>
    `🤝 ${a}和${b}几乎不分上下——它们可能是\"同一赛道的不同选手\"。\
如果两者真的各方面都相似：看\"哪个你更敢在它跌了15%之后继续持有\"——那个才是更适合你的。`,

  // 类别差异太大（跨行业对比）
  crossIndustry: (a: string, _b: string, _aSector: string, _bSector: string) =>
    `🌍 ${a}跨行业对比——很多维度不可比。比如"PE低"不意味着便宜——不同行业的PE天然不同。跨行业对比只能看"绝对质量"（ROE、现金流、负债率）——估值和增长的对比没有意义。`,

  disclaimer: '⚠️ 以上为数据驱动的客观对比，不构成投资建议。最终决定——在你手里。',
};

// ═══════════════ 维度详解模板 ═══════════════

export function renderComparisonReport(symbolA: string, symbolB: string, data: Record<string, { a: number; b: number }>): string {
  const lines: string[] = [];
  
  lines.push(`# 📊 ${symbolA} vs ${symbolB}`);
  lines.push('');
  lines.push('| 维度 | ${symbolA} | ${symbolB} | 谁赢了 |');
  lines.push('|------|-----------|-----------|--------|');
  
  let scoreA = 0; let scoreB = 0;
  
  for (const dim of COMPARE_DIMENSIONS) {
    const vals = data[dim.id];
    if (!vals || vals.a === undefined || vals.b === undefined) continue;
    
    const formattedA = dim.format(vals.a);
    const formattedB = dim.format(vals.b);
    
    let winner = '';
    if (dim.higherIsBetter === true) {
      winner = vals.a > vals.b ? `✅ ${symbolA}` : vals.b > vals.a ? `✅ ${symbolB}` : '🤝 平';
      if (vals.a > vals.b) scoreA += dim.weight; else if (vals.b > vals.a) scoreB += dim.weight;
      else { scoreA += dim.weight / 2; scoreB += dim.weight / 2; }
    } else if (dim.higherIsBetter === false) {
      winner = vals.a < vals.b ? `✅ ${symbolA}` : vals.b < vals.a ? `✅ ${symbolB}` : '🤝 平';
      if (vals.a < vals.b) scoreA += dim.weight; else if (vals.b < vals.a) scoreB += dim.weight;
      else { scoreA += dim.weight / 2; scoreB += dim.weight / 2; }
    } else {
      winner = '—';
    }
    
    lines.push(`| ${dim.emoji} ${dim.label} | ${formattedA} | ${formattedB} | ${winner} |`);
  }
  
  lines.push('');
  lines.push(`### 综合评分: ${symbolA} ${scoreA.toFixed(0)} vs ${symbolB} ${scoreB.toFixed(0)}`);
  
  const diff = Math.abs(scoreA - scoreB);
  if (diff > 20) {
    const winner = scoreA > scoreB ? symbolA : symbolB;
    const loser = scoreA > scoreB ? symbolB : symbolA;
    lines.push('');
    lines.push(COMPARE_VERDICT.decisive(winner, loser, diff));
  } else if (diff > 5) {
    lines.push('');
    lines.push(COMPARE_VERDICT.narrow(scoreA > scoreB ? symbolA : symbolB, scoreA > scoreB ? symbolB : symbolA));
  } else {
    lines.push('');
    lines.push(COMPARE_VERDICT.tie(symbolA, symbolB));
  }
  
  // 逐维度解读
  lines.push('');
  lines.push('---');
  lines.push('### 📋 逐维度解读');
  
  for (const dim of COMPARE_DIMENSIONS) {
    const vals = data[dim.id];
    if (!vals || vals.a === undefined || vals.b === undefined) continue;
    let v = dim.verdict(vals.a, vals.b);
    v = v.replace(/\{A\}/g, symbolA).replace(/\{B\}/g, symbolB);
    v = v.replace(/\{aVal\}/g, dim.format(vals.a)).replace(/\{bVal\}/g, dim.format(vals.b));
    lines.push(`\n**${dim.emoji} ${dim.label}:** ${v}`);
  }
  
  lines.push(`\n---\n${COMPARE_VERDICT.disclaimer}`);
  
  return lines.join('\n');
}

// ═══════════════ 对比页面 UI 文案 ═══════════════

export const COMPARE_UI_COPY = {
  header: {
    title: '📊 股票对比',
    subtitle: '不是\"谁便宜谁好\"——是\"谁更适合你的策略\"',
  },

  searchA: { placeholder: '输入第一只股票', label: '股票A' },
  searchB: { placeholder: '输入第二只股票', label: '股票B' },

  emptyState: {
    noSelection: '选择两只股票开始对比。可以是同一行业的\"竞争对手\"，也可以是\"跨行业\"的备选标的。',
    sameStock: '别选一样的股票——对比两只不同的。',
    onlyOneSelected: '再选一只——选好了点\"开始对比\"。',
    loading: '正在拉取两只股票的财务和技术数据… 通常需要3-5秒。',
    notEnoughData: '{symbol}的数据不足以进行完整对比。可能原因是：新上市(<6个月)、数据源覆盖不全、或者非标准股票类型。',
  },

  shareButton: '分享这个对比 → 让社区帮你选？',
  shareText: '我在QUANT MOO上对比了{symbolA}和{symbolB}——{verdict}。来帮我看看？',

  quickComparePresets: [
    { name: '苹果 vs 微软', symbols: ['AAPL', 'MSFT'], reason: '科技巨头之争' },
    { name: '特斯拉 vs 比亚迪', symbols: ['TSLA', 'BYDDY'], reason: '电动车龙头PK' },
    { name: '腾讯 vs 阿里', symbols: ['TCEHY', 'BABA'], reason: '中国互联网双雄' },
    { name: '可口可乐 vs 百事', symbols: ['KO', 'PEP'], reason: '消费防御经典' },
  ],
};

// ═══════════════ 工具函数 ═══════════════

export function getCompareDimension(id: string): CompareDimension | undefined {
  return COMPARE_DIMENSIONS.find(d => d.id === id);
}

export { COMPARE_DIMENSIONS as default };
