// ══ R257 QClaw Task 1: 热力图数据文案(10行业) ══
// Heatmap sector copy — what the user sees when they hover/tap a sector block
// Design: 每个行业方块上展示的不只是名字——是"一句话看懂"

export interface SectorHeatmapBlock {
  sectorId: string;
  sectorName: string;
  sectorEmoji: string;
  headerLine: string;        // 一句话（≤12字）— 热力图方块上显示的
  tooltipBrief: string;      // hover气泡，≤40字
  detailTitle: string;       // 点击进入详情页的标题
  detailSummary: string;     // 详情页摘要，≤100字
  keySignal: string;         // 关键信号 — "今天看什么"
  trendColor: string;        // 今日涨跌对应的文案
  tradePrompt: string;       // 行动引导 — "想买什么？→点我"
}

export const SECTOR_HEATMAP_COPY: SectorHeatmapBlock[] = [
  {
    sectorId: 'TECHNOLOGY', sectorName: '科技', sectorEmoji: '💻',
    headerLine: '利率说了算',
    tooltipBrief: '科技板块~28%标普权重。利率降=飞，利率升=难。今天看10年美债。',
    detailTitle: '💻 科技板块 — 增长的故事，但利率是导演',
    detailSummary: '美国最大的板块(~28%)。定价逻辑：不靠现在的利润，靠"未来利润折现"。利率=科技股的"重力"——低利率时失重飞行，高利率时举步维艰。芯片(AI需求)+软件(云化)+互联网(广告)三大子板块轮动。',
    keySignal: '10年期美债收益率 + 纳指100走势 = 科技板块的"天气预报"',
    trendColor: '跟纳指高度同步——纳指涨=科技涨',
    tradePrompt: '看好AI芯片？→筛选器找"科技+PE合理+研发占比高"',
  },
  {
    sectorId: 'FINANCIAL', sectorName: '金融', sectorEmoji: '🏦',
    headerLine: '利率=命脉',
    tooltipBrief: '银行保险券商~13%。利差大=赚，利差小=熬。今天看利率曲线。',
    detailTitle: '🏦 金融板块 — 经济的血管',
    detailSummary: '银行(赚息差)+保险(收保费投资)+券商(赚交易费)。与科技跷跷板：利率升→息差大→金融涨。利率降→息差小→金融跌。信贷质量是暗雷——坏账上升=金融暴跌。',
    keySignal: '2年vs10年美债利差 + KBW银行指数 = 金融的"心率"',
    trendColor: '跟利率方向——利率升=金融利好',
    tradePrompt: '觉得利率要升？→筛选器找"银行+低PE+高净息差"',
  },
  {
    sectorId: 'HEALTHCARE', sectorName: '医疗', sectorEmoji: '🏥',
    headerLine: '防御+爆发',
    tooltipBrief: '制药+生物科技+器械~13%。大盘药=稳如债，小生物科=能翻倍也能腰斩。',
    detailTitle: '🏥 医疗板块 — 防御的堡垒，爆发的赌场',
    detailSummary: '大盘制药=稳定+分红(像债券，跟利率关系不大)。小生物科技=高风险高回报。受FDA审批、专利到期、医保政策影响最大。人们生病不关心美联储——所以医疗是"经济周期不敏感"板块。',
    keySignal: 'FDA审批日历 + 政策风向 = 医疗的"双引擎"',
    trendColor: '大盘制药跟大盘弱相关，小生物科技波动极大',
    tradePrompt: '看好某新药获批？→筛选器找"医疗+市值小+研发管线深"',
  },
  {
    sectorId: 'ENERGY', sectorName: '能源', sectorEmoji: '🛢️',
    headerLine: '油价的奴隶',
    tooltipBrief: '石油天然气~4%。油价>80=躺赚，<50=保命。地缘政治是催化剂。',
    detailTitle: '🛢️ 能源板块 — 周期之王',
    detailSummary: '"大宗商品驱动"型板块。油价涨=能源涨。OPEC+减产=推高油价，需求下滑=油价跌。新能源转型让传统能源多了一层"被淘汰"的风险。但短期来看，地缘冲突比ESG更影响油价。',
    keySignal: 'WTI原油期货 + OPEC+会议结果 = 能源的"油价指令"',
    trendColor: '跟WTI高度同步——油价涨=能源涨',
    tradePrompt: '看好油价维持高位？→筛选器找"能源+低开采成本+高分红"',
  },
  {
    sectorId: 'CONSUMER', sectorName: '消费', sectorEmoji: '🛒',
    headerLine: '经济好不好，看消费',
    tooltipBrief: '必需+可选~18%。必需品防跌，可选品冲锋。消费者信心=方向盘。',
    detailTitle: '🛒 消费板块 — 经济冷暖的温度计',
    detailSummary: '两副面孔：必需品(食品饮料日用品→防御，经济再差也要买) vs 可选品(汽车奢侈品旅游→周期性，"有钱才花")。消费者信心是前瞻指标——信心降=可选消费先行下跌。',
    keySignal: '消费者信心指数 + 零售销售数据 = 消费的"信心+钱包"',
    trendColor: '必需品跟大盘弱相关，可选品跟大盘强相关',
    tradePrompt: '觉得经济回暖？→筛选器找"可选消费+低库存+品牌溢价"',
  },
  {
    sectorId: 'INDUSTRIALS', sectorName: '工业', sectorEmoji: '🏭',
    headerLine: '全球经济的体温计',
    tooltipBrief: '航空航天+物流+机械~8%。全球PMI=工业好坏的第一信号。',
    detailTitle: '🏭 工业板块 — 全球供应链的晴雨表',
    detailSummary: '最"经济敏感"板块。制造业PMI扩张=工业好。基建投资+贸易政策+航空出行是三大驱动。国防子板块独立于经济(政府预算驱动)。新订单指数是领先指标——订单多=未来6个月业绩好。',
    keySignal: '全球制造业PMI + ISM新订单指数 = 工业的"订单会"',
    trendColor: '跟全球PMI同步——PMI升=工业起飞',
    tradePrompt: '看好全球基建？→筛选器找"工业+新订单增速高+估值合理"',
  },
  {
    sectorId: 'MATERIALS', sectorName: '原材料', sectorEmoji: '⛏️',
    headerLine: '中国+美元=密码',
    tooltipBrief: '矿业化工建材~3%。铜博士最诚实——铜价涨=全球经济回暖。',
    detailTitle: '⛏️ 原材料板块 — 被中国和美元牵着走',
    detailSummary: '最小的板块(~3%)但最全球化。铜/铁矿石/锂——每个金属有自己的"小经济"。中国需求是过去20年全球原材料的第一引擎。美元强=商品贵(非美元买家买不起)=原材料跌。',
    keySignal: '铜价 + 美元指数 + 中国PMI = 原材料的"三把钥匙"',
    trendColor: '美元跌=原材料涨（反向关系）',
    tradePrompt: '看好绿色转型金属需求？→筛选器找"矿业+铜/锂/镍+低成本"',
  },
  {
    sectorId: 'UTILITIES', sectorName: '公用事业', sectorEmoji: '⚡',
    headerLine: '债券的替身',
    tooltipBrief: '电力水务燃气~3%。高股息+超稳——跟利率比，利率升=它跌。',
    detailTitle: '⚡ 公用事业板块 — 拿股息的地方',
    detailSummary: '最"无聊"板块但最"稳"。不受经济周期影响(没人因失业不用电)。主要竞争者是债券——利率上升=债券收益高=公用事业被冷落。AI数据中心是新增用电大户(新需求源)。',
    keySignal: '10年国债收益率 vs 公用事业平均股息率 = 公用事业的"估值锚"',
    trendColor: '跟利率反向——利率降=公用事业涨',
    tradePrompt: '想要安稳收息？→筛选器找"公用事业+股息率>3%+稳定分红纪录"',
  },
  {
    sectorId: 'REAL_ESTATE', sectorName: '房地产', sectorEmoji: '🏘️',
    headerLine: '利率的晴雨表',
    tooltipBrief: 'REITs~3%。不直接买房，买"收租的公司"。利率=第一驱动。',
    detailTitle: '🏘️ 房地产板块 — 利率最敏感的板块',
    detailSummary: 'REITs="收房租的公司"。利率直接影响：①贷款成本(地产靠负债运营) ②REIT股息率vs国债收益率的竞争。写字楼(远程办公承压)vs数据中心(AI算力新需求)vs公寓(住房刚需)——不同子类不同命运。',
    keySignal: '联邦基金利率 + 各REIT入住率 = 房地产的"利率+租客"体检',
    trendColor: '跟利率反向——利率降=REIT涨（贷款成本降+股息更有吸引力）',
    tradePrompt: '看好数据中心需求？→筛选器找"REIT+数据中心+高入住率"',
  },
  {
    sectorId: 'COMMUNICATION', sectorName: '通信服务', sectorEmoji: '📡',
    headerLine: '管道 vs 平台',
    tooltipBrief: '电信(管道稳)+互联网(平台猛)~9%。广告预算=平台晴雨表。',
    detailTitle: '📡 通信板块 — 两个世界，一个板块',
    detailSummary: '最"分裂"的板块——一边是电信(管道生意，月租收钱，稳如债)，一边是互联网平台(Meta/Google/Netflix，广告+订阅驱动，强周期性)。广告预算是平台的"上游水源"——经济差=广告缩=平台出血。',
    keySignal: '全球广告支出预测 + 反垄断监管 = 通信的"广告+政策"双检',
    trendColor: '电信=防御(弱相关)，平台=进攻(跟科技同步)',
    tradePrompt: '看好AI驱动广告增长？→筛选器找"通信+平台+广告收入占比高"',
  },
];

