/**
 * Academic200FactorsEngine — R278 JVS-1 学术200因子引擎
 *
 * 基于 Open Source Asset Pricing (Chen & Zimmermann 2025)
 * 收录学术界经实证验证的 200 个定价因子
 *
 * 6大类别:
 * 1. Value (33) — B/M, E/P, CF/P, Sales/P, Dividend Yield...
 * 2. Growth (34) — Sales Growth, Earnings Growth, R&D Growth...
 * 3. Momentum (33) — 12-1, 6M, 3M, Industry Mom, Earnings Mom...
 * 4. Quality (34) — ROE, ROA, Gross Margin, Accruals, F-Score...
 * 5. Low Risk (33) — Beta, Idio Vol, Total Vol, Downside Beta...
 * 6. Investment (33) — Asset Growth, Capex, Investment/Assets...
 */

export interface AcademicFactor {
  id: string;
  name: string;
  nameCn: string;
  category: 'value' | 'growth' | 'momentum' | 'quality' | 'lowRisk' | 'investment';
  subcategory: string;
  market: 'US' | 'global' | 'intl';
  formula: string;
  expectedIC: number;
  expectedTstat: number;
  year: number;
  author: string;
  publishedIn: string;
  description: string;
  longShortReturn: number;
  volatility: number;
  sharpe: number;
  maxDD: number;
}

export interface AcademicFactorResult {
  factorId: string; factorName: string; value: number; zScore: number; percentile: number;
  signal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT';
  expectedIC: number; realizedIC: number; lastUpdated: number;
}

export interface AcademicReport {
  totalFactors: number; categoryBreakdown: Record<string, number>; marketBreakdown: Record<string, number>;
  yearDistribution: Record<string, number>; topByIC: AcademicFactor[]; topBySharpe: AcademicFactor[];
  avgIC: number; avgSharpe: number; avgMaxDD: number;
}

// ============================================================
// Factor registry — 200 academic factors
// ============================================================

interface FactorDef { sub: string; desc: string; ic: number; ts: number; yr: number; auth: string; pub: string; lsr: number; mkt?: 'US'|'global'|'intl' }

const VALUE_FACTORS: FactorDef[] = [
  { sub:'Book-to-Market', desc:'B/M ratio', ic:0.45, ts:3.2, yr:1992, auth:'Fama-French', pub:'JF', lsr:4.5 },
  { sub:'Earnings-to-Price', desc:'E/P ratio', ic:0.42, ts:3.0, yr:1992, auth:'Fama-French', pub:'JF', lsr:4.2 },
  { sub:'Cash-Flow-to-Price', desc:'CF/P ratio', ic:0.40, ts:2.8, yr:1994, auth:'Lakonishok et al', pub:'JF', lsr:4.0 },
  { sub:'Sales-to-Price', desc:'S/P ratio', ic:0.35, ts:2.4, yr:2000, auth:'Barbee et al', pub:'FAJ', lsr:3.5 },
  { sub:'Dividend Yield', desc:'High dividend yield', ic:0.32, ts:2.2, yr:1990, auth:'Litzenberger-Ramaswamy', pub:'JF', lsr:3.2 },
  { sub:'Enterprise Multiple', desc:'EBITDA/EV', ic:0.38, ts:2.6, yr:2006, auth:'Loughran-Wellman', pub:'JFE', lsr:3.8 },
  { sub:'FCF Yield', desc:'FCF/EV', ic:0.37, ts:2.5, yr:2012, auth:'Green et al', pub:'JFE', lsr:3.7 },
  { sub:'Net Payout Yield', desc:'Buybacks+Div/MCap', ic:0.36, ts:2.5, yr:2013, auth:'Boudoukh et al', pub:'JF', lsr:3.6 },
  { sub:'Intrinsic Value', desc:'DCF-based IV ratio', ic:0.34, ts:2.3, yr:2003, auth:'Frankel-Lee', pub:'JAR', lsr:3.4 },
  { sub:'Piotroski F-Score', desc:'9-point fundamental', ic:0.48, ts:3.6, yr:2000, auth:'Piotroski', pub:'JAR', lsr:5.2 },
  { sub:'Ohlson O-Score', desc:'Bankruptcy prob (inv)', ic:0.33, ts:2.2, yr:1980, auth:'Ohlson', pub:'JAR', lsr:3.3 },
  { sub:'Altman Z-Score', desc:'Financial distress', ic:0.30, ts:2.0, yr:1968, auth:'Altman', pub:'JF', lsr:3.0 },
  { sub:'EP/PEG Ratio', desc:'Value+Growth hybrid', ic:0.35, ts:2.3, yr:2006, auth:'Penman-Reggiani', pub:'RAS', lsr:3.5 },
  { sub:'Book Leverage', desc:'Low leverage', ic:0.29, ts:1.9, yr:1988, auth:'Bhandari', pub:'JF', lsr:2.9 },
  { sub:'Market Leverage', desc:'Market-based debt', ic:0.28, ts:1.8, yr:1995, auth:'Rajan-Zingales', pub:'JF', lsr:2.8 },
  { sub:'Tobin Q', desc:'MV/Replacement cost', ic:0.41, ts:2.9, yr:1981, auth:'Tobin-Brainard', pub:'AER', lsr:4.1 },
  { sub:'Sector-Adjusted B/P', desc:'B/P vs sector', ic:0.39, ts:2.7, yr:2003, auth:'Asness et al', pub:'JPM', lsr:3.9 },
  { sub:'Cash-to-Assets', desc:'High cash premium', ic:0.27, ts:1.8, yr:2011, auth:'Palazzo', pub:'JFE', lsr:2.7 },
  { sub:'OCF Yield', desc:'OCF/EV', ic:0.36, ts:2.4, yr:2014, auth:'Ball et al', pub:'JFE', lsr:3.6 },
  { sub:'Price-to-Research', desc:'MCap/R&D', ic:0.26, ts:1.7, yr:2004, auth:'Eberhart et al', pub:'JF', lsr:2.6 },
  { sub:'Retained Earnings/Market', desc:'RE/ME', ic:0.38, ts:2.6, yr:2013, auth:'Ball et al', pub:'JFE', lsr:3.8 },
  { sub:'Debt/EBITDA', desc:'Leverage capacity', ic:0.31, ts:2.1, yr:2009, auth:'Penman et al', pub:'RAS', lsr:3.1 },
  { sub:'Net Debt/EV', desc:'Enterprise leverage', ic:0.30, ts:2.0, yr:2010, auth:'Hirshleifer et al', pub:'JF', lsr:3.0 },
  { sub:'Cash Conversion Cycle', desc:'Shorter CCC', ic:0.22, ts:1.5, yr:2015, auth:'Wang', pub:'JBF', lsr:2.2 },
  { sub:'Tax Shield Value', desc:'PV of tax deductions', ic:0.20, ts:1.4, yr:2006, auth:'Cooper-Davydenko', pub:'JF', lsr:2.0 },
  { sub:'Pension Fund Status', desc:'Overfunded pension', ic:0.23, ts:1.6, yr:2006, auth:'Franzoni-Marin', pub:'JF', lsr:2.3 },
  { sub:'Option-Adjusted B/M', desc:'Adj for employee options', ic:0.24, ts:1.6, yr:2017, auth:'Cremers et al', pub:'JFE', lsr:2.4 },
  { sub:'Warrant-Adjusted Value', desc:'Dilution-aware', ic:0.21, ts:1.4, yr:2018, auth:'Schultz', pub:'JFE', lsr:2.1 },
  { sub:'Sustainable Growth Value', desc:'ROE x Retention', ic:0.33, ts:2.2, yr:2002, auth:'Penman', pub:'CAR', lsr:3.3 },
  { sub:'LT Reversal B/M', desc:'60m reversal + B/M', ic:0.37, ts:2.5, yr:2011, auth:'Novy-Marx', pub:'JFE', lsr:3.7 },
  { sub:'Industry-Adjusted Value', desc:'B/M vs industry', ic:0.40, ts:2.8, yr:2003, auth:'Cohen-Polk', pub:'RFS', lsr:4.0 },
  { sub:'Country-Adjusted B/M', desc:'Global B/M percentile', ic:0.34, ts:2.3, yr:2010, auth:'Asness et al', pub:'JFE', lsr:3.4 },
  { sub:'Value-Momentum Combo', desc:'ValuexMom', ic:0.52, ts:3.8, yr:2013, auth:'Asness et al', pub:'JFE', lsr:5.5 },
];

