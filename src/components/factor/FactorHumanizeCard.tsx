// @ts-nocheck
import React, { useState, useMemo } from 'react';

/* ====== Types ====== */
type FactorLevel1 = '动量和趋势' | '波动与风险' | '资金流' | '估值' | '技术形态' | '市场情绪' | '宏观周期' | '行业轮动' | '事件驱动' | '市场结构' | '量价关系' | '基本面' | '另类数据' | '全球联动' | '中国特有' | '加密货币';

interface FactorHumanized {
  id: string; nameEn: string; nameCn: string; level1: FactorLevel1; level2: string;
  humanLabel: string; // ≤15字一句话
  humanDesc: string;  // ≤50字使用建议
  dontUseWhen: string; // ≤30字别用场景
  icScore: number; // -1~+1
  market: string; // US/HK/CN/CRYPTO/ALL
}

/* ====== Mock Factor Data (188) — showing 40 representative ones ====== */
const mockFactors: FactorHumanized[] = [
  // 动量和趋势
  { id: 'f1', nameEn: 'Momentum12M', nameCn: '12月动量', level1: '动量和趋势', level2: '时间序列动量', humanLabel: '你买过去一年涨最多的', humanDesc: '过去12个月涨幅最大的股票，趋势持续概率高。牛市用，熊市别碰。', dontUseWhen: '市场风格突然切换时，动量会反噬', icScore: 0.08, market: 'ALL' },
  { id: 'f2', nameEn: 'Momentum1M', nameCn: '1月动量', level1: '动量和趋势', level2: '时间序列动量', humanLabel: '你追最近跑得快的', humanDesc: '最近1个月强势的股票短期有惯性。超短线交易用，持3-5天。', dontUseWhen: '财报季前别用，消息面会打乱动量', icScore: 0.05, market: 'ALL' },
  { id: 'f3', nameEn: 'TrendMA', nameCn: '均线趋势', level1: '动量和趋势', level2: '均线交叉', humanLabel: '你看均线方向买', humanDesc: '短期均线上穿长期均线时买入，趋势明确。中长线持有1-3月最佳。', dontUseWhen: '盘整市场来回交叉时别信，会频繁止损', icScore: 0.06, market: 'ALL' },
  { id: 'f4', nameEn: 'Breakout20d', nameCn: '20日突破', level1: '动量和趋势', level2: '突破', humanLabel: '你等突破20日高点追', humanDesc: '突破前20日最高价是强势信号，配合放量确认。目标5-10%止盈。', dontUseWhen: '假突破频发时等回落确认再进', icScore: 0.07, market: 'US' },
  // 波动与风险
  { id: 'f5', nameEn: 'Volatility20d', nameCn: '20日波动率', level1: '波动与风险', level2: '实现波动率', humanLabel: '你别碰波动太大的', humanDesc: '高波动股票虽然赚得多但亏得也多，适合风险承受力强的你。', dontUseWhen: '波动率>60%时小白别碰', icScore: -0.04, market: 'ALL' },
  { id: 'f6', nameEn: 'MaxDrawdown', nameCn: '最大回撤', level1: '波动与风险', level2: '下行风险', humanLabel: '你避开曾经跌很惨的', humanDesc: '历史最大回撤大的股票，下次大跌你也扛不住。作为排除条件用。', dontUseWhen: '不要单独用这个因子，会错过反转股', icScore: -0.06, market: 'ALL' },
  { id: 'f7', nameEn: 'SharpeRatio', nameCn: '夏普比率', level1: '波动与风险', level2: '风险调整收益', humanLabel: '你选性价比最高的', humanDesc: '每承担1%风险能赚多少。夏普>1算优秀，越高越稳。组合选股首选。', dontUseWhen: '极端牛市时夏普会虚高', icScore: 0.09, market: 'ALL' },
  { id: 'f8', nameEn: 'Beta', nameCn: '贝塔系数', level1: '波动与风险', level2: '市场敏感度', humanLabel: '你选比大盘猛的还是稳的', humanDesc: 'Beta>1涨得比大盘猛跌得也比大盘惨。牛市选高Beta，熊市选低Beta。', dontUseWhen: '市场方向不明时Beta没法告诉你涨还是跌', icScore: 0.03, market: 'ALL' },
  // 资金流
  { id: 'f9', nameEn: 'InstitutionalFlow', nameCn: '机构资金流', level1: '资金流', level2: '机构动向', humanLabel: '你跟大资金一起走', humanDesc: '机构净买入的股票通常有3-15天延续性。北向资金、基金重仓都是信号。', dontUseWhen: '机构也在割肉逃命的时候别跟', icScore: 0.11, market: 'CN/HK' },
  { id: 'f10', nameEn: 'RetailFlow', nameCn: '散户资金流', level1: '资金流', level2: '散户动向', humanLabel: '散户买你卖，散户卖你买', humanDesc: '散户大量涌入时股价通常短期见顶，散户恐慌时反而是机会。反向指标。', dontUseWhen: '牛市主升浪时散户推着涨，别反着做', icScore: -0.05, market: 'ALL' },
  { id: 'f11', nameEn: 'LargeOrder', nameCn: '大单净流入', level1: '资金流', level2: '大单监控', humanLabel: '你看大户单子在买什么', humanDesc: '单笔>50万的大单净买入是专业资金信号。连续3天净流入可信度高。', dontUseWhen: '大单也可能对倒，要配合成交量验证', icScore: 0.10, market: 'CN' },
  { id: 'f12', nameEn: 'ShortInterest', nameCn: '做空比例', level1: '资金流', level2: '做空数据', humanLabel: '你做空比例高的要小心', humanDesc: '做空比例>20%的股票有轧空风险，但也可能被狙击。高做空=高争议。', dontUseWhen: '做空比例低不代表一定安全', icScore: -0.07, market: 'US' },
  // 估值
  { id: 'f13', nameEn: 'PE_G', nameCn: '市盈增长比', level1: '估值', level2: '成长估值', humanLabel: '你想买又便宜又增长快的', humanDesc: 'PEG<1说明股价被低估。适合找还没被炒起来的成长股，耐心持有。', dontUseWhen: '周期股PE低是陷阱，盈利即将下滑', icScore: 0.06, market: 'ALL' },
  { id: 'f14', nameEn: 'PB', nameCn: '市净率', level1: '估值', level2: '价值估值', humanLabel: '你买跌破账面价值的便宜货', humanDesc: 'PB<1的股票理论上打折。银行、地产常用，科技股不适用。', dontUseWhen: '资产质量烂的公司PB低是应该的', icScore: 0.04, market: 'ALL' },
  { id: 'f15', nameEn: 'DividendYield', nameCn: '股息率', level1: '估值', level2: '分红收益', humanLabel: '你躺着收分红', humanDesc: '股息率>4%是现金奶牛。适合稳健的你，熊市持有比银行利息好。', dontUseWhen: '股息率突然变高可能因为股价暴跌', icScore: 0.05, market: 'ALL' },
  { id: 'f16', nameEn: 'EV_EBITDA', nameCn: '企业价值倍数', level1: '估值', level2: '企业价值', humanLabel: '你看真实盈利能力选股', humanDesc: 'EV/EBITDA比PE更真实，不考虑资本结构。横向对比同行业用。', dontUseWhen: '不同行业之间不能直接比', icScore: 0.07, market: 'ALL' },
  // 技术形态
  { id: 'f17', nameEn: 'RSI14', nameCn: '14日RSI', level1: '技术形态', level2: '超买超卖', humanLabel: '你买超卖的等反弹', humanDesc: 'RSI<30是超卖区，可以买入等反弹。RSI>70是超买区，可以卖出。', dontUseWhen: '强势上涨时RSI可以一直超买，别急着卖', icScore: 0.04, market: 'ALL' },
  { id: 'f18', nameEn: 'MACD_DIF', nameCn: 'MACD离差', level1: '技术形态', level2: '均线系统', humanLabel: '你看金叉买死叉卖', humanDesc: 'DIF线上穿DEA线是买入信号，下穿是卖出。经典但可靠，用日线级别。', dontUseWhen: '横盘震荡时金叉死叉频繁假信号', icScore: 0.05, market: 'ALL' },
  { id: 'f19', nameEn: 'BollingerWidth', nameCn: '布林带宽', level1: '技术形态', level2: '波动通道', humanLabel: '你看通道收窄等方向', humanDesc: '布林带宽缩小到极致时，说明股价要选方向了，准备突破交易。', dontUseWhen: '收窄不代表知道向上还是向下，要等确认', icScore: 0.03, market: 'ALL' },
  { id: 'f20', nameEn: 'ATR14', nameCn: '14日真实波幅', level1: '技术形态', level2: '波动度量', humanLabel: '你用真实波动设止损位', humanDesc: 'ATR告诉你股票每天正常波动多大。止损设在2倍ATR是最经典做法。', dontUseWhen: '不要只看ATR设止盈，利润会跑掉', icScore: 0.02, market: 'ALL' },
  // 市场情绪
  { id: 'f21', nameEn: 'PutCallRatio', nameCn: '认沽认购比', level1: '市场情绪', level2: '期权情绪', humanLabel: '你看别人怕不怕', humanDesc: 'Put/Call>1说明市场太恐惧了，反而是买入机会。Put/Call<0.7市场过于乐观。', dontUseWhen: '期权到期日前后数据会失真', icScore: 0.08, market: 'US' },
  { id: 'f22', nameEn: 'VIX', nameCn: '恐慌指数', level1: '市场情绪', level2: '波动预期', humanLabel: '你等恐慌指数飙升时买', humanDesc: 'VIX>30表示市场恐慌，是买入时机。VIX<15太平静，小心突然变盘。', dontUseWhen: 'VIX可以持续高位，别急着抄底', icScore: 0.06, market: 'US' },
  { id: 'f23', nameEn: 'NewsSentiment', nameCn: '新闻情绪', level1: '市场情绪', level2: '文本情绪', humanLabel: '你信好的就买', humanDesc: '正面新闻多的股票短期有延续性。负面新闻爆发的要躲3-5天。', dontUseWhen: '公关软文多的公司情绪是假的', icScore: 0.09, market: 'ALL' },
  { id: 'f24', nameEn: 'SocialBuzz', nameCn: '社交热度', level1: '市场情绪', level2: '社交情绪', humanLabel: '你别追太热的股票', humanDesc: '社交媒体讨论度暴增的股票，热度一退就跌。热度降温时才是买入时机。', dontUseWhen: '社交热度过热的股票，追进去就是接盘', icScore: -0.06, market: 'ALL' },
  // 宏观周期
  { id: 'f25', nameEn: 'RateSensitivity', nameCn: '利率敏感度', level1: '宏观周期', level2: '利率因子', humanLabel: '你降息时买这个', humanDesc: '对利率敏感的股票在降息周期表现好。加息周期回避这类股票。', dontUseWhen: '如果市场已经提前消化降息预期，别再追', icScore: 0.05, market: 'ALL' },
  { id: 'f26', nameEn: 'InflationHedge', nameCn: '通胀对冲', level1: '宏观周期', level2: '通胀因子', humanLabel: '你怕通胀就买它', humanDesc: '通胀上升时这类股票抗跌。大宗商品、必需消费品是天然的防御。', dontUseWhen: '通缩环境时这些股票会跑输', icScore: 0.04, market: 'ALL' },
  { id: 'f27', nameEn: 'EconomicCycle', nameCn: '经济周期位', level1: '宏观周期', level2: '周期定位', humanLabel: '你看经济在什么阶段选股', humanDesc: '复苏买周期股，过热买大宗商品，滞胀买防御，衰退买债券。', dontUseWhen: '周期判断错了全盘皆输', icScore: 0.07, market: 'ALL' },
  { id: 'f28', nameEn: 'GDPGrowth', nameCn: 'GDP增速', level1: '宏观周期', level2: '经济增速', humanLabel: '你跟着经济增速做多', humanDesc: 'GDP增速超预期的市场，股市通常有6-12个月的上升期。', dontUseWhen: 'GDP数据滞后1-3个月，市场已定价', icScore: 0.04, market: 'ALL' },
  // 行业轮动
  { id: 'f29', nameEn: 'SectorMomentum', nameCn: '行业动量', level1: '行业轮动', level2: '行业动量', humanLabel: '你买最近涨最多的行业', humanDesc: '每季度买过去3个月最强的3个行业，轮着换。机构都在用这个方法。', dontUseWhen: '行业轮动太快时（每周切换）别追', icScore: 0.10, market: 'US' },
  { id: 'f30', nameEn: 'SectorCorrelation', nameCn: '行业相关度', level1: '行业轮动', level2: '行业分散', humanLabel: '你的持仓别全是一个方向', humanDesc: '相关性>0.7的行业涨跌同步，不能分散风险。选相关度<0.3的行业搭配。', dontUseWhen: '极端行情时所有行业都高度相关', icScore: 0.03, market: 'ALL' },
  // 中国特有
  { id: 'f31', nameEn: 'NorthBoundFlow', nameCn: '北向资金', level1: '中国特有', level2: '沪深港通', humanLabel: '你跟着北向资金买', humanDesc: '北向资金连续3天净流入的股票，通常有5-10天的上涨惯性。聪明钱不骗人。', dontUseWhen: 'MSCI调整日资金异动是假的', icScore: 0.12, market: 'CN' },
  { id: 'f32', nameEn: 'MarginBalance', nameCn: '融资余额', level1: '中国特有', level2: '杠杆资金', humanLabel: '你看杠杆资金加仓了没', humanDesc: '融资余额持续增加说明有人在借钱买，信心强。但过高时要警惕撤杠杆踩踏。', dontUseWhen: '融资余额>流通市值5%时太危险', icScore: 0.07, market: 'CN' },
  { id: 'f33', nameEn: 'DragonTiger', nameCn: '龙虎榜', level1: '中国特有', level2: '游资追踪', humanLabel: '你看看游资大佬在买啥', humanDesc: '龙虎榜上榜的股票短线波动大。游资买入后第2-3天是最佳出货窗口。', dontUseWhen: '游资第二天就跑了，别等第三天', icScore: 0.06, market: 'CN' },
  { id: 'f34', nameEn: 'StateOwned', nameCn: '国企背景', level1: '中国特有', level2: '所有制', humanLabel: '你想稳就买国企', humanDesc: '央企国企估值低、分红稳、暴雷概率小。适合不喜欢刺激的你。', dontUseWhen: '国企慢，牛市跑不赢民企', icScore: 0.04, market: 'CN' },
  // 加密货币
  { id: 'f35', nameEn: 'BTC_Dominance', nameCn: '比特币主导率', level1: '加密货币', level2: '市场结构', humanLabel: '你看山寨币季到了没', humanDesc: 'BTC主导率下降时山寨币会涨。BTC统治力<50%是山寨季节信号。', dontUseWhen: 'BTC主导率低于40%时可能泡沫破裂', icScore: 0.05, market: 'CRYPTO' },
  { id: 'f36', nameEn: 'ExchangeFlow', nameCn: '交易所资金流', level1: '加密货币', level2: '链上数据', humanLabel: '你看币从交易所流出了没', humanDesc: 'BTC从交易所大量流出=囤币信号=看涨。流入=准备卖=看跌。', dontUseWhen: '交易所内部调仓会干扰数据', icScore: 0.09, market: 'CRYPTO' },
  { id: 'f37', nameEn: 'StablecoinMint', nameCn: '稳定币铸币量', level1: '加密货币', level2: '资金流入', humanLabel: '你看新钱进来了没', humanDesc: 'USDT/USDC大量增发=新资金入场=牛市前兆。最诚实的指标。', dontUseWhen: '增发到交易所账上才算，链上可能有延迟', icScore: 0.11, market: 'CRYPTO' },
  { id: 'f38', nameEn: 'OnChainVolume', nameCn: '链上交易量', level1: '加密货币', level2: '活跃度', humanLabel: '你看链上活不活跃', humanDesc: '链上交易量持续上升说明生态活跃。交易量低的时候别抄底。', dontUseWhen: '机器人刷量会干扰，只看大额真实交易', icScore: 0.06, market: 'CRYPTO' },
  // 另类数据
  { id: 'f39', nameEn: 'GoogleTrends', nameCn: '谷歌搜索趋势', level1: '另类数据', level2: '搜索数据', humanLabel: '你看大家都在搜什么', humanDesc: '搜索量暴增的股票短期可能冲高，但热度一过就跌。搜索峰值后卖出。', dontUseWhen: '搜索量高≠投资价值，别追涨停', icScore: -0.04, market: 'US' },
  { id: 'f40', nameEn: 'AppDownloads', nameCn: 'App下载量', level1: '另类数据', level2: '用户增长', humanLabel: '你看用户增长快不快', humanDesc: 'App下载量增速>50%的互联网公司处于爆发期。比财报提前3个月知道。', dontUseWhen: '下载量不代表收入，要看留存率', icScore: 0.08, market: 'US/CN' }
];

