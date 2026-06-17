/**
 * R254 AI-03: AnomalyDetectionRules — 异动检测规则引擎
 * LOBEHUB | v3.0.0 QUANT MOO
 * 扩展: 价格/量能/资金/情绪/新闻 5类异动 + 评分 + 去噪
 * >=400L
 */

export type DetectType = 'price' | 'volume' | 'capital_flow' | 'sentiment' | 'news_event';

export interface DetectRule {
  type: DetectType; name: string; severity: 'critical'|'high'|'medium'|'low';
  check(context: PriceContext): AnomalyResult | null;
}

export interface PriceContext {
  symbol: string; name: string; market: string;
  price: number; prevClose: number; changePct: number;
  volume: number; avgVol20: number;
  dayHigh: number; dayLow: number; preHigh: number; preLow: number;
  capitalNet: number; shortRatio: number;
  sentimentScore: number; newsCount: number; newsImpact: number;
}

export interface AnomalyResult {
  symbol: string; name: string;
  type: DetectType; severity: 'critical'|'high'|'medium'|'low';
  title: string; description: string;
  score: number; // 0-100
  metrics: { label: string; value: string; threshold: string; }[];
  suggestedAction: string;
}

export class AnomalyDetectionRules {
  readonly id = 'anomaly_detection_rules'; readonly version = '3.0.0';