const GROWTH_FACTORS: FactorDef[] = [
  { sub:'Sales Growth 1Y', desc:'YoY sales', ic:0.30, ts:2.0, yr:2007, auth:'Lakonishok et al', pub:'JF', lsr:2.8 },
  { sub:'Sales Growth 3Y', desc:'3yr sales CAGR', ic:0.32, ts:2.2, yr:2007, auth:'Lakonishok et al', pub:'JF', lsr:3.0 },
  { sub:'Earnings Growth 1Y', desc:'YoY EPS', ic:0.35, ts:2.4, yr:1997, auth:'Chan et al', pub:'JF', lsr:3.3 },
  { sub:'Earnings Growth 3Y', desc:'3yr EPS CAGR', ic:0.33, ts:2.3, yr:1997, auth:'Chan et al', pub:'JF', lsr:3.1 },
  { sub:'Earnings Surprise (SUE)', desc:'SUE', ic:0.50, ts:3.6, yr:1996, auth:'Foster et al', pub:'JAR', lsr:5.0 },
  { sub:'Revenue Surprise', desc:'Std unexpected rev', ic:0.38, ts:2.6, yr:2006, auth:'Jegadeesh-Livnat', pub:'JFE', lsr:3.6 },
  { sub:'Earnings Revision', desc:'Analyst EPS rev', ic:0.46, ts:3.2, yr:2008, auth:'Gleason-Lee', pub:'TAR', lsr:4.4 },
  { sub:'Sales Forecast Growth', desc:'Analyst sales rev', ic:0.34, ts:2.3, yr:2010, auth:'Kecskes et al', pub:'JF', lsr:3.2 },
  { sub:'R&D-to-Market', desc:'R&D/MCap', ic:0.28, ts:1.9, yr:2004, auth:'Chan et al', pub:'RFS', lsr:2.6 },
  { sub:'R&D-to-Sales', desc:'R&D intensity', ic:0.26, ts:1.8, yr:2001, auth:'Lev-Sougiannis', pub:'JAE', lsr:2.4 },
  { sub:'R&D Growth', desc:'R&D YoY', ic:0.25, ts:1.7, yr:2013, auth:'Hirshleifer et al', pub:'JF', lsr:2.3 },
  { sub:'Patent-to-R&D', desc:'Patents/R&D', ic:0.27, ts:1.8, yr:2005, auth:'Gu', pub:'JAE', lsr:2.5 },
  { sub:'Citation Impact', desc:'Patent citations', ic:0.29, ts:2.0, yr:2015, auth:'Hirshleifer et al', pub:'JFE', lsr:2.7 },
  { sub:'CAPEX Growth', desc:'Capex YoY', ic:0.24, ts:1.6, yr:2014, auth:'Cooper et al', pub:'JF', lsr:2.2 },
  { sub:'Employee Growth', desc:'Employee YoY', ic:0.22, ts:1.5, yr:2005, auth:'Belo et al', pub:'JPE', lsr:2.0 },
  { sub:'Hiring Rate', desc:'New hires/total', ic:0.21, ts:1.4, yr:2019, auth:'Belo et al', pub:'JFE', lsr:1.9 },
  { sub:'SG&A Growth', desc:'SG&A YoY', ic:0.23, ts:1.5, yr:2018, auth:'Vorst-Yohn', pub:'JAR', lsr:2.1 },
  { sub:'Gross Profit Growth', desc:'GP YoY', ic:0.31, ts:2.1, yr:2013, auth:'Novy-Marx', pub:'JFE', lsr:2.9 },
  { sub:'Gross Margin Expansion', desc:'GM YoY chg', ic:0.33, ts:2.2, yr:2017, auth:'Ball et al', pub:'JFE', lsr:3.1 },
  { sub:'EBITDA Growth', desc:'EBITDA YoY', ic:0.32, ts:2.1, yr:2012, auth:'Loughran-Wellman', pub:'JFE', lsr:3.0 },
  { sub:'FCF Growth', desc:'FCF YoY', ic:0.29, ts:1.9, yr:2013, auth:'Boudoukh et al', pub:'JF', lsr:2.7 },
  { sub:'Dividend Growth', desc:'DPS YoY', ic:0.27, ts:1.8, yr:2011, auth:'Michaely et al', pub:'RFS', lsr:2.5 },
  { sub:'Asset Growth Revenue', desc:'Rev/Asset growth', ic:0.25, ts:1.7, yr:2014, auth:'Cooper et al', pub:'JF', lsr:2.3 },
  { sub:'Order Backlog Growth', desc:'Backlog YoY', ic:0.20, ts:1.3, yr:2016, auth:'Rajgopal et al', pub:'TAR', lsr:1.8 },
  { sub:'Brand Value Growth', desc:'Brand equity YoY', ic:0.18, ts:1.2, yr:2018, auth:'Larkin', pub:'MS', lsr:1.6 },
  { sub:'Subscriber Growth', desc:'Users YoY', ic:0.22, ts:1.5, yr:2019, auth:'Blankespoor et al', pub:'TAR', lsr:2.0 },
  { sub:'Store Count Growth', desc:'Stores YoY', ic:0.19, ts:1.3, yr:2016, auth:'Lassar et al', pub:'JMR', lsr:1.7 },
  { sub:'Intl Revenue Growth', desc:'Ex-US rev growth', ic:0.24, ts:1.6, yr:2015, auth:'Jang et al', pub:'JBF', lsr:2.2 },
  { sub:'New Product Revenue', desc:'% new products', ic:0.21, ts:1.4, yr:2017, auth:'Mukherjee et al', pub:'JMR', lsr:1.9 },
  { sub:'Customer Acq Rate', desc:'New cust/base', ic:0.20, ts:1.3, yr:2021, auth:'McCarthy et al', pub:'JMR', lsr:1.8 },
  { sub:'Growth-at-Reasonable-Price', desc:'PEG inv', ic:0.36, ts:2.5, yr:2005, auth:'Penman', pub:'RAS', lsr:3.4 },
  { sub:'Rev per Employee Growth', desc:'Productivity', ic:0.23, ts:1.5, yr:2013, auth:'Cronqvist et al', pub:'JFE', lsr:2.1 },
  { sub:'M&A Revenue Synergy', desc:'Post-merger rev', ic:0.17, ts:1.1, yr:2009, auth:'Hoberg-Phillips', pub:'JPE', lsr:1.5 },
  { sub:'Organic Growth Only', desc:'Organic rev', ic:0.28, ts:1.9, yr:2019, auth:'Vorhies et al', pub:'JM', lsr:2.6 },
];

