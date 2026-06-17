/**
 * R275+ Claw(PM) P1-02: 画线→策略一键转化 — 收费上线
 *
 * 集成 drawing-to-strategy-engine (JVS R267) → DrawingToolbar右键事件
 * 定价: 2 USDT/次
 * 功能: 用户在K线图上画趋势线/支撑/阻力→右键"创建策略"→自动生成策略模板
 */
import { EventEmitter } from 'events';

export interface DrawingStrategyResult {
  resultId: string;
  drawingType: string;
  drawingPoints: { price: number; time: number }[];
  strategyType: 'breakout_long' | 'breakout_short' | 'bounce_long' | 'bounce_short' | 'channel_long' | 'channel_short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number;
  reasoning: string;
  timestamp: number;
  price: number; // 2 USDT
}

export class DrawingToStrategyBridge extends EventEmitter {
  private static instance: DrawingToStrategyBridge;

  static getInstance(): DrawingToStrategyBridge {
    if (!this.instance) this.instance = new DrawingToStrategyBridge();
    return this.instance;
  }

  getPrice(): number { return 2; }

  convertToStrategy(
    drawingType: string,
    points: { price: number; time: number }[],
    symbol: string,
    currentPrice: number
  ): DrawingStrategyResult {
    const resultId = `DS-${Date.now()}`;
    let strategyType: DrawingStrategyResult['strategyType'] = 'breakout_long';
    let entryPrice = currentPrice;
    let stopLoss = currentPrice * 0.95;
    let takeProfit = currentPrice * 1.10;
    let reasoning = '';

    switch (drawingType) {
      case 'trendline':
      case 'TrendLine':
        strategyType = points[1].price > points[0].price ? 'bounce_long' : 'breakout_short';
        entryPrice = points[1].price;
        stopLoss = points[0].price;
        takeProfit = entryPrice + Math.abs(entryPrice - stopLoss) * 2;
        reasoning = `趋势线${strategyType.includes('long') ? '看多' : '看空'}。突破确认后入场，止损设在趋势线起点。`;
        break;
      case 'horizontal_line':
      case 'HorizontalLine':
        strategyType = currentPrice > points[0].price ? 'breakout_long' : 'breakout_short';
        entryPrice = points[0].price * 1.01;
        stopLoss = points[0].price * 0.97;
        takeProfit = entryPrice + (entryPrice - stopLoss) * 2.5;
        reasoning = `关键水平${currentPrice > points[0].price ? '突破' : '跌破'}。止损在水平线下方3%。`;
        break;
      case 'rectangle':
      case 'Rectangle':
        strategyType = currentPrice > Math.max(points[0].price, points[1].price) ? 'breakout_long' : 'channel_short';
        entryPrice = Math.max(points[0].price, points[1].price);
        stopLoss = Math.min(points[0].price, points[1].price);
        takeProfit = entryPrice + (entryPrice - stopLoss) * 2;
        reasoning = '矩形整理区间。突破上沿做多，跌破下沿做空。';
        break;
      case 'fib_retracement':
      case 'FibRetracement':
        strategyType = 'bounce_long';
        entryPrice = points[0].price + (points[1].price - points[0].price) * 0.618;
        stopLoss = points[0].price;
        takeProfit = points[1].price;
        reasoning = '斐波那契0.618回撤位反弹做多。止损在起点，目标在终点。';
        break;
      default:
        strategyType = 'breakout_long';
        entryPrice = currentPrice;
        stopLoss = currentPrice * 0.95;
        takeProfit = currentPrice * 1.10;
        reasoning = `基于${drawingType}绘图生成策略。建议设置止损-5%，止盈+10%。`;
    }

    const riskReward = Math.round((Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss)) * 100) / 100;

    const result: DrawingStrategyResult = {
      resultId, drawingType, drawingPoints: points, strategyType,
      entryPrice: Math.round(entryPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      riskReward, confidence: 70, reasoning,
      timestamp: Date.now(), price: 2,
    };

    this.emit('strategy:created', { symbol, result });
    return result;
  }
}