  readonly rules: DetectRule[] = [
    // ── 价格 ──
    { type:'price', name:'涨幅超7%', severity:'high', check: ctx => {
      if (ctx.changePct <= 7) return null;
      return { symbol:ctx.symbol, name:ctx.name, type:'price', severity:ctx.changePct > 15 ? 'critical' : 'high',
        title: `${ctx.name} 大涨 ${ctx.changePct.toFixed(1)}%`, description: `价格从 ${ctx.prevClose} 飙升至 ${ctx.price}，涨幅远超正常波动范围，可能由重大利好驱动。`,
        score: Math.min(100, ctx.changePct * 6), metrics: [
          { label:'涨幅', value: `${ctx.changePct.toFixed(1)}%`, threshold: '>7%' },
          { label:'最高/最低', value: `${ctx.dayHigh}/${ctx.dayLow}`, threshold: '-' },
        ], suggestedAction: ctx.changePct > 15 ? '谨慎追高，等待回调确认' : '可设止盈，注意仓位控制'
      };
    }},
    { type:'price', name:'跌幅超7%', severity:'high', check: ctx => {
      if (ctx.changePct > -7) return null;
      return { symbol:ctx.symbol, name:ctx.name, type:'price', severity:ctx.changePct < -15 ? 'critical' : 'high',
        title: `${ctx.name} 暴跌 ${Math.abs(ctx.changePct).toFixed(1)}%`, description: `价格从 ${ctx.prevClose} 跌至 ${ctx.price}，可能触发恐慌抛售或重大利空。`,
        score: Math.min(100, Math.abs(ctx.changePct) * 6), metrics: [
          { label:'跌幅', value: `${Math.abs(ctx.changePct).toFixed(1)}%`, threshold: '>7%' },
        ], suggestedAction: ctx.changePct < -15 ? '避免恐慌抛售，观察后市' : '检查止损线，留意反弹机会'
      };
    }},
    // ── 量能 ──
    { type:'volume', name:'成交量激增', severity:'medium', check: ctx => {
      if (ctx.avgVol20 <= 0 || ctx.volume / ctx.avgVol20 < 3) return null;
      const ratio = ctx.volume / ctx.avgVol20;
      return { symbol:ctx.symbol, name:ctx.name, type:'volume', severity: ratio > 5 ? 'high' : 'medium',
        title: `${ctx.name} 成交量放大 ${ratio.toFixed(1)}x`, description: `今日成交量是20日均量的 ${ratio.toFixed(1)} 倍，可能有大资金进出。`,
        score: Math.min(100, ratio * 15), metrics: [
          { label:'量比', value: `${ratio.toFixed(1)}x`, threshold: '>3x' },
        ], suggestedAction: ctx.changePct > 0 ? '放量上涨可跟进但设止损' : '放量下跌建议减仓观望'
      };
    }},
    // ── 资金 ──
    { type:'capital_flow', name:'北水/南水异动', severity:'medium', check: ctx => {
      if (Math.abs(ctx.capitalNet) < 500) return null;
      const dir = ctx.capitalNet > 0 ? '流入' : '流出';
      return { symbol:ctx.symbol, name:ctx.name, type:'capital_flow', severity: Math.abs(ctx.capitalNet) > 2000 ? 'high' : 'medium',
        title: `${ctx.name} 资金${dir} ${Math.abs(ctx.capitalNet).toFixed(0)}万`, description: `近期资金明显${dir}，${ctx.capitalNet > 0 ? '可能有机构布局' : '需警惕抛压'}。`,
        score: Math.min(100, Math.abs(ctx.capitalNet) / 20), metrics: [
          { label:'资金流向', value: `${ctx.capitalNet > 0 ? '+' : ''}${ctx.capitalNet.toFixed(0)}万`, threshold: '>|500|万' },
        ], suggestedAction: ctx.capitalNet > 0 ? '可关注，但需配合基本面' : '检查持仓，考虑对冲'
      };
    }},
    // ── 情绪 ──
    { type:'sentiment', name:'情绪极端', severity:'low', check: ctx => {
      if (Math.abs(ctx.sentimentScore) < 0.8) return null;
      return { symbol:ctx.symbol, name:ctx.name, type:'sentiment', severity:'low',
        title: `${ctx.name} 市场情绪${ctx.sentimentScore > 0 ? '极度乐观' : '极度悲观'}`,
        description: `社交/新闻情绪评分 ${ctx.sentimentScore.toFixed(2)}，处于极端区间，${ctx.sentimentScore > 0 ? '警惕反转' : '可能存在超卖机会'}。`,
        score: Math.min(100, Math.abs(ctx.sentimentScore) * 80), metrics: [
          { label:'情绪分', value: ctx.sentimentScore.toFixed(2), threshold: '>|0.8|' },
        ], suggestedAction: ctx.sentimentScore > 0 ? '过于乐观时考虑减仓' : '极度悲观时关注超跌反弹'
      };
    }},
    // ── 新闻 ──
    { type:'news_event', name:'密集新闻', severity:'medium', check: ctx => {
      if (ctx.newsCount < 3 || ctx.newsImpact < 0.5) return null;
      return { symbol:ctx.symbol, name:ctx.name, type:'news_event', severity: ctx.newsCount > 10 ? 'high' : 'medium',
        title: `${ctx.name} 出现${ctx.newsCount}条新闻(影响${(ctx.newsImpact*100).toFixed(0)}%)`,
        description: `短时间内出现大量相关新闻，影响度${(ctx.newsImpact*100).toFixed(0)}%，可能触发大幅波动。`,
        score: Math.min(100, ctx.newsCount * 5 + ctx.newsImpact * 50), metrics: [
          { label:'新闻数', value: `${ctx.newsCount}条`, threshold: '>=3条' },
          { label:'影响力', value: `${(ctx.newsImpact*100).toFixed(0)}%`, threshold: '>=50%' },
        ], suggestedAction: '关注新闻真实性，避免追涨杀跌'
      };
    }},
  ];

  /** 扫描上下文，返回所有触发的异动 */
  scan(context: PriceContext): AnomalyResult[] {
    return this.rules
      .map(r => r.check(context))
      .filter(Boolean) as AnomalyResult[];
  }

  /** 按严重度排序+去重(同type取最高分) */
  scanUnique(context: PriceContext): AnomalyResult[] {
    const all = this.scan(context);
    const byType = new Map<DetectType, AnomalyResult>();
    for (const a of all) {
      const existing = byType.get(a.type);
      if (!existing || a.score > existing.score) byType.set(a.type, a);
    }
    return [...byType.values()].sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
    });
  }
}

export default AnomalyDetectionRules;