// ═══════════════ 热力图总览文案 ═══════════════

export const HEATMAP_OVERVIEW = {
  title: '📊 市场热力图',
  subtitle: '一块颜色=一个板块。绿色涨、红色跌、大小=市值。一眼看懂今天谁在动。',
  emptyState: '正在加载市场数据… 🐂 牛角数据点自转中',
  errorState: '数据加载失败。Yahoo Finance可能正在午休 ☕ 稍后再试。',
  refreshLabel: '刷新',
  lastUpdated: (time: string) => `最后更新: ${time}`,
  legend: {
    up: '涨',
    down: '跌',
    flat: '平',
    sizeMeans: '方块大小 = 板块总市值',
  },
  actions: {
    tapToExplore: '点击方块 → 查看板块详情',
    compareMode: '对比模式: 选2个板块 → 看谁更强',
    screenerLink: '从热力图进入筛选器 → 在这个板块里找股票',
  },
};

// ═══════════════ 工具函数 ═══════════════

export function getSectorHeatmapBlock(sectorId: string): SectorHeatmapBlock | undefined {
  return SECTOR_HEATMAP_COPY.find(s => s.sectorId === sectorId);
}

export function getHeatmapTooltip(sectorId: string): string {
  const block = getSectorHeatmapBlock(sectorId);
  return block ? `${block.sectorEmoji} ${block.sectorName} — ${block.tooltipBrief}` : '';
}

export default SECTOR_HEATMAP_COPY;