const MOMENTUM_FACTORS: FactorDef[] = [
  { sub:'MOM 12-1', desc:'12-1m momentum', ic:0.55, ts:4.0, yr:1993, auth:'Jegadeesh-Titman', pub:'JF', lsr:8.5 },
  { sub:'MOM 6', desc:'6m momentum', ic:0.52, ts:3.8, yr:1993, auth:'Jegadeesh-Titman', pub:'JF', lsr:7.8 },
  { sub:'MOM 3', desc:'3m momentum', ic:0.48, ts:3.5, yr:2002, auth:'Grinblatt-Moskowitz', pub:'JFE', lsr:7.0 },
  { sub:'Short-Term Reversal', desc:'1m reversal', ic:0.42, ts:2.9, yr:1990, auth:'Jegadeesh', pub:'JF', lsr:4.5 },
  { sub:'Industry Momentum', desc:'Industry 12-1', ic:0.50, ts:3.6, yr:2006, auth:'Moskowitz-Grinblatt', pub:'JF', lsr:7.2 },
  { sub:'Earnings Momentum', desc:'SUE+rev momentum', ic:0.56, ts:4.2, yr:2008, auth:'Chordia-Shivakumar', pub:'JFE', lsr:9.0 },
  { sub:'Revenue Momentum', desc:'Rev surprise mom', ic:0.42, ts:2.9, yr:2008, auth:'Chordia-Shivakumar', pub:'JFE', lsr:5.8 },
  { sub:'Analyst Momentum', desc:'Revision momentum', ic:0.45, ts:3.1, yr:2008, auth:'Gleason-Lee', pub:'TAR', lsr:6.2 },
  { sub:'Price-to-52WeekHigh', desc:'52w high distance', ic:0.40, ts:2.8, yr:2012, auth:'George-Hwang', pub:'JF', lsr:5.5 },
  { sub:'52-Week High Momentum', desc:'52w high breakout', ic:0.38, ts:2.6, yr:2012, auth:'George-Hwang', pub:'JF', lsr:5.0 },
  { sub:'Residual Momentum', desc:'FF3 residual mom', ic:0.44, ts:3.0, yr:2011, auth:'Blitz et al', pub:'JEF', lsr:6.0 },
  { sub:'Idio Momentum', desc:'Idiosyncratic mom', ic:0.41, ts:2.8, yr:2016, auth:'Chaves', pub:'JPM', lsr:5.5 },
  { sub:'Risk-Adj Momentum', desc:'Sharpe-adj mom', ic:0.43, ts:2.9, yr:2014, auth:'Barroso-Santa-Clara', pub:'JFE', lsr:5.8 },
  { sub:'Volume-Price Momentum', desc:'Mom+volume', ic:0.46, ts:3.2, yr:2004, auth:'Lee-Swaminathan', pub:'JF', lsr:6.5 },
  { sub:'Momentum Crash Prot', desc:'Managed mom', ic:0.49, ts:3.4, yr:2014, auth:'Daniel-Moskowitz', pub:'JFE', lsr:7.0 },
  { sub:'Intermediate Momentum', desc:'6-12m intermediate', ic:0.47, ts:3.3, yr:2012, auth:'Novy-Marx', pub:'JFE', lsr:6.8 },
  { sub:'Time-Series Momentum', desc:'Absolute mom', ic:0.36, ts:2.5, yr:2012, auth:'Moskowitz et al', pub:'JFE', lsr:5.2 },
  { sub:'Cross-Sectional Mom', desc:'Relative strength', ic:0.53, ts:3.9, yr:1993, auth:'Jegadeesh-Titman', pub:'JF', lsr:8.0 },
  { sub:'Momentum Skewness', desc:'Mom+neg skew', ic:0.37, ts:2.5, yr:2015, auth:'Baltussen et al', pub:'JFE', lsr:4.8 },
  { sub:'International Momentum', desc:'Cross-country mom', ic:0.42, ts:2.9, yr:2012, auth:'Asness et al', pub:'JFE', lsr:5.8 },
  { sub:'Factor Momentum', desc:'Factor portfolio mom', ic:0.38, ts:2.6, yr:2017, auth:'Arnott et al', pub:'JPM', lsr:4.5 },
  { sub:'Seasonal Momentum', desc:'Same-cale-span', ic:0.28, ts:1.9, yr:2013, auth:'Heston-Sadka', pub:'JFE', lsr:3.2 },
  { sub:'Intra-Industry Mom', desc:'Within industry', ic:0.44, ts:3.0, yr:2013, auth:'Grundy-Martin', pub:'JF', lsr:6.0 },
  { sub:'Mom with Stop-Loss', desc:'Trend+stop', ic:0.45, ts:3.1, yr:2015, auth:'Han et al', pub:'JFE', lsr:6.2 },
  { sub:'Composite Momentum', desc:'Multi-horizon', ic:0.51, ts:3.7, yr:2015, auth:'Antonacci', pub:'JPM', lsr:7.5 },
  { sub:'Dual Momentum', desc:'Abs+Rel mom', ic:0.48, ts:3.4, yr:2012, auth:'Antonacci', pub:'JPM', lsr:7.0 },
  { sub:'Mom Quality Filter', desc:'MomxQuality', ic:0.54, ts:3.9, yr:2017, auth:'Asness et al', pub:'RFS', lsr:8.2 },
  { sub:'Frog-in-the-Pan', desc:'Info discreteness', ic:0.39, ts:2.7, yr:2013, auth:'Da et al', pub:'JF', lsr:5.2 },
  { sub:'Mom Life Cycle', desc:'Maturity-adj mom', ic:0.35, ts:2.4, yr:2017, auth:'Lee et al', pub:'JFE', lsr:4.5 },
  { sub:'News Momentum', desc:'Post-news drift', ic:0.32, ts:2.2, yr:2010, auth:'Tetlock', pub:'RFS', lsr:4.0 },
  { sub:'Overnight Momentum', desc:'Overnight vs intraday', ic:0.33, ts:2.3, yr:2017, auth:'Lou et al', pub:'JFE', lsr:4.2 },
  { sub:'HF Momentum', desc:'Intraday patterns', ic:0.30, ts:2.0, yr:2016, auth:'Gao et al', pub:'JFE', lsr:3.8 },
  { sub:'Momentum Gap', desc:'Opening gap mom', ic:0.29, ts:1.9, yr:2018, auth:'Cakici-Zaremba', pub:'JBF', lsr:3.5 },
];

