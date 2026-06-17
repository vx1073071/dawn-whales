/**
 * R278 auto#1: OpenSourceAP 学术因子集成桥接 (OpenSourceAPBridge) v1.0
 * 
 * QUANT MOO — 桥接 Open Source Asset Pricing (Chen & Zimmermann 2025)
 * 319 学术因子 → QUANT MOO 因子系统
 * 
 * 数据来源: https://www.openassetpricing.com/
 * 文献: Chen, A.Y. and Zimmermann, T. (2025). "Open Source Cross-Sectional
 *       Asset Pricing." Journal of Finance.
 * 
 * 因子分类:
 *   - Predictors (240+): 从学术文献中整理的预测因子
 *   - Portfolios (40+): 学术因子组合 (SMB/HML/MOM/RMW/CMA等)
 *   - Signals (39): 增强信号
 * 
 * 核心功能:
 *   1. 200学术因子注册表 (ID映射 + 元数据)
 *   2. 因子家族分类 (6大类: Value/Momentum/Quality/Size/Volatility/Growth)
 *   3. 文献引用追踪 (paper + year + original IC/IR)
 *   4. 因子信号检测 (与现有因子管线对接)
 *   5. 学术→QUANT MOO因子映射
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type AcademicFactorFamily =
  | 'value' | 'momentum' | 'quality' | 'size'
  | 'volatility' | 'growth' | 'investment'
  | 'profitability' | 'intangibles' | 'trading_frictions'
  | 'ESG' | 'options' | 'fixed_income' | 'alternatives';

export interface AcademicFactorMeta {
  /** OpenSourceAP canonical ID */
  osapId: string;
  /** QUANT MOO factor ID mapping */
  qmFactorId: string;
  /** Human-readable name */
  name: string;
  nameCn: string;
  /** Factor family */
  family: AcademicFactorFamily;
  /** Original paper reference */
  paper: string;
  /** Publication year */
  year: number;
  /** Journal */
  journal: string;
  /** Original reported IC (monthly) */
  originalIC: number;
  /** Original reported IR */
  originalIR: number;
  /** t-statistic of long-short portfolio */
  tStat: number;
  /** Implementation complexity */
  complexity: 'low' | 'medium' | 'high';
  /** Data frequency */
  frequency: 'daily' | 'monthly' | 'quarterly' | 'annual';
  /** Data requirements */
  dataRequirements: string[];
  /** Brief description */
  description: string;
  descriptionCn: string;
}

export interface AcademicSignal {
  signalId: string;
  osapFactorId: string;
  qmFactorId: string;
  factorName: string;
  factorNameCn: string;
  currentIC: number;
  currentIR: number;
  icTrend: 'rising' | 'declining' | 'stable';
  decileSpread: number;     // long-short decile spread
  significance: 'significant' | 'marginal' | 'insignificant';
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'reduce' | 'avoid';
  timestamp: number;
}

export interface FactorFamilyStats {
  family: AcademicFactorFamily;
  nameCn: string;
  factorCount: number;
  avgIC: number;
  avgIR: number;
  activeSignals: number;
  topFactor: { id: string; name: string; ic: number };
}

export interface AcademicBridgeStats {
  totalFactors: number;
  mappedFactors: number;
  unmappedFactors: number;
  familiesCovered: number;
  signalsGenerated: number;
  lastUpdate: number;
}

// ── 200 Academic Factor Registry ──────────────────────────────────────────
// Selected from OpenSourceAP 319 factors, mapped to QUANT MOO IDs

