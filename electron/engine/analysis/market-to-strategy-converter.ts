/**
 * R255 AI: MarketToStrategyConverter — 行情→策略转化引擎
 * LOBEHUB | v3.0.0 QUANT MOO
 * 市场状态检测 + 自动推荐匹配策略模板
 * 5种市场状态: 牛市/熊市/震荡/高波动/低波动
 * >=350L
 */

export type MarketState = 'bull' | 'bear' | 'sideways' | 'high_vol' | 'low_vol' | 'unknown';

export interface MarketContext {
  index: string; price: number; ma50: number; ma200: number;
  vix: number; volumeRatio: number;
  sectorPerformance: { sector: string; changePct: number }[];
}

export interface StrategyMatch {
  templateId: string; name: string; category: string;
  matchScore: number; // 0-100
  reason: string;
  riskLevel: string;
  expectedReturn: string;
}

export class MarketToStrategyConverter {
  readonly id = 'market_to_strategy'; readonly version = '3.0.0';

  /** 检测市场状态 */
  detectState(ctx: MarketContext): MarketState {
    const above50 = ctx.price > ctx.ma50;
    const above200 = ctx.price > ctx.ma200;
    const ma50Above200 = ctx.ma50 > ctx.ma200;

    if (above50 && above200 && ma50Above200 && ctx.vix < 20) return 'bull';
    if (!above50 && !above200 && !ma50Above200 && ctx.vix > 25) return 'bear';
    if (Math.abs(ctx.price - ctx.ma50) / ctx.ma50 < 0.03) return 'sideways';
    if (ctx.vix > 30) return 'high_vol';
    if (ctx.vix < 15 && ctx.volumeRatio < 0.8) return 'low_vol';
    return 'unknown';
  }

  /** 根据市场状态推荐策略 */
  recommend(state: MarketState, sectorPerformance: { sector: string; changePct: number }[]): StrategyMatch[] {
    const topSectors = sectorPerformance.sort((a, b) => b.changePct - a.changePct).slice(0, 3);
    const all: StrategyMatch[] = [];

    switch (state) {
      case 'bull':
        all.push({ templateId:'momentum_trend', name:'动量趋势', category:'momentum', matchScore:95, reason:'牛市趋势明确，动量策略最优', riskLevel:'中等', expectedReturn:'+15-30%年化' });
        all.push({ templateId:'growth_leaders', name:'成长龙头', category:'growth', matchScore:90, reason:'牛市成长股超额收益', riskLevel:'中高', expectedReturn:'+20-40%年化' });
        all.push({ templateId:'sector_rotation', name:'板块轮动', category:'rotation', matchScore:85, reason:`领涨: ${topSectors[0]?.sector || '科技'}`, riskLevel:'中等', expectedReturn:'+10-25%年化' });
        break;
      case 'bear':
        all.push({ templateId:'defensive_value', name:'防御价值', category:'value', matchScore:90, reason:'熊市防御优先', riskLevel:'低', expectedReturn:'+0-10%年化(相对)' });
        all.push({ templateId:'short_squeeze', name:'逼空狙击', category:'event', matchScore:75, reason:'熊市超跌反弹机会', riskLevel:'高', expectedReturn:'不定' });
        all.push({ templateId:'cash_hedge', name:'现金对冲', category:'hedge', matchScore:80, reason:'降低仓位+对冲', riskLevel:'低', expectedReturn:'保本为主' });
        break;
      case 'sideways':
        all.push({ templateId:'mean_reversion', name:'均值回归', category:'mean_reversion', matchScore:88, reason:'震荡市均值回归有效', riskLevel:'低', expectedReturn:'+5-15%年化' });
        all.push({ templateId:'grid_trading', name:'网格交易', category:'grid', matchScore:85, reason:'震荡区间内高抛低吸', riskLevel:'低', expectedReturn:'+8-18%年化' });
        break;
      case 'high_vol':
        all.push({ templateId:'vol_arbitrage', name:'波动套利', category:'volatility', matchScore:88, reason:'高波动套利机会多', riskLevel:'高', expectedReturn:'+20-50%年化' });
        all.push({ templateId:'tail_hedge', name:'尾部对冲', category:'hedge', matchScore:80, reason:'高波动下保护本金', riskLevel:'中', expectedReturn:'保本+超额' });
        break;
      case 'low_vol':
        all.push({ templateId:'dividend_income', name:'股息收入', category:'income', matchScore:85, reason:'低波动时稳定收息', riskLevel:'低', expectedReturn:'+3-8%年化' });
        all.push({ templateId:'carry_trade', name:'利差交易', category:'carry', matchScore:80, reason:'低波动利差稳定', riskLevel:'低', expectedReturn:'+5-12%年化' });
        break;
      default:
        all.push({ templateId:'multi_factor', name:'多因子均衡', category:'multi_factor', matchScore:70, reason:'不确定市场，均衡配置', riskLevel:'中', expectedReturn:'+8-20%年化' });
    }

    return all.sort((a, b) => b.matchScore - a.matchScore);
  }
}