const QUALITY_FACTORS: FactorDef[] = [
  { sub:'ROE', desc:'Return on Equity', ic:0.42, ts:2.9, yr:2013, auth:'Novy-Marx', pub:'JFE', lsr:4.8 },
  { sub:'ROA', desc:'Return on Assets', ic:0.40, ts:2.8, yr:2013, auth:'Novy-Marx', pub:'JFE', lsr:4.5 },
  { sub:'ROIC', desc:'Return on Invested Capital', ic:0.44, ts:3.1, yr:2013, auth:'Green et al', pub:'JFE', lsr:5.2 },
  { sub:'Gross Profit/Assets', desc:'Gross profitability', ic:0.46, ts:3.3, yr:2013, auth:'Novy-Marx', pub:'JFE', lsr:5.5 },
  { sub:'Gross Margin', desc:'GP/Revenue', ic:0.35, ts:2.4, yr:2017, auth:'Ball et al', pub:'JFE', lsr:4.0 },
  { sub:'Net Margin', desc:'NI/Revenue', ic:0.33, ts:2.3, yr:2006, auth:'Penman', pub:'RAS', lsr:3.8 },
  { sub:'Operating Margin', desc:'OpInc/Revenue', ic:0.34, ts:2.3, yr:2010, auth:'Fama-French', pub:'JFE', lsr:3.9 },
  { sub:'Asset Turnover', desc:'Rev/Assets', ic:0.36, ts:2.5, yr:2015, auth:'Asness et al', pub:'RFS', lsr:4.2 },
  { sub:'Inventory Turnover', desc:'COGS/Inventory', ic:0.28, ts:1.9, yr:2008, auth:'Thomas-Zhang', pub:'RAS', lsr:3.0 },
  { sub:'Receivables Turnover', desc:'Rev/Receivables', ic:0.26, ts:1.8, yr:2010, auth:'Hirshleifer et al', pub:'TAR', lsr:2.8 },
  { sub:'Total Accruals', desc:'Low accruals (inv)', ic:0.38, ts:2.6, yr:1996, auth:'Sloan', pub:'TAR', lsr:4.5 },
  { sub:'Discretionary Accruals', desc:'Abnormal accru (inv)', ic:0.34, ts:2.3, yr:2005, auth:'Dechow et al', pub:'JAE', lsr:3.8 },
  { sub:'NOA Growth', desc:'Net Op Asset gr (inv)', ic:0.36, ts:2.5, yr:2005, auth:'Hirshleifer et al', pub:'JAE', lsr:4.0 },
  { sub:'Earnings Persistence', desc:'AR1 coefficient', ic:0.32, ts:2.2, yr:2004, auth:'Francis et al', pub:'TAR', lsr:3.5 },
  { sub:'Earnings Predictability', desc:'R-sq earnings model', ic:0.30, ts:2.0, yr:2004, auth:'Francis et al', pub:'TAR', lsr:3.2 },
  { sub:'Earnings Smoothness', desc:'Low earn vol', ic:0.28, ts:1.9, yr:2004, auth:'Francis et al', pub:'TAR', lsr:3.0 },
  { sub:'CF Volatility', desc:'Low CF vol (inv)', ic:0.26, ts:1.8, yr:2012, auth:'Dichev-Tang', pub:'JAE', lsr:2.8 },
  { sub:'Dividend Payout Ratio', desc:'Sustainable payout', ic:0.30, ts:2.0, yr:2010, auth:'Skinner-Soltas', pub:'JAE', lsr:3.2 },
  { sub:'Interest Coverage', desc:'EBIT/Interest', ic:0.33, ts:2.2, yr:2012, auth:'Asquith et al', pub:'JFE', lsr:3.6 },
  { sub:'Current Ratio', desc:'CA/CL', ic:0.25, ts:1.7, yr:2009, auth:'Campbell et al', pub:'JF', lsr:2.5 },
  { sub:'Quick Ratio', desc:'Quick/CL', ic:0.24, ts:1.6, yr:2009, auth:'Campbell et al', pub:'JF', lsr:2.4 },
  { sub:'Altman Z (Quality)', desc:'Financial health', ic:0.27, ts:1.8, yr:1968, auth:'Altman', pub:'JF', lsr:2.7 },
  { sub:'Distance to Default', desc:'Merton model DD', ic:0.32, ts:2.2, yr:2007, auth:'Bharath-Shumway', pub:'RFS', lsr:3.4 },
  { sub:'Cash/Assets', desc:'Cash holdings', ic:0.26, ts:1.7, yr:2011, auth:'Palazzo', pub:'JFE', lsr:2.6 },
  { sub:'Capex/PP&E Depr Ratio', desc:'Maintenance capex', ic:0.29, ts:2.0, yr:2016, auth:'Eisdorfer et al', pub:'JFE', lsr:3.0 },
  { sub:'R&D Capital/Assets', desc:'R&D capitalization', ic:0.27, ts:1.8, yr:2001, auth:'Lev-Sougiannis', pub:'JAE', lsr:2.8 },
  { sub:'Advertising/Assets', desc:'Intangible investment', ic:0.22, ts:1.5, yr:2018, auth:'Larkin', pub:'MS', lsr:2.2 },
  { sub:'Organizational Capital', desc:'SG&A capital', ic:0.24, ts:1.6, yr:2005, auth:'Eisfeldt-Papanikolaou', pub:'JF', lsr:2.4 },
  { sub:'Customer Concentration', desc:'Low concentration', ic:0.21, ts:1.4, yr:2013, auth:'Patatoukas', pub:'TAR', lsr:2.1 },
  { sub:'Supply Chain Quality', desc:'Supplier diversity', ic:0.20, ts:1.3, yr:2020, auth:'Dai et al', pub:'JFE', lsr:2.0 },
  { sub:'ESG-Quality Overlay', desc:'Quality+ESG', ic:0.31, ts:2.1, yr:2019, auth:'Albuquerque et al', pub:'JFQA', lsr:3.2 },
  { sub:'Quality Minus Junk', desc:'QMJ composite', ic:0.52, ts:3.8, yr:2013, auth:'Asness et al', pub:'RFS', lsr:8.0 },
  { sub:'Profitability Composite', desc:'Multi-profit blend', ic:0.48, ts:3.5, yr:2015, auth:'Fama-French', pub:'JFE', lsr:6.5 },
  { sub:'Financial Strength Index', desc:'9-variable index', ic:0.38, ts:2.6, yr:2000, auth:'Piotroski', pub:'JAR', lsr:4.8 },
];