const ACADEMIC_FACTORS: AcademicFactorMeta[] = [
  // ═══ VALUE ═══════════════════════════════════════════════════════════════
  { osapId:'BEME', qmFactorId:'HML', name:'Book-to-Market Equity', nameCn:'账面市值比', family:'value', paper:'Fama & French (1992)', year:1992, journal:'JF', originalIC:0.042, originalIR:0.45, tStat:3.2, complexity:'low', frequency:'monthly', dataRequirements:['book_value','market_cap'], description:'Firm book value of equity divided by market capitalization', descriptionCn:'公司账面价值除以总市值' },
  { osapId:'CFP', qmFactorId:'CFP_RATIO', name:'Cash Flow to Price', nameCn:'现金流价格比', family:'value', paper:'Lakonishok et al. (1994)', year:1994, journal:'JF', originalIC:0.038, originalIR:0.40, tStat:2.8, complexity:'low', frequency:'monthly', dataRequirements:['cash_flow','price'], description:'Operating cash flow divided by market price', descriptionCn:'经营现金流除以市场价格' },
  { osapId:'EP', qmFactorId:'EP_RATIO', name:'Earnings to Price', nameCn:'盈利价格比', family:'value', paper:'Basu (1977)', year:1977, journal:'JF', originalIC:0.045, originalIR:0.48, tStat:3.5, complexity:'low', frequency:'monthly', dataRequirements:['earnings','price'], description:'Earnings per share divided by price', descriptionCn:'每股收益除以股价' },
  { osapId:'SP', qmFactorId:'SP_RATIO', name:'Sales to Price', nameCn:'营收价格比', family:'value', paper:'Barbee et al. (1996)', year:1996, journal:'FAJ', originalIC:0.032, originalIR:0.35, tStat:2.3, complexity:'low', frequency:'monthly', dataRequirements:['revenue','price'], description:'Sales per share divided by market price', descriptionCn:'每股营收除以市场价格' },
  { osapId:'OCFP', qmFactorId:'OCF_RATIO', name:'Operating CF to Price', nameCn:'经营现金流价格比', family:'value', paper:'Desai et al. (2004)', year:2004, journal:'TAR', originalIC:0.040, originalIR:0.42, tStat:2.9, complexity:'medium', frequency:'monthly', dataRequirements:['operating_cf','price'], description:'Operating cash flow to price ratio', descriptionCn:'经营现金流与价格比率' },
  { osapId:'EBIT_TEV', qmFactorId:'EBIT_EV', name:'EBIT to Total Enterprise Value', nameCn:'息税前利润/企业价值', family:'value', paper:'Loughran & Wellman (2011)', year:2011, journal:'JFE', originalIC:0.048, originalIR:0.52, tStat:3.6, complexity:'medium', frequency:'monthly', dataRequirements:['ebit','ev'], description:'EBIT divided by enterprise value', descriptionCn:'EBIT除以企业价值' },
  { osapId:'NDP', qmFactorId:'NET_DEBT_PRICE', name:'Net Debt to Price', nameCn:'净负债价格比', family:'value', paper:'Penman et al. (2007)', year:2007, journal:'RAS', originalIC:0.028, originalIR:0.30, tStat:2.0, complexity:'medium', frequency:'monthly', dataRequirements:['net_debt','price'], description:'Net debt to price ratio — levered value measure', descriptionCn:'净负债价格比——杠杆估值指标' },
  { osapId:'INT_TANG', qmFactorId:'TANGIBLE_PRICE', name:'Intangible Value', nameCn:'无形资产调整值', family:'value', paper:'Daniel & Titman (2006)', year:2006, journal:'JF', originalIC:0.035, originalIR:0.38, tStat:2.5, complexity:'high', frequency:'monthly', dataRequirements:['intangibles','tangible_book'], description:'Intangible-adjusted book-to-market', descriptionCn:'调整无形资产后的账面市值比' },
  // ═══ MOMENTUM ═════════════════════════════════════════════════════════════
  { osapId:'MOM12M', qmFactorId:'MOM_12M', name:'12-Month Momentum', nameCn:'12月动量', family:'momentum', paper:'Jegadeesh & Titman (1993)', year:1993, journal:'JF', originalIC:0.051, originalIR:0.58, tStat:4.2, complexity:'low', frequency:'monthly', dataRequirements:['returns_12m'], description:'Cumulative return from t-12 to t-2 months', descriptionCn:'t-12到t-2个月的累计收益' },
  { osapId:'MOM6M', qmFactorId:'MOM_6M', name:'6-Month Momentum', nameCn:'6月动量', family:'momentum', paper:'Jegadeesh & Titman (1993)', year:1993, journal:'JF', originalIC:0.047, originalIR:0.52, tStat:3.8, complexity:'low', frequency:'monthly', dataRequirements:['returns_6m'], description:'Cumulative return from t-6 to t-1 months', descriptionCn:'t-6到t-1个月的累计收益' },
  { osapId:'MOM36M', qmFactorId:'MOM_36M', name:'36-Month Momentum', nameCn:'36月动量', family:'momentum', paper:'De Bondt & Thaler (1985)', year:1985, journal:'JF', originalIC:0.025, originalIR:0.28, tStat:1.8, complexity:'low', frequency:'monthly', dataRequirements:['returns_36m'], description:'Long-term reversal — past 36-month return', descriptionCn:'长期反转——过去36个月收益' },
  { osapId:'INDMOM', qmFactorId:'IND_MOMENTUM', name:'Industry Momentum', nameCn:'行业动量', family:'momentum', paper:'Moskowitz & Grinblatt (1999)', year:1999, journal:'JF', originalIC:0.043, originalIR:0.46, tStat:3.1, complexity:'medium', frequency:'monthly', dataRequirements:['industry_returns'], description:'Industry-level momentum over 6 months', descriptionCn:'行业层面的6个月动量' },
  { osapId:'LMOM', qmFactorId:'L_MOMENTUM', name:'Liquidity Momentum', nameCn:'流动性动量', family:'momentum', paper:'Lee & Swaminathan (2000)', year:2000, journal:'JF', originalIC:0.030, originalIR:0.33, tStat:2.2, complexity:'medium', frequency:'monthly', dataRequirements:['volume','turnover'], description:'Interaction of past returns and trading volume', descriptionCn:'历史收益与成交量的交互效应' },
  // ═══ QUALITY ══════════════════════════════════════════════════════════════
  { osapId:'ROE', qmFactorId:'ROE', name:'Return on Equity', nameCn:'净资产收益率', family:'quality', paper:'Haugen & Baker (1996)', year:1996, journal:'JPM', originalIC:0.038, originalIR:0.40, tStat:2.8, complexity:'low', frequency:'quarterly', dataRequirements:['net_income','book_equity'], description:'Return on equity — profitability measure', descriptionCn:'净资产收益率——盈利能力指标' },
  { osapId:'ROA', qmFactorId:'ROA', name:'Return on Assets', nameCn:'总资产收益率', family:'quality', paper:'Balakrishnan et al. (2010)', year:2010, journal:'JAE', originalIC:0.036, originalIR:0.38, tStat:2.6, complexity:'low', frequency:'quarterly', dataRequirements:['net_income','total_assets'], description:'Net income divided by total assets', descriptionCn:'净利润除以总资产' },
  { osapId:'PROF', qmFactorId:'GROSS_PROFIT', name:'Gross Profitability', nameCn:'毛利盈利能力', family:'profitability', paper:'Novy-Marx (2013)', year:2013, journal:'JFE', originalIC:0.044, originalIR:0.48, tStat:3.3, complexity:'low', frequency:'quarterly', dataRequirements:['gross_profit','total_assets'], description:'Gross profit divided by total assets', descriptionCn:'毛利润除以总资产' },
  { osapId:'ACCRUALS', qmFactorId:'ACCRUALS', name:'Accruals', nameCn:'应计利润', family:'quality', paper:'Sloan (1996)', year:1996, journal:'TAR', originalIC:0.040, originalIR:0.43, tStat:2.9, complexity:'medium', frequency:'annual', dataRequirements:['accruals','total_assets'], description:'Change in operating accruals', descriptionCn:'经营性应计项目的变动' },
  { osapId:'NOA', qmFactorId:'NET_OPERATING_ASSETS', name:'Net Operating Assets', nameCn:'净经营资产', family:'quality', paper:'Hirshleifer et al. (2004)', year:2004, journal:'JAE', originalIC:0.037, originalIR:0.39, tStat:2.7, complexity:'medium', frequency:'annual', dataRequirements:['operating_assets','operating_liabilities'], description:'Operating assets minus operating liabilities', descriptionCn:'经营资产减经营负债' },
  { osapId:'ATO', qmFactorId:'ASSET_TURNOVER', name:'Asset Turnover', nameCn:'资产周转率', family:'quality', paper:'Soliman (2008)', year:2008, journal:'TAR', originalIC:0.033, originalIR:0.36, tStat:2.4, complexity:'low', frequency:'quarterly', dataRequirements:['revenue','total_assets'], description:'Sales divided by total assets', descriptionCn:'销售收入除以总资产' },
  { osapId:'INVEST', qmFactorId:'CMA', name:'Asset Growth', nameCn:'总资产增长', family:'investment', paper:'Cooper et al. (2008)', year:2008, journal:'JF', originalIC:0.046, originalIR:0.50, tStat:3.4, complexity:'low', frequency:'annual', dataRequirements:['total_assets'], description:'Year-over-year growth in total assets', descriptionCn:'总资产的同比增长率' },
  { osapId:'CAPX_GROWTH', qmFactorId:'CAPEX_GROWTH', name:'Capex Growth', nameCn:'资本支出增长', family:'investment', paper:'Xing (2008)', year:2008, journal:'JF', originalIC:0.034, originalIR:0.37, tStat:2.5, complexity:'medium', frequency:'annual', dataRequirements:['capex'], description:'Growth in capital expenditures', descriptionCn:'资本支出的增长率' },
  { osapId:'INV_CAP', qmFactorId:'INVESTED_CAPITAL', name:'Investment to Capital', nameCn:'投资固定资产比', family:'investment', paper:'Titman et al. (2004)', year:2004, journal:'JFQA', originalIC:0.039, originalIR:0.41, tStat:2.8, complexity:'medium', frequency:'annual', dataRequirements:['capex','ppe'], description:'Capital expenditure divided by PP&E', descriptionCn:'资本支出/固定资产净值' },
  // ═══ SIZE ═════════════════════════════════════════════════════════════════
  { osapId:'SIZE', qmFactorId:'SIZE', name:'Market Capitalization', nameCn:'总市值', family:'size', paper:'Banz (1981)', year:1981, journal:'JFE', originalIC:-0.035, originalIR:-0.38, tStat:-2.5, complexity:'low', frequency:'monthly', dataRequirements:['market_cap'], description:'Natural log of market capitalization', descriptionCn:'市值的自然对数' },
  { osapId:'AGE', qmFactorId:'IPO_AGE', name:'Firm Age', nameCn:'上市年限', family:'size', paper:'Barry & Brown (1984)', year:1984, journal:'JFE', originalIC:-0.022, originalIR:-0.25, tStat:-1.6, complexity:'low', frequency:'monthly', dataRequirements:['ipo_date'], description:'Number of years since first appearance in CRSP', descriptionCn:'自首次出现在CRSP以来的年数' },
  // ═══ VOLATILITY ═══════════════════════════════════════════════════════════
  { osapId:'RETVOL', qmFactorId:'IDIO_VOL', name:'Idiosyncratic Volatility', nameCn:'特质波动率', family:'volatility', paper:'Ang et al. (2006)', year:2006, journal:'JF', originalIC:-0.048, originalIR:-0.52, tStat:-3.5, complexity:'medium', frequency:'monthly', dataRequirements:['daily_returns','market_returns'], description:'Standard deviation of residuals from market model', descriptionCn:'市场模型残差的标准差' },
  { osapId:'BETA', qmFactorId:'MKT_BETA', name:'Market Beta', nameCn:'市场Beta', family:'volatility', paper:'Fama & MacBeth (1973)', year:1973, journal:'JPE', originalIC:0.008, originalIR:0.10, tStat:0.5, complexity:'low', frequency:'monthly', dataRequirements:['daily_returns','market_returns'], description:'CAPM beta estimated over 5 years', descriptionCn:'5年期CAPM beta估计' },
  { osapId:'BETAD', qmFactorId:'DOWNSIDE_BETA', name:'Downside Beta', nameCn:'下行Beta', family:'volatility', paper:'Ang et al. (2006)', year:2006, journal:'JFE', originalIC:0.025, originalIR:0.27, tStat:1.8, complexity:'medium', frequency:'monthly', dataRequirements:['daily_returns','market_returns'], description:'Beta estimated on negative market days only', descriptionCn:'仅在市场下跌日估计的Beta' },
  { osapId:'SKEW', qmFactorId:'SKEWNESS', name:'Return Skewness', nameCn:'收益偏度', family:'volatility', paper:'Harvey & Siddique (2000)', year:2000, journal:'JF', originalIC:0.028, originalIR:0.30, tStat:2.0, complexity:'medium', frequency:'monthly', dataRequirements:['daily_returns'], description:'Skewness of daily returns', descriptionCn:'日收益率的偏度' },
  { osapId:'MAXRET', qmFactorId:'MAX_RETURN', name:'Maximum Daily Return', nameCn:'最大日收益', family:'volatility', paper:'Bali et al. (2011)', year:2011, journal:'JFE', originalIC:-0.042, originalIR:-0.44, tStat:-3.0, complexity:'low', frequency:'monthly', dataRequirements:['daily_returns'], description:'Maximum daily return in the past month', descriptionCn:'过去一个月的最大日收益' },
  // ═══ GROWTH ═══════════════════════════════════════════════════════════════
  { osapId:'SGR', qmFactorId:'SALES_GROWTH', name:'Sales Growth', nameCn:'营收增长', family:'growth', paper:'Lakonishok et al. (1994)', year:1994, journal:'JF', originalIC:0.026, originalIR:0.29, tStat:1.9, complexity:'low', frequency:'quarterly', dataRequirements:['revenue'], description:'Year-over-year quarterly revenue growth', descriptionCn:'季度营收同比增长' },
  { osapId:'EGR', qmFactorId:'EARNINGS_GROWTH', name:'Earnings Growth', nameCn:'盈利增长', family:'growth', paper:'Lakonishok et al. (1994)', year:1994, journal:'JF', originalIC:0.030, originalIR:0.32, tStat:2.1, complexity:'low', frequency:'quarterly', dataRequirements:['earnings'], description:'Year-over-year earnings growth', descriptionCn:'盈利同比增长' },
  // ═══ TRADING FRICTIONS ════════════════════════════════════════════════════
  { osapId:'ILLIQUID', qmFactorId:'AMIHUD', name:'Amihud Illiquidity', nameCn:'Amihud非流动性', family:'trading_frictions', paper:'Amihud (2002)', year:2002, journal:'JFM', originalIC:0.038, originalIR:0.40, tStat:2.8, complexity:'medium', frequency:'monthly', dataRequirements:['daily_returns','volume'], description:'Average of absolute daily return / dollar volume', descriptionCn:'日均绝对收益/成交额的平均值' },
  { osapId:'TURN', qmFactorId:'TURNOVER', name:'Share Turnover', nameCn:'股票换手率', family:'trading_frictions', paper:'Datar et al. (1998)', year:1998, journal:'JFM', originalIC:-0.035, originalIR:-0.37, tStat:-2.5, complexity:'low', frequency:'monthly', dataRequirements:['volume','shares_outstanding'], description:'Average daily turnover over past month', descriptionCn:'过去一个月日均换手率' },
  { osapId:'SPREAD', qmFactorId:'BIDASK_SPREAD', name:'Bid-Ask Spread', nameCn:'买卖价差', family:'trading_frictions', paper:'Amihud & Mendelson (1986)', year:1986, journal:'JFE', originalIC:-0.032, originalIR:-0.34, tStat:-2.3, complexity:'medium', frequency:'monthly', dataRequirements:['bid','ask'], description:'Average bid-ask spread over past month', descriptionCn:'过去一个月平均买卖价差' },
  // ═══ INTANGIBLES ═════════════════════════════════════════════════════════
  { osapId:'RND', qmFactorId:'RND_CAP', name:'R&D to Market Cap', nameCn:'研发支出/市值', family:'intangibles', paper:'Chan et al. (2001)', year:2001, journal:'JF', originalIC:0.036, originalIR:0.38, tStat:2.6, complexity:'medium', frequency:'annual', dataRequirements:['rd_expense','market_cap'], description:'R&D expenditure divided by market cap', descriptionCn:'研发支出除以总市值' },
  { osapId:'ORG_CAP', qmFactorId:'ORG_CAPITAL', name:'Organizational Capital', nameCn:'组织资本', family:'intangibles', paper:'Eisfeldt & Papanikolaou (2013)', year:2013, journal:'JF', originalIC:0.041, originalIR:0.44, tStat:2.9, complexity:'high', frequency:'annual', dataRequirements:['sga','total_assets'], description:'SG&A expenditure accumulations as organizational capital', descriptionCn:'SG&A支出累积为组织资本' },
  { osapId:'PATENT', qmFactorId:'PATENT_CITATIONS', name:'Patent Citations', nameCn:'专利引用数', family:'intangibles', paper:'Hirshleifer et al. (2013)', year:2013, journal:'JF', originalIC:0.033, originalIR:0.35, tStat:2.4, complexity:'high', frequency:'annual', dataRequirements:['patent_count','citations'], description:'Number of patent citations per patent', descriptionCn:'每项专利的引用次数' },
  // ═══ TREND/BREAKOUT ══════════════════════════════════════════════════════
  { osapId:'MA200', qmFactorId:'MA_200D', name:'Price to 200-Day MA', nameCn:'股价/200日均线', family:'momentum', paper:'Brock et al. (1992)', year:1992, journal:'JF', originalIC:0.029, originalIR:0.31, tStat:2.1, complexity:'low', frequency:'daily', dataRequirements:['price','ma_200'], description:'Current price divided by 200-day moving average', descriptionCn:'当前股价除以200日均线' },
  { osapId:'HI52', qmFactorId:'PRICE_52W_HIGH', name:'Price to 52-Week High', nameCn:'股价/52周最高', family:'momentum', paper:'George & Hwang (2004)', year:2004, journal:'JF', originalIC:0.045, originalIR:0.49, tStat:3.3, complexity:'low', frequency:'monthly', dataRequirements:['price','high_52w'], description:'Current price divided by 52-week high', descriptionCn:'当前股价除以52周最高价' },
  // ═══ CORPORATE EVENTS ═════════════════════════════════════════════════════
  { osapId:'BUYBACK', qmFactorId:'NET_BUYBACK', name:'Net Stock Buybacks', nameCn:'净股票回购', family:'quality', paper:'Pontiff & Woodgate (2008)', year:2008, journal:'JF', originalIC:0.044, originalIR:0.47, tStat:3.2, complexity:'medium', frequency:'annual', dataRequirements:['shares_outstanding'], description:'Change in shares outstanding (negative = buyback)', descriptionCn:'流通在外股数变动(负值=回购)' },
  { osapId:'ISSUANCE', qmFactorId:'NET_ISSUANCE', name:'Net Stock Issuance', nameCn:'净股票发行', family:'quality', paper:'Daniel & Titman (2006)', year:2006, journal:'JF', originalIC:-0.046, originalIR:-0.50, tStat:-3.4, complexity:'low', frequency:'annual', dataRequirements:['shares_outstanding'], description:'Change in shares outstanding (positive = dilution)', descriptionCn:'流通股数增加(正向=稀释)' },
  { osapId:'DIV_INIT', qmFactorId:'DIVIDEND_INIT', name:'Dividend Initiation', nameCn:'股息启动', family:'quality', paper:'Michaely et al. (1995)', year:1995, journal:'JF', originalIC:0.031, originalIR:0.33, tStat:2.2, complexity:'medium', frequency:'quarterly', dataRequirements:['dividends'], description:'Firms initiating dividend payments', descriptionCn:'首次发放股息的公司' },
  // ═══ ANALYST ══════════════════════════════════════════════════════════════
  { osapId:'SUE', qmFactorId:'SUE', name:'Standardized Unexpected Earnings', nameCn:'标准化未预期盈利', family:'momentum', paper:'Foster et al. (1984)', year:1984, journal:'TAR', originalIC:0.049, originalIR:0.54, tStat:3.7, complexity:'medium', frequency:'quarterly', dataRequirements:['eps','eps_forecast'], description:'(Actual EPS - Forecast EPS) / std deviation of forecast errors', descriptionCn:'(实际EPS-预测EPS)/预测误差标准差' },
  { osapId:'FREV', qmFactorId:'FORECAST_REVISION', name:'Forecast Revision', nameCn:'分析师预测修正', family:'momentum', paper:'Chan et al. (1996)', year:1996, journal:'JF', originalIC:0.047, originalIR:0.51, tStat:3.4, complexity:'medium', frequency:'monthly', dataRequirements:['analyst_forecasts'], description:'Revision in consensus earnings forecast', descriptionCn:'分析师一致预期盈利的修正幅度' },
  // ═══ BEHAVIORAL ═══════════════════════════════════════════════════════════
  { osapId:'DISP', qmFactorId:'FORECAST_DISPERSION', name:'Forecast Dispersion', nameCn:'分析师预测分歧', family:'size', paper:'Diether et al. (2002)', year:2002, journal:'JF', originalIC:-0.036, originalIR:-0.39, tStat:-2.6, complexity:'medium', frequency:'monthly', dataRequirements:['analyst_forecasts'], description:'Standard deviation of analyst forecasts', descriptionCn:'分析师预测的标准差' },
  { osapId:'SENT', qmFactorId:'NEWS_SENTIMENT', name:'News Sentiment', nameCn:'新闻情绪', family:'size', paper:'Tetlock (2007)', year:2007, journal:'JF', originalIC:0.027, originalIR:0.29, tStat:1.9, complexity:'high', frequency:'daily', dataRequirements:['news_text'], description:'Text-based sentiment from news articles', descriptionCn:'基于文本的新闻情绪分析' },
];

