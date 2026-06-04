// T81: Strategy Template System
export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'mean-reversion' | 'momentum' | 'breakout' | 'arbitrage' | 'ml';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  parameters: {
    name: string;
    label: string;
    type: 'number' | 'select' | 'boolean';
    default: any;
    min?: number;
    max?: number;
    step?: number;
    options?: { label: string; value: any }[];
    description: string;
  }[];
  code?: string;
  tags: string[];
}

export const strategyTemplates: StrategyTemplate[] = [
  {
    id: 'ma-cross',
    name: 'MA Crossover',
    description: 'Classic golden cross / death cross strategy using dual moving averages',
    category: 'trend',
    difficulty: 'beginner',
    tags: ['ma', 'trend', 'crossover'],
    parameters: [
      { name: 'fastPeriod', label: 'Fast MA', type: 'number', default: 10, min: 2, max: 100, step: 1, description: 'Short MA period' },
      { name: 'slowPeriod', label: 'Slow MA', type: 'number', default: 30, min: 5, max: 300, step: 1, description: 'Long MA period' },
      { name: 'minVolume', label: 'Min Volume', type: 'number', default: 100000, min: 0, max: 100000000, step: 1000, description: 'Minimum daily volume' },
    ],
  },
  {
    id: 'bollinger-bands',
    name: 'Bollinger Bands Reversal',
    description: 'Mean reversion using Bollinger Bands — buy at lower band, sell at upper band',
    category: 'mean-reversion',
    difficulty: 'intermediate',
    tags: ['bollinger', 'reversal', 'mean-reversion'],
    parameters: [
      { name: 'period', label: 'Period', type: 'number', default: 20, min: 5, max: 100, step: 1, description: 'BB period' },
      { name: 'stdDev', label: 'Standard Deviations', type: 'number', default: 2, min: 1, max: 4, step: 0.1, description: 'Band width multiplier' },
    ],
  },
  {
    id: 'rsi-extreme',
    name: 'RSI Extreme',
    description: 'Overbought/oversold reversal using RSI with confirmation',
    category: 'mean-reversion',
    difficulty: 'beginner',
    tags: ['rsi', 'reversal', 'oscillator'],
    parameters: [
      { name: 'period', label: 'RSI Period', type: 'number', default: 14, min: 5, max: 50, step: 1, description: 'RSI calculation period' },
      { name: 'oversold', label: 'Oversold', type: 'number', default: 30, min: 10, max: 40, step: 1, description: 'Buy when RSI below this' },
      { name: 'overbought', label: 'Overbought', type: 'number', default: 70, min: 60, max: 90, step: 1, description: 'Sell when RSI above this' },
    ],
  },
  {
    id: 'macd-signal',
    name: 'MACD Signal',
    description: 'MACD line crossover with signal line',
    category: 'momentum',
    difficulty: 'intermediate',
    tags: ['macd', 'momentum', 'trend'],
    parameters: [
      { name: 'fast', label: 'Fast EMA', type: 'number', default: 12, min: 2, max: 50, step: 1, description: 'Fast EMA period' },
      { name: 'slow', label: 'Slow EMA', type: 'number', default: 26, min: 5, max: 100, step: 1, description: 'Slow EMA period' },
      { name: 'signal', label: 'Signal EMA', type: 'number', default: 9, min: 2, max: 50, step: 1, description: 'Signal line period' },
    ],
  },
  {
    id: 'breakout',
    name: 'Breakout Trading',
    description: 'Buy at resistance breakout with volume confirmation',
    category: 'breakout',
    difficulty: 'advanced',
    tags: ['breakout', 'volume', 'volatility'],
    parameters: [
      { name: 'lookback', label: 'Lookback Period', type: 'number', default: 20, min: 5, max: 100, step: 1, description: 'High/low lookback' },
      { name: 'volumeMultiplier', label: 'Volume Multiplier', type: 'number', default: 1.5, min: 1, max: 5, step: 0.1, description: 'Volume must be X times average' },
    ],
  },
  {
    id: 'dual-thrust',
    name: 'Dual Thrust',
    description: 'Classic breakout system — buy upper line, sell lower line',
    category: 'breakout',
    difficulty: 'intermediate',
    tags: ['dual-thrust', 'breakout', 'range'],
    parameters: [
      { name: 'lookback', label: 'Lookback Days', type: 'number', default: 5, min: 2, max: 30, step: 1, description: 'N-day range' },
      { name: 'k1', label: 'Upper K', type: 'number', default: 0.7, min: 0.3, max: 1.5, step: 0.1, description: 'Upper breakout threshold' },
      { name: 'k2', label: 'Lower K', type: 'number', default: 0.7, min: 0.3, max: 1.5, step: 0.1, description: 'Lower breakout threshold' },
    ],
  },
  {
    id: 'grid',
    name: 'Grid Trading',
    description: 'Place buy/sell orders at predefined price intervals for range-bound markets',
    category: 'arbitrage',
    difficulty: 'intermediate',
    tags: ['grid', 'range', 'automation'],
    parameters: [
      { name: 'gridLevels', label: 'Grid Levels', type: 'number', default: 10, min: 3, max: 50, step: 1, description: 'Number of grid lines' },
      { name: 'gridSpacing', label: 'Grid Spacing %', type: 'number', default: 2, min: 0.5, max: 10, step: 0.5, description: 'Spacing between grid lines' },
      { name: 'positionPerGrid', label: 'Position Size', type: 'number', default: 100, min: 1, max: 100000, step: 1, description: 'Shares per grid level' },
    ],
  },
  {
    id: 'ml-trend',
    name: 'ML Trend Classifier',
    description: 'Use linear regression to predict next bar direction',
    category: 'ml',
    difficulty: 'advanced',
    tags: ['ml', 'regression', 'prediction'],
    parameters: [
      { name: 'featureWindow', label: 'Feature Window', type: 'number', default: 20, min: 5, max: 100, step: 1, description: 'Bars used as features' },
      { name: 'confidenceMin', label: 'Min Confidence', type: 'number', default: 0.6, min: 0.5, max: 1.0, step: 0.05, description: 'Minimum prediction confidence' },
    ],
  },
];

export class TemplateRegistry {
  private templates = new Map<string, StrategyTemplate>();

  constructor() {
    for (const t of strategyTemplates) {
      this.templates.set(t.id, t);
    }
  }

  get(id: string): StrategyTemplate | undefined {
    return this.templates.get(id);
  }

  getAll(): StrategyTemplate[] {
    return Array.from(this.templates.values());
  }

  byCategory(category: StrategyTemplate['category']): StrategyTemplate[] {
    return this.getAll().filter(t => t.category === category);
  }

  byDifficulty(level: StrategyTemplate['difficulty']): StrategyTemplate[] {
    return this.getAll().filter(t => t.difficulty === level);
  }

  search(query: string): StrategyTemplate[] {
    const q = query.toLowerCase();
    return this.getAll().filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.includes(q)) ||
      t.description.toLowerCase().includes(q)
    );
  }
}

export const templateRegistry = new TemplateRegistry();