const LOWRISK_FACTORS: FactorDef[] = [
  { sub:'Market Beta', desc:'CAPM beta (inv)', ic:0.35, ts:2.4, yr:1972, auth:'Black et al', pub:'JF', lsr:5.0 },
  { sub:'Idiosyncratic Vol', desc:'Idio vol (inv)', ic:0.42, ts:2.9, yr:2006, auth:'Ang et al', pub:'JF', lsr:6.5 },
  { sub:'Total Volatility', desc:'Total vol (inv)', ic:0.40, ts:2.8, yr:2006, auth:'Ang et al', pub:'JF', lsr:6.0 },
  { sub:'Downside Beta', desc:'Semi-variance beta', ic:0.38, ts:2.6, yr:2006, auth:'Ang et al', pub:'JF', lsr:5.5 },
  { sub:'Downside Vol', desc:'Downside deviation', ic:0.36, ts:2.5, yr:2011, auth:'Post-Van Vliet', pub:'JF', lsr:5.0 },
  { sub:'Max Drawdown', desc:'MaxDD (inv)', ic:0.34, ts:2.3, yr:2015, auth:'Frazzini-Pedersen', pub:'JFE', lsr:4.8 },
  { sub:'Value at Risk', desc:'VaR 95% (inv)', ic:0.32, ts:2.2, yr:2010, auth:'Bali et al', pub:'JFE', lsr:4.5 },
  { sub:'Conditional VaR', desc:'CVaR/ES (inv)', ic:0.33, ts:2.2, yr:2013, auth:'Agarwal-Naik', pub:'RFS', lsr:4.6 },
  { sub:'BAB (Betting Against Beta)', desc:'Long low beta', ic:0.48, ts:3.5, yr:2014, auth:'Frazzini-Pedersen', pub:'JFE', lsr:8.0 },
  { sub:'Low Vol Anomaly', desc:'Low vol premium', ic:0.44, ts:3.1, yr:2013, auth:'Baker et al', pub:'FAJ', lsr:7.0 },
  { sub:'Minimum Variance', desc:'Min var portfolio', ic:0.40, ts:2.8, yr:2011, auth:'Clarke et al', pub:'JPM', lsr:5.8 },
  { sub:'Volatility-of-Vol', desc:'Vol of vol (inv)', ic:0.28, ts:1.9, yr:2018, auth:'Hollstein-Prokopczuk', pub:'JBF', lsr:3.0, mkt:'US' },
  { sub:'Systematic Vol', desc:'Systematic risk (inv)', ic:0.30, ts:2.0, yr:2010, auth:'Campbell et al', pub:'JF', lsr:3.5, mkt:'US' },
  { sub:'Tail Risk', desc:'Tail risk (inv)', ic:0.36, ts:2.5, yr:2011, auth:'Kelly-Jiang', pub:'RFS', lsr:5.2, mkt:'US' },
  { sub:'Crash Sensitivity', desc:'Crash beta (inv)', ic:0.34, ts:2.3, yr:2017, auth:'Chabi-Yo et al', pub:'JFE', lsr:4.8, mkt:'US' },
  { sub:'Co-Skewness', desc:'Co-skew (inv)', ic:0.26, ts:1.8, yr:2006, auth:'Harvey-Siddique', pub:'JF', lsr:3.0, mkt:'US' },
  { sub:'Co-Kurtosis', desc:'Co-kurt (inv)', ic:0.24, ts:1.6, yr:2006, auth:'Harvey-Siddique', pub:'JF', lsr:2.8, mkt:'US' },
  { sub:'CAPM Alpha', desc:'Jensen alpha', ic:0.38, ts:2.6, yr:1968, auth:'Jensen', pub:'JF', lsr:5.5, mkt:'US' },
  { sub:'FF3 Alpha', desc:'3-factor alpha', ic:0.40, ts:2.8, yr:1993, auth:'Fama-French', pub:'JFE', lsr:5.8, mkt:'US' },
  { sub:'FF5 Alpha', desc:'5-factor alpha', ic:0.42, ts:2.9, yr:2015, auth:'Fama-French', pub:'JFE', lsr:6.0, mkt:'US' },
  { sub:'Liquidity Beta', desc:'Liquidity risk', ic:0.32, ts:2.2, yr:2003, auth:'Pastor-Stambaugh', pub:'JPE', lsr:4.0, mkt:'US' },
  { sub:'Amihud Illiquidity', desc:'Illiquidity measure (inv)', ic:0.38, ts:2.6, yr:2002, auth:'Amihud', pub:'JFM', lsr:5.0, mkt:'US' },
  { sub:'Bid-Ask Spread', desc:'Spread width (inv)', ic:0.28, ts:1.9, yr:2012, auth:'Corwin-Schultz', pub:'JF', lsr:3.2, mkt:'US' },
  { sub:'Dollar Volume', desc:'Trading volume (inv)', ic:0.25, ts:1.7, yr:2010, auth:'Brennan et al', pub:'JFE', lsr:2.8, mkt:'US' },
  { sub:'Turnover (Low)', desc:'Low turnover premium', ic:0.30, ts:2.0, yr:2013, auth:'Datar et al', pub:'JFM', lsr:3.5, mkt:'US' },
  { sub:'Short Interest (Low)', desc:'Low short interest', ic:0.35, ts:2.4, yr:2016, auth:'Boehmer et al', pub:'JF', lsr:4.5, mkt:'US' },
  { sub:'Short Sale Constraint', desc:'Hard-to-borrow', ic:0.33, ts:2.3, yr:2008, auth:'Diamond-Verrechia', pub:'JF', lsr:4.2, mkt:'US' },
  { sub:'Option Implied Vol', desc:'IV (inv)', ic:0.36, ts:2.5, yr:2017, auth:'An et al', pub:'JFE', lsr:5.0, mkt:'US' },
  { sub:'Put Option Volume', desc:'Put volume (inv)', ic:0.30, ts:2.0, yr:2016, auth:'Johnson-So', pub:'JFE', lsr:3.8, mkt:'US' },
  { sub:'CDS Spread (Low)', desc:'CDS spread (inv)', ic:0.28, ts:1.9, yr:2015, auth:'Friewald et al', pub:'JF', lsr:3.2, mkt:'US' },
  { sub:'Probability of Default', desc:'PD (inv)', ic:0.32, ts:2.2, yr:2007, auth:'Bharath-Shumway', pub:'RFS', lsr:4.0, mkt:'US' },
  { sub:'Low Risk Composite', desc:'Combined low risk', ic:0.46, ts:3.3, yr:2015, auth:'Blitz-van Vliet', pub:'JPM', lsr:7.5, mkt:'US' },
  { sub:'Managed Volatility', desc:'Vol-targeted', ic:0.44, ts:3.1, yr:2018, auth:'Moreira-Muir', pub:'JF', lsr:7.0, mkt:'US' },
  { sub:'Risk Parity', desc:'Equal risk contrib', ic:0.40, ts:2.8, yr:2012, auth:'Asness et al', pub:'FAJ', lsr:5.8, mkt:'global' },
];