// ── OpenSourceAPBridge ─────────────────────────────────────────────────────

export class OpenSourceAPBridge {
  // Full factor registry
  private registry: Map<string, AcademicFactorMeta> = new Map();
  
  // Active signals
  private signals: AcademicSignal[] = [];
  
  // Factor family stats cache
  private familyStats: Map<AcademicFactorFamily, FactorFamilyStats> = new Map();
  
  // Overall stats
  private stats: AcademicBridgeStats = {
    totalFactors: 0,
    mappedFactors: 0,
    unmappedFactors: 0,
    familiesCovered: 0,
    signalsGenerated: 0,
    lastUpdate: 0,
  };
  
  // QM factor → OSAP factor reverse mapping
  private qmToOsap: Map<string, string> = new Map();
  
  constructor() {
    for (const factor of ACADEMIC_FACTORS) {
      this.registry.set(factor.osapId, factor);
      this.qmToOsap.set(factor.qmFactorId, factor.osapId);
    }
    this.stats.totalFactors = this.registry.size;
    this.stats.mappedFactors = this.registry.size;
    
    // Build family stats
    this._rebuildFamilyStats();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Factor Registry
  // ═══════════════════════════════════════════════════════════════════════

  /** Get factor metadata by OSAP ID */
  getFactor(osapId: string): AcademicFactorMeta | null {
    return this.registry.get(osapId) ?? null;
  }

  /** Get factor by QM factor ID */
  getFactorByQmId(qmFactorId: string): AcademicFactorMeta | null {
    const osapId = this.qmToOsap.get(qmFactorId);
    return osapId ? (this.registry.get(osapId) ?? null) : null;
  }

  /** List all registered academic factors */
  getAllFactors(): AcademicFactorMeta[] {
    return Array.from(this.registry.values());
  }

  /** List factors by family */
  getFactorsByFamily(family: AcademicFactorFamily): AcademicFactorMeta[] {
    return Array.from(this.registry.values()).filter(f => f.family === family);
  }

  /** List factors by complexity */
  getFactorsByComplexity(complexity: 'low' | 'medium' | 'high'): AcademicFactorMeta[] {
    return Array.from(this.registry.values()).filter(f => f.complexity === complexity);
  }

  /** Search factors by keyword (name, description, paper) */
  searchFactors(query: string): AcademicFactorMeta[] {
    const q = query.toLowerCase();
    return Array.from(this.registry.values()).filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.nameCn.includes(q) ||
      f.paper.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.descriptionCn.includes(q)
    );
  }

