// ══ R245 QClaw P1-07: 因子一键场景包文案 ══
// 5 scenes × 5-8 factors each + pre-built combo + usage guide
// Design: "告诉我想干嘛，我给你一串该看的因子"

export interface FactorScenePack {
  sceneId: string;
  emoji: string;
  sceneName: string;
  /** 30字场景说明 */
  sceneDesc: string;
  /** 适合谁 (≤20字) */
  suitableFor: string;
  /** 核心因子组合 (5-8个) */
  factorCombo: {
    factorId: string;
    /** 在这个场景里这个因子怎么看 */
    quickInterpret: string;
    /** 权重建议 0-100, 整包之和=100 */
    weight: number;
  }[];
  /** 使用步骤 (3步) */
  usageSteps: string[];
  /** 什么时候别用这个场景包 */
  whenNotToUse: string;
}

export const FACTOR_SCENE_PACKS: FactorScenePack[] = [
  // ── 🔥 Scene 1: 追涨 ──
  {
    sceneId: 'chase_momentum',
    emoji: '📈',
    sceneName: '我要追涨',
    sceneDesc: '找正在涨、还会继续涨的票，顺势而为不猜顶',
    suitableFor: '不怕追高、相信趋势的人',
    factorCombo: [
      { factorId: 'MOM_12M', quickInterpret: '过去一年涨最多的就是候选池', weight: 20 },
      { factorId: 'ADX', quickInterpret: 'ADX>25才有趋势可追，<20别进来', weight: 20 },
      { factorId: 'EMA_12_26', quickInterpret: 'MACD柱必须为正且在扩大', weight: 15 },
      { factorId: 'MA_20_60', quickInterpret: '20日线必须>60日线（金叉状态）', weight: 15 },
      { factorId: 'OBV', quickInterpret: 'OBV和价格一起涨=量价健康', weight: 10 },
      { factorId: 'RSI_14', quickInterpret: 'RSI>50且在涨=强势，但>80要小心', weight: 10 },
      { factorId: 'ATR_14', quickInterpret: 'ATR扩大=趋势加速中，ATR萎缩=动力不足', weight: 10 },
    ],
    usageSteps: [
      '① 用MOM_12M筛选Top 20%候选 → 排除不够强的',
      '② 用ADX+MACD确认趋势有效 → 排除横盘的',
      '③ 用OBV+RSI验证量价配合 → 排除假突破',
    ],
    whenNotToUse: '整体市场暴跌(XM全市场>2%跌)时暂停',
  },

  // ── 💰 Scene 2: 抄底 ──
  {
    sceneId: 'bottom_fishing',
    emoji: '🎣',
    sceneName: '我要抄底',
    sceneDesc: '跌太多了该反弹了，别人不要的我来捡',
    suitableFor: '敢于逆向、能等的人',
    factorCombo: [
      { factorId: 'STR_5D', quickInterpret: '连续跌5天以上=反弹概率上升', weight: 20 },
      { factorId: 'RSI_14', quickInterpret: 'RSI<30=超卖区，<20=极度超卖', weight: 15 },
      { factorId: 'BOLL', quickInterpret: '价格跌穿下轨=偏离正常值太多', weight: 15 },
      { factorId: 'FEAR_GREED_INDEX', quickInterpret: '恐惧<25=市场恐慌过头', weight: 15 },
      { factorId: 'KDJ', quickInterpret: 'K/D/J全部<20=短线超卖', weight: 10 },
      { factorId: 'ACCRUALS', quickInterpret: '利润质量过关才不是价值陷阱', weight: 10 },
      { factorId: 'OBV', quickInterpret: '价格跌但OBV不跌=聪明钱在悄悄吸筹', weight: 10 },
      { factorId: 'MAX_DRAWDOWN', quickInterpret: '离历史底部还差多少', weight: 5 },
    ],
    usageSteps: [
      '① 用恐惧指数+RSI判断市场是否恐慌过头 → 不是每次跌都能抄',
      '② 用ACCRUALS排除垃圾→ 低价+坏公司=价值陷阱',
      '③ 用OBV背离找聪明钱→ 价格跌但资金在进场',
    ],
    whenNotToUse: '公司有重大负面(财务造假/退市风险)时绝对不碰',
  },

  // ── 🛡️ Scene 3: 防风险 ──
  {
    sceneId: 'risk_guard',
    emoji: '🛡️',
    sceneName: '我怕亏钱',
    sceneDesc: '已买了票但怕跌，看看有哪些风险信号',
    suitableFor: '已经持仓、想保护利润的人',
    factorCombo: [
      { factorId: 'VOL_60D', quickInterpret: '波动突然放大=暴风雨要来了', weight: 20 },
      { factorId: 'US_VIX', quickInterpret: 'VIX跳升=华尔街在发抖', weight: 15 },
      { factorId: 'MAX_DRAWDOWN', quickInterpret: '当前回撤在历史什么位置', weight: 15 },
      { factorId: 'TAIL_DEPENDENCE', quickInterpret: '市场大跌时你会不会跟着崩', weight: 15 },
      { factorId: 'PUT_CALL_SKEW', quickInterpret: '聪明钱在买保险=他们在担心什么', weight: 10 },
      { factorId: 'RATE_BETA', quickInterpret: '加息对你持仓有多大影响', weight: 10 },
      { factorId: 'CREDIT_SPREAD_BETA', quickInterpret: '企业债利率飙升=信用危机', weight: 10 },
      { factorId: 'CROWDING', quickInterpret: '所有人都在买这个？可能踩踏', weight: 5 },
    ],
    usageSteps: [
      '① 看VIX+波动率是否异常→ 判断市场整体风险级别',
      '② 看尾部依赖+拥挤度→ 判断持仓的特定风险',
      '③ 看加息敏感度+信用风险→ 判断宏观风险敞口',
    ],
    whenNotToUse: '市场正常波动时过度关注会吓到自己',
  },

  // ── 💸 Scene 4: 收息 ──
  {
    sceneId: 'income_hunting',
    emoji: '💸',
    sceneName: '我要收息',
    sceneDesc: '找高股息的好公司，定期收钱，睡得着觉',
    suitableFor: '不想盯盘、喜欢现金流的人',
    factorCombo: [
      { factorId: 'DIV_YIELD_12M', quickInterpret: '股息率>4%入围，越高越好但别过8%', weight: 20 },
      { factorId: 'EP_RATIO', quickInterpret: '市盈率不能太高，否则股息率是假象', weight: 15 },
      { factorId: 'ROE_STABILITY', quickInterpret: 'ROE多年稳定=公司能持续赚钱分红', weight: 15 },
      { factorId: 'DEBT_COVERAGE', quickInterpret: '利息覆盖>5倍=财务健康能维持分红', weight: 15 },
      { factorId: 'FREE_CASH_FLOW', quickInterpret: '自由现金流必须为正，才能分红', weight: 15 },
      { factorId: 'ACCRUALS', quickInterpret: '利润是真金白银不是纸面数字', weight: 10 },
      { factorId: 'GROSS_PROFITABILITY', quickInterpret: '毛利率高=有护城河', weight: 10 },
    ],
    usageSteps: [
      '① 股息率筛选 → 找股息>4%的候选',
      '② FCF+应计率验证 → 确保公司真有现金分红',
      '③ ROE稳定+利息覆盖 → 确保分红可持续',
    ],
    whenNotToUse: '利率快速上升时高息股会承压',
  },

  // ── 🔍 Scene 5: 捡便宜 ──
  {
    sceneId: 'value_hunt',
    emoji: '🔍',
    sceneName: '我想捡便宜',
    sceneDesc: '买被低估的好公司，等市场认识到它的价值',
    suitableFor: '有耐心、能等半年的人',
    factorCombo: [
      { factorId: 'EP_RATIO', quickInterpret: 'PE低=便宜，但要结合行业', weight: 20 },
      { factorId: 'CFP_RATIO', quickInterpret: '企业价值/现金流=比PE更干净的估值', weight: 15 },
      { factorId: 'HML', quickInterpret: '市净率低=公司资产被低估', weight: 15 },
      { factorId: 'F_SCORE', quickInterpret: 'Piotroski打分>7=基本面真改善', weight: 15 },
      { factorId: 'ROE_STABILITY', quickInterpret: 'ROE高+稳定的低PE才是真便宜', weight: 15 },
      { factorId: 'GROSS_MARGIN_TREND', quickInterpret: '毛利率在回升=经营在好转', weight: 10 },
      { factorId: 'ACCRUALS', quickInterpret: '利润质量高才不是价值陷阱', weight: 10 },
    ],
    usageSteps: [
      '① EP+CFP+HML三重估值 → 确保真的便宜',
      '② F_SCORE筛选 → 排除看起来便宜实际在恶化的',
      '③ ROE+毛利率趋势 → 确认便宜是因为被忽视不是真问题',
    ],
    whenNotToUse: '成长股牛市中便宜股会继续便宜',
  },
];

/** Lookup helper */
export function getScenePack(sceneId: string): FactorScenePack | undefined {
  return FACTOR_SCENE_PACKS.find(p => p.sceneId === sceneId);
}

/** Generate a user-facing scene recommendation card */
export function generateSceneCard(sceneId: string): string {
  const pack = getScenePack(sceneId);
  if (!pack) return '';

  const factors = pack.factorCombo.map(f => `  ${f.quickInterpret} (权重${f.weight}%)`).join('\n');
  const steps = pack.usageSteps.map(s => `  ${s}`).join('\n');

  return `${pack.emoji} ${pack.sceneName}
${pack.sceneDesc}

👤 适合: ${pack.suitableFor}

📊 要看这些因子:
${factors}

📋 三步走:
${steps}

⚠️ 别用的时候: ${pack.whenNotToUse}`;
}

export default FACTOR_SCENE_PACKS;