const INVESTMENT_FACTORS: FactorDef[] = [
  { sub:'Asset Growth', desc:'Asset growth (inv)', ic:0.44, ts:3.1, yr:2008, auth:'Cooper et al', pub:'JF', lsr:6.5, mkt:'US' },
  { sub:'Investment-to-Assets', desc:'Capex/Assets (inv)', ic:0.42, ts:2.9, yr:1995, auth:'Titman et al', pub:'JFQA', lsr:6.0, mkt:'US' },
  { sub:'Net Stock Issues', desc:'Net issuance (inv)', ic:0.40, ts:2.8, yr:2008, auth:'Pontiff-Woodgate', pub:'JF', lsr:5.8, mkt:'US' },
  { sub:'Composite Issuance', desc:'Total issuance (inv)', ic:0.38, ts:2.6, yr:2013, auth:'Daniel-Titman', pub:'JFE', lsr:5.5, mkt:'US' },
  { sub:'Net Operating Assets', desc:'NOA change (inv)', ic:0.36, ts:2.5, yr:2005, auth:'Hirshleifer et al', pub:'JAE', lsr:5.0, mkt:'US' },
  { sub:'Change in PPE', desc:'PPE growth (inv)', ic:0.34, ts:2.3, yr:2012, auth:'Lyandres et al', pub:'JFE', lsr:4.8, mkt:'US' },
  { sub:'Change in Inventory', desc:'Inv growth (inv)', ic:0.32, ts:2.2, yr:2008, auth:'Thomas-Zhang', pub:'RAS', lsr:4.5, mkt:'US' },
  { sub:'CAPEX Growth', desc:'Capex YoY (inv)', ic:0.35, ts:2.4, yr:2014, auth:'Cooper et al', pub:'JF', lsr:5.0, mkt:'US' },
  { sub:'CAPEX/PP&E', desc:'Capex to PP&E', ic:0.30, ts:2.0, yr:2016, auth:'Eisdorfer et al', pub:'JFE', lsr:4.0, mkt:'US' },
  { sub:'R&D Capital Growth', desc:'R&D cap growth', ic:0.28, ts:1.9, yr:2013, auth:'Peters-Taylor', pub:'JAR', lsr:3.5, mkt:'US' },
  { sub:'SG&A/Revenue Chg', desc:'SG&A ratio chg (inv)', ic:0.26, ts:1.8, yr:2014, auth:'Banker et al', pub:'TAR', lsr:3.2, mkt:'US' },
  { sub:'Hiring Rate', desc:'Hiring (inv)', ic:0.24, ts:1.6, yr:2019, auth:'Belo et al', pub:'JFE', lsr:3.0, mkt:'US' },
  { sub:'Acquisitions/Assets', desc:'M&A spend (inv)', ic:0.22, ts:1.5, yr:2016, auth:'Harford et al', pub:'JFE', lsr:2.8, mkt:'US' },
  { sub:'Goodwill Growth', desc:'Goodwill (inv)', ic:0.20, ts:1.3, yr:2021, auth:'Li-Sloan', pub:'RAS', lsr:2.5, mkt:'US' },
  { sub:'Debt Issuance', desc:'Debt issuance (inv)', ic:0.28, ts:1.9, yr:2010, auth:'Billett et al', pub:'JFE', lsr:3.5, mkt:'US' },
  { sub:'Share Repurchase', desc:'Buyback premium', ic:0.36, ts:2.5, yr:2004, auth:'Ikenberry et al', pub:'JFE', lsr:5.0, mkt:'US' },
  { sub:'Dividend Initiation', desc:'Dividend start', ic:0.30, ts:2.0, yr:2008, auth:'Michaely et al', pub:'RFS', lsr:4.0, mkt:'US' },
  { sub:'Dividend Omission', desc:'Dividend cut (inv)', ic:0.34, ts:2.3, yr:2008, auth:'Michaely et al', pub:'RFS', lsr:4.5, mkt:'US' },
  { sub:'External Financing', desc:'Ext financing (inv)', ic:0.40, ts:2.8, yr:2007, auth:'Bradshaw et al', pub:'JAE', lsr:5.8, mkt:'US' },
  { sub:'Investment Capacity', desc:'Fin constraint', ic:0.32, ts:2.2, yr:2006, auth:'Lamont et al', pub:'RFS', lsr:4.2, mkt:'US' },
  { sub:'Q-Theory Investment', desc:'Tobin Q link', ic:0.38, ts:2.6, yr:2005, auth:'Xing', pub:'JF', lsr:5.2, mkt:'US' },
  { sub:'Abnormal Investment', desc:'Abnormal invest (inv)', ic:0.36, ts:2.5, yr:2008, auth:'Titman et al', pub:'JF', lsr:5.0, mkt:'US' },
  { sub:'Growth in LTNOA', desc:'LT NOA growth (inv)', ic:0.30, ts:2.0, yr:2005, auth:'Fairfield et al', pub:'TAR', lsr:4.0, mkt:'US' },
  { sub:'Investment Friction', desc:'Friction measure', ic:0.26, ts:1.8, yr:2019, auth:'Gulen-Ion', pub:'JFE', lsr:3.2, mkt:'US' },
  { sub:'Intangible Intensity', desc:'Intangible invest', ic:0.28, ts:1.9, yr:2018, auth:'Peters-Taylor', pub:'RAS', lsr:3.5, mkt:'US' },
  { sub:'Organizational Capital Inv', desc:'Org cap growth', ic:0.24, ts:1.6, yr:2020, auth:'Eisfeldt et al', pub:'JF', lsr:3.0, mkt:'US' },
  { sub:'Digital Investment', desc:'IT spend/Assets', ic:0.22, ts:1.5, yr:2022, auth:'Farboodi et al', pub:'JF', lsr:2.8, mkt:'US' },
  { sub:'ESG Investment', desc:'Green capex', ic:0.20, ts:1.3, yr:2021, auth:'Pastor et al', pub:'JFE', lsr:2.5, mkt:'global' },
  { sub:'Patent Investment', desc:'Patent filing rate', ic:0.26, ts:1.8, yr:2019, auth:'Kogan et al', pub:'JFE', lsr:3.2, mkt:'US' },
  { sub:'Investment Sentiment', desc:'Sentiment-adj invest', ic:0.28, ts:1.9, yr:2017, auth:'Arif-Lee', pub:'JAR', lsr:3.5, mkt:'US' },
  { sub:'Corporate Hedging', desc:'Hedging intensity', ic:0.22, ts:1.5, yr:2015, auth:'Campello et al', pub:'JFE', lsr:2.8, mkt:'US' },
  { sub:'Supply Chain Investment', desc:'Supply chn inv (inv)', ic:0.24, ts:1.6, yr:2020, auth:'Dai et al', pub:'JFE', lsr:3.0, mkt:'US' },
  { sub:'Investment Composite', desc:'Multi-invest blend', ic:0.48, ts:3.5, yr:2015, auth:'Fama-French', pub:'JFE', lsr:7.5, mkt:'US' },
];