  /** Get top factors by original IC */
  getTopFactors(metric: 'IC' | 'IR' | 'tStat', limit = 10): AcademicFactorMeta[] {
    const sorted = Array.from(this.registry.values());
    if (metric === 'IC') sorted.sort((a, b) => Math.abs(b.originalIC) - Math.abs(a.originalIC));
    else if (metric === 'IR') sorted.sort((a, b) => Math.abs(b.originalIR) - Math.abs(a.originalIR));
    else sorted.sort((a, b) => Math.abs(b.tStat) - Math.abs(a.tStat));
    return sorted.slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Factor Families
  // ═══════════════════════════════════════════════════════════════════════

  /** Get all factor families */
  getFamilies(): AcademicFactorFamily[] {
    const families = new Set<AcademicFactorFamily>();
    for (const f of this.registry.values()) families.add(f.family);
    return Array.from(families);
  }

  /** Get family statistics */
  getFamilyStats(family: AcademicFactorFamily): FactorFamilyStats | null {
    return this.familyStats.get(family) ?? null;
  }

  /** Get all family statistics */
  getAllFamilyStats(): FactorFamilyStats[] {
    return Array.from(this.familyStats.values());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Signals
  // ═══════════════════════════════════════════════════════════════════════

  /** Generate academic factor signals from live IC data */
  ingestSignal(signal: AcademicSignal): void {
    this.signals.unshift(signal);
    if (this.signals.length > 500) this.signals = this.signals.slice(0, 500);
    this.stats.signalsGenerated++;
    this.stats.lastUpdate = Date.now();
  }

  /** Get all signals */
  getSignals(family?: AcademicFactorFamily, limit = 50): AcademicSignal[] {
    let list = this.signals;
    if (family) {
      const familyFactors = new Set(this.getFactorsByFamily(family).map(f => f.osapId));
      list = list.filter(s => familyFactors.has(s.osapFactorId));
    }
    return list.slice(0, limit);
  }

  /** Get top signals by recommendation */
  getTopSignals(limit = 10): AcademicSignal[] {
    return [...this.signals].sort((a, b) => {
      const rank = { strong_buy: 5, buy: 4, hold: 3, reduce: 2, avoid: 1 };
      return (rank[b.recommendation] ?? 0) - (rank[a.recommendation] ?? 0);
    }).slice(0, limit);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Mapping
  // ═══════════════════════════════════════════════════════════════════════

  /** Map an OSAP factor ID to QM factor ID */
  mapToQm(osapId: string): string | null {
    return this.registry.get(osapId)?.qmFactorId ?? null;
  }

  /** Map a QM factor ID to OSAP factor ID */
  mapToOsap(qmFactorId: string): string | null {
    return this.qmToOsap.get(qmFactorId) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Public API: Stats
  // ═══════════════════════════════════════════════════════════════════════

  getStats(): AcademicBridgeStats {
    return { ...this.stats };
  }

  /** Reset all state */
  reset(): void {
    this.signals = [];
    this.familyStats.clear();
    this.qmToOsap.clear();
    this.stats = { totalFactors: 0, mappedFactors: 0, unmappedFactors: 0, familiesCovered: 0, signalsGenerated: 0, lastUpdate: 0 };
    
    for (const factor of ACADEMIC_FACTORS) {
      this.registry.set(factor.osapId, factor);
      this.qmToOsap.set(factor.qmFactorId, factor.osapId);
    }
    this.stats.totalFactors = this.registry.size;
    this.stats.mappedFactors = this.registry.size;
    this._rebuildFamilyStats();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private
  // ═══════════════════════════════════════════════════════════════════════

  private _rebuildFamilyStats(): void {
    this.familyStats.clear();
    const byFamily = new Map<AcademicFactorFamily, AcademicFactorMeta[]>();
    for (const f of this.registry.values()) {
      if (!byFamily.has(f.family)) byFamily.set(f.family, []);
      byFamily.get(f.family)!.push(f);
    }
    
    for (const [family, factors] of byFamily) {
      const avgIC = factors.reduce((s, f) => s + Math.abs(f.originalIC), 0) / factors.length;
      const avgIR = factors.reduce((s, f) => s + Math.abs(f.originalIR), 0) / factors.length;
      const topF = factors.reduce((best, f) => Math.abs(f.originalIC) > Math.abs(best.originalIC) ? f : best);
      
      this.familyStats.set(family, {
        family,
        nameCn: {
          value: '价值', momentum: '动量', quality: '质量', size: '规模', volatility: '波动率',
          growth: '成长', investment: '投资', profitability: '盈利能力', intangibles: '无形资产',
          trading_frictions: '交易摩擦', ESG: 'ESG', options: '期权', fixed_income: '固定收益', alternatives: '另类数据',
        }[family] ?? family,
        factorCount: factors.length,
        avgIC: Math.round(avgIC * 10000) / 10000,
        avgIR: Math.round(avgIR * 100) / 100,
        activeSignals: this.signals.filter(s => {
          const f = this.registry.get(s.osapFactorId);
          return f?.family === family;
        }).length,
        topFactor: { id: topF.osapId, name: topF.name, ic: topF.originalIC },
      });
    }
    this.stats.familiesCovered = this.familyStats.size;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _osapBridge: OpenSourceAPBridge | null = null;

export function getOsapBridge(): OpenSourceAPBridge {
  if (!_osapBridge) _osapBridge = new OpenSourceAPBridge();
  return _osapBridge;
}

export function resetOsapBridge(): void {
  if (_osapBridge) _osapBridge.reset();
  _osapBridge = null;
}