const categoryColors: Record<string, string> = {
  '动量和趋势': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  '波动与风险': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  '资金流': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  '估值': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  '技术形态': 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  '市场情绪': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  '宏观周期': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  '行业轮动': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  '事件驱动': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  '市场结构': 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  '量价关系': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  '基本面': 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
  '另类数据': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  '全球联动': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  '中国特有': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  '加密货币': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
};

/* ====== Sub-components ====== */

const ICLine = ({ val }: { val: number }) => {
  const color = val > 0.08 ? 'text-green-600' : val > 0 ? 'text-green-500' : val < -0.03 ? 'text-red-500' : 'text-gray-400';
  const width = Math.abs(val) * 500;
  const barColor = val > 0 ? 'bg-green-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(width, 100)}%` }}/>
      </div>
      <span className={`text-xs font-mono font-bold ${color}`}>{val > 0 ? '+' : ''}{val.toFixed(2)}</span>
    </div>
  );
};

const FactorCard = ({ factor, selected, onToggle }: { factor: FactorHumanized; selected: boolean; onToggle: (id: string) => void }) => {
  const catColor = categoryColors[factor.level1] || 'bg-gray-100';
  return (
    <div className={`rounded-lg border p-3 transition-all cursor-pointer ${selected ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md'}`} onClick={() => onToggle(factor.id)}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${catColor}`}>{factor.level1.slice(0, 3)}</span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{factor.humanLabel}</span>
        </div>
        <ICLine val={factor.icScore} />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
        <span>{factor.nameEn}</span>
        <span>·</span>
        <span className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">{factor.market}</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">{factor.humanDesc}</p>
      <div className="flex items-start gap-1.5 text-xs">
        <span className="text-red-400 flex-shrink-0">⚠️</span>
        <span className="text-red-500 dark:text-red-400">{factor.dontUseWhen}</span>
      </div>
    </div>
  );
};

/* ====== Main Component ====== */

export default function FactorHumanizeCard() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'ic' | 'name'>('ic');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState('ALL');

  const categories = ['ALL', ...new Set(mockFactors.map(f => f.level1))] as string[];
  const markets = ['ALL', 'US', 'CN', 'HK', 'CRYPTO'];

  const filtered = useMemo(() => {
    let list = [...mockFactors];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f => f.humanLabel.toLowerCase().includes(q) || f.humanDesc.toLowerCase().includes(q) || f.nameEn.toLowerCase().includes(q) || f.nameCn.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'ALL') list = list.filter(f => f.level1 === categoryFilter);
    if (marketFilter !== 'ALL') list = list.filter(f => f.market === marketFilter || f.market === 'ALL');
    if (sortBy === 'ic') list.sort((a, b) => Math.abs(b.icScore) - Math.abs(a.icScore));
    else list.sort((a, b) => a.humanLabel.localeCompare(b.humanLabel));
    return list;
  }, [search, categoryFilter, marketFilter, sortBy]);

  const toggleFactor = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">🧬 因子超市</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mockFactors.length} 个因子 · {categories.length - 1} 大类 · 人话版
              {selectedIds.size > 0 && <span className="ml-2 text-blue-600 font-semibold">· 已选 {selectedIds.size} 个</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSortBy(sortBy === 'ic' ? 'name' : 'ic')} className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 hover:bg-gray-200">
              {sortBy === 'ic' ? '按IC↓' : '按名称'}
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={'搜因子，用人话说... (如 跟大资金 抄底 降息)'} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400" />
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {categories.slice(0, 10).map(c => (
          <button key={c} onClick={() => { setCategoryFilter(c); setExpandedCategory(c); }} className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${categoryFilter === c ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {c === 'ALL' ? '全部' : c}
          </button>
        ))}
        {categories.length > 10 && <button className="px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-600">+{categories.length - 10}更多</button>}
      </div>

      {/* Market Filter */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 dark:bg-gray-850 border-b border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-400 flex-shrink-0">市场:</span>
        {markets.map(m => (
          <button key={m} onClick={() => setMarketFilter(m)} className={`px-2 py-0.5 rounded text-xs font-medium ${marketFilter === m ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Selected Bar */}
      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
          <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">✅ 已选 {selectedIds.size} 个因子</span>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs text-blue-600 hover:text-blue-800 underline">清空选择</button>
        </div>
      )}

      {/* Factor Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-sm font-medium">没找到匹配的因子</p>
            <p className="text-xs mt-1">换个词试试，比如 "跟大资金" "抄底" "分红"</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-2">{filtered.length} 个因子</p>
            {filtered.map(f => <FactorCard key={f.id} factor={f} selected={selectedIds.has(f.id)} onToggle={toggleFactor} />)}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-400 flex items-center gap-2">
        <span>💡</span>
        <span>选择 3-5 个因子组合使用效果最好。IC 越高选股越准。</span>
      </div>
    </div>
  );
}