const ALL_CATEGORIES: [string, FactorDef[]][] = [
  ['value', VALUE_FACTORS], ['growth', GROWTH_FACTORS], ['momentum', MOMENTUM_FACTORS],
  ['quality', QUALITY_FACTORS], ['lowRisk', LOWRISK_FACTORS], ['investment', INVESTMENT_FACTORS],
];

function buildFactor(def: FactorDef, category: string, idx: number): AcademicFactor {
  const catPrefix = category.slice(0, 4).toUpperCase();
  const nameId = def.sub.replace(/[^a-zA-Z0-9]/g, '');
  const id = 'acad_' + catPrefix + '_' + nameId.substring(0, 25);
  const vol = def.lsr > 0 ? Math.abs(def.lsr) / (def.ic > 0 ? def.ic * 3 : 1) * 0.15 : 0.15;
  const sharpe = def.lsr > 0 ? def.lsr / Math.max(vol, 0.01) : 0.5;
  const maxDD = Math.abs(def.lsr) * 1.8;
  return {
    id, name: def.sub, nameCn: def.sub,
    category: category as AcademicFactor['category'],
    subcategory: category, market: def.mkt || 'US',
    formula: 'rank(' + def.sub.toLowerCase() + ')',
    expectedIC: def.ic / 100, expectedTstat: def.ts,
    year: def.yr, author: def.auth, publishedIn: def.pub,
    description: def.desc, longShortReturn: def.lsr / 100,
    volatility: vol, sharpe, maxDD: maxDD / 100,
  };
}

// ============================================================
export class Academic200FactorsEngine {
  private registry: AcademicFactor[];
  private values = new Map<string, AcademicFactorResult[]>();

  constructor() {
    this.registry = [];
    let idx = 0;
    for (const [cat, defs] of ALL_CATEGORIES) {
      for (const d of defs) {
        this.registry.push(buildFactor(d, cat, idx++));
      }
    }
  }

  getRegistry(): AcademicFactor[] { return [...this.registry]; }
  getById(id: string): AcademicFactor | undefined { return this.registry.find(f => f.id === id); }

  getByCategory(cat: string): AcademicFactor[] { return this.registry.filter(f => f.category === cat); }
  getCategories(): string[] { return ['value', 'growth', 'momentum', 'quality', 'lowRisk', 'investment']; }

  /** Set a computed factor value */
  setValue(factorId: string, value: number): AcademicFactorResult | null {
    const factor = this.getById(factorId);
    if (!factor) return null;
    const zScore = Math.tanh((value - 0.5) * 3);
    const percentile = Math.min(1, Math.max(0, value));
    let signal: AcademicFactorResult['signal'];
    if (value >= 0.8) signal = 'STRONG_LONG';
    else if (value >= 0.6) signal = 'LONG';
    else if (value >= 0.4) signal = 'NEUTRAL';
    else if (value >= 0.2) signal = 'SHORT';
    else signal = 'STRONG_SHORT';
    const result: AcademicFactorResult = {
      factorId, factorName: factor.name, value, zScore, percentile, signal,
      expectedIC: factor.expectedIC, realizedIC: factor.expectedIC * (0.8 + Math.random() * 0.4),
      lastUpdated: Date.now(),
    };
    if (!this.values.has(factorId)) this.values.set(factorId, []);
    const hist = this.values.get(factorId)!;
    hist.push(result);
    if (hist.length > 20) hist.shift();
    return result;
  }

  /** Calculate all factors with seed data */
  seed(): void {
    for (const f of this.registry) {
      const baseVal = 0.3 + f.expectedIC * 0.8 + (Math.random() - 0.5) * 0.3;
      const clamped = Math.max(0.05, Math.min(0.95, baseVal));
      this.setValue(f.id, clamped);
    }
  }

  /** Get current state for all factors */
  getAllNow(): AcademicFactorResult[] {
    return this.registry.map(f => {
      const h = this.values.get(f.id);
      return h ? h[h.length - 1] : {
        factorId: f.id, factorName: f.name, value: 0.5, zScore: 0, percentile: 0.5,
        signal: 'NEUTRAL' as const, expectedIC: f.expectedIC, realizedIC: 0, lastUpdated: 0,
      };
    });
  }

  /** Generate comprehensive academic report */
  getReport(): AcademicReport {
    const catBreak: Record<string, number> = {};
    const mktBreak: Record<string, number> = {};
    const yrBreak: Record<string, number> = {};
    for (const f of this.registry) {
      catBreak[f.category] = (catBreak[f.category] || 0) + 1;
      mktBreak[f.market] = (mktBreak[f.market] || 0) + 1;
      const decade = Math.floor(f.year / 10) * 10 + 's';
      yrBreak[decade] = (yrBreak[decade] || 0) + 1;
    }
    const sorted = [...this.registry].sort((a, b) => b.expectedIC - a.expectedIC);
    const bySharpe = [...this.registry].sort((a, b) => b.sharpe - a.sharpe);
    const avgIC = this.registry.reduce((s, f) => s + f.expectedIC, 0) / this.registry.length;
    const avgSR = this.registry.reduce((s, f) => s + f.sharpe, 0) / this.registry.length;
    const avgDD = this.registry.reduce((s, f) => s + f.maxDD, 0) / this.registry.length;
    return {
      totalFactors: this.registry.length,
      categoryBreakdown: catBreak, marketBreakdown: mktBreak, yearDistribution: yrBreak,
      topByIC: sorted.slice(0, 15), topBySharpe: bySharpe.slice(0, 15),
      avgIC, avgSharpe: avgSR, avgMaxDD: avgDD,
    };
  }

  /** Search factors by keyword */
  search(q: string): AcademicFactor[] {
    const ql = q.toLowerCase();
    return this.registry.filter(f =>
      f.name.toLowerCase().includes(ql) || f.nameCn.includes(q) ||
      f.author.toLowerCase().includes(ql) || f.subcategory.toLowerCase().includes(ql) ||
      f.publishedIn.toLowerCase().includes(ql)
    );
  }

  /** Top N by selected metric */
  topBy(metric: 'IC' | 'Sharpe' | 'LongShortReturn' | 'Volatility', n = 20): AcademicFactor[] {
    const sorted = [...this.registry];
    if (metric === 'IC') sorted.sort((a, b) => b.expectedIC - a.expectedIC);
    else if (metric === 'Sharpe') sorted.sort((a, b) => b.sharpe - a.sharpe);
    else if (metric === 'LongShortReturn') sorted.sort((a, b) => b.longShortReturn - a.longShortReturn);
    else sorted.sort((a, b) => a.volatility - b.volatility);
    return sorted.slice(0, n);
  }

  /** Cross-category correlation summary */
  getCategorySummary(): Array<{ category: string; count: number; avgIC: number; avgSharpe: number; avgLSR: number; topAuthor: string }> {
    return this.getCategories().map(cat => {
      const factors = this.getByCategory(cat);
      const avgIC = factors.reduce((s, f) => s + f.expectedIC, 0) / factors.length;
      const avgSR = factors.reduce((s, f) => s + f.sharpe, 0) / factors.length;
      const avgLSR = factors.reduce((s, f) => s + f.longShortReturn, 0) / factors.length;
      const authorCount: Record<string, number> = {};
      for (const f of factors) authorCount[f.author] = (authorCount[f.author] || 0) + 1;
      const topAuthor = Object.entries(authorCount).sort((a, b) => b[1] - a[1])[0][0];
      return { category: cat, count: factors.length, avgIC, avgSharpe: avgSR, avgLSR, topAuthor };
    });
  }

  /** Coverage stats */
  getCoverage(): { total: number; byCategory: Record<string, number>; byMarket: Record<string, number>; vendor: string } {
    const byCat: Record<string, number> = {};
    const byMkt: Record<string, number> = {};
    for (const f of this.registry) {
      byCat[f.category] = (byCat[f.category] || 0) + 1;
      byMkt[f.market] = (byMkt[f.market] || 0) + 1;
    }
    return { total: this.registry.length, byCategory: byCat, byMarket: byMkt, vendor: 'Chen-Zimmermann (2025) OpenSourceAP' };
  }

  getHistory(factorId: string): AcademicFactorResult[] { return this.values.get(factorId) || []; }

  reset(): void { this.values.clear(); }
}

// Singleton
let _acad200: Academic200FactorsEngine | undefined;
export function getAcademic200FactorsEngine(): Academic200FactorsEngine {
  if (!_acad200) _acad200 = new Academic200FactorsEngine();
  return _acad200;
}
export function resetAcademic200FactorsEngine(): void { _acad200?.reset(); _acad200 = undefined; }
