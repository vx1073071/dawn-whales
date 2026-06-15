/**
 * BlindBoxEngine.ts — R210 J2: 因子组合盲盒引擎
 *
 * AI (DeepSeek) generates 3 factor combos based on user portfolio:
 *   - 🟢 Card 1: FREE preview (引流)
 *   - 🔒 Card 2: 1U unlock (DeepSeek interpretation + backtest)
 *   - 🔒 Card 3: 1U unlock (DeepSeek interpretation + backtest)
 *
 * Flow: user portfolio → AI → 3 combos → 1 free + 2×1U → apply to template
 *
 * ≥250 lines.
 */

// ─── Types ────────────────────────────────────────────────────────────

export interface BlindBoxRequest {
  userId: string;
  holdings: BlindBoxHolding[]; // user's current portfolio
  riskTolerance?: 'low' | 'medium' | 'high';
  balanceUSDT: number;
}

export interface BlindBoxHolding {
  symbol: string;
  market: string; // US/HK/CRYPTO/etc
  weight: number; // 0-1
}

export interface FactorCombo {
  id: string;
  name: string;
  nameCN: string;
  factorIds: string[];
  weights: number[];
  formula: string;
  rationale: string;
  rationaleCN: string;
  expectedIC: number;
  backtestSharpe?: number;
  backtestMaxDD?: number;
  applicableTemplate?: string; // template id to apply
}

export interface BlindBoxCard {
  cardNumber: 1 | 2 | 3;
  combo: FactorCombo;
  unlocked: boolean; // card 1 always unlocked
  priceUSDT: number; // 0 for card 1, 1 for 2/3
  deepseekAdvice?: string; // only after unlock
  deepseekAdviceCN?: string;
}

export interface BlindBoxResult {
  requestId: string;
  userId: string;
  generatedAt: number;
  cards: BlindBoxCard[];
  totalUnlockCost: number;
}

export interface UnlockResult {
  success: boolean;
  cardNumber: number;
  chargedUSDT: number;
  card?: BlindBoxCard;
  error?: string;
}

// ─── Engine ────────────────────────────────────────────────────────────

export class BlindBoxEngine {
  private boxes = new Map<string, BlindBoxResult>(); // requestId → result
  private userUnlocks = new Map<string, Set<number>>(); // `${userId}:${requestId}` → unlocked cards
  private totalRevenue = 0;

  // ── Generate Blind Box (AI mock → DeepSeek in production) ──────────

  async generate(req: BlindBoxRequest): Promise<BlindBoxResult> {
    const combos = this.aiGenerateCombos(req.holdings, req.riskTolerance);
    const requestId = 'bb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const cards: BlindBoxCard[] = combos.map((combo, i) => ({
      cardNumber: (i + 1) as 1 | 2 | 3,
      combo,
      unlocked: i === 0, // card 1 always free
      priceUSDT: i === 0 ? 0 : 1,
    }));

    const result: BlindBoxResult = {
      requestId,
      userId: req.userId,
      generatedAt: Date.now(),
      cards,
      totalUnlockCost: 2, // 2×1U
    };
    this.boxes.set(requestId, result);
    return result;
  }

  private aiGenerateCombos(holdings: BlindBoxHolding[], risk?: string): FactorCombo[] {
    // Mock AI — in production replaced by DeepSeek call
    const baseFactors = this.suggestFactors(holdings, risk);
    return [
      {
        id: 'combo_' + Date.now() + '_1',
        name: 'Momentum Core', nameCN: '动量核心',
        factorIds: baseFactors[0].slice(0, 3),
        weights: [0.40, 0.35, 0.25],
        formula: '0.40*MOM + 0.35*VOL + 0.25*TREND',
        rationale: 'Suitable for trending markets. Captures momentum with volatility filter.',
        rationaleCN: '适合趋势市场。动量+波动率过滤，锁定趋势收益。',
        expectedIC: 0.09,
        backtestSharpe: 1.12, backtestMaxDD: 0.18,
        applicableTemplate: 'us-momentum-value',
      },
      {
        id: 'combo_' + Date.now() + '_2',
        name: 'Value + Quality', nameCN: '价值质量',
        factorIds: baseFactors[0].slice(3, 6).length >= 3
          ? baseFactors[0].slice(3, 6)
          : ['PE_RATIO', 'PB_RATIO', 'ROE'],
        weights: [0.35, 0.30, 0.35],
        formula: '0.35*PE + 0.30*PB + 0.35*ROE',
        rationale: 'Defensive allocation. Undervalued stocks with strong fundamentals.',
        rationaleCN: '防御型配置。低估值+强基本面，熊市抗跌。',
        expectedIC: 0.07,
        backtestSharpe: 0.95, backtestMaxDD: 0.12,
        applicableTemplate: 'us-value-hunting',
      },
      {
        id: 'combo_' + Date.now() + '_3',
        name: 'Low Vol Defense', nameCN: '低波防御',
        factorIds: risk === 'high'
          ? ['VOLATILITY', 'BETA', 'SHARPE']
          : ['DIVIDEND', 'VOLATILITY', 'BETA'],
        weights: [0.35, 0.35, 0.30],
        formula: '0.35*DIV + 0.35*VOL + 0.30*BETA',
        rationale: risk === 'high'
          ? 'Volatility-based alpha — high risk appetite targets volatile breakouts.'
          : 'Low volatility anomaly — boring stocks outperform in long run.',
        rationaleCN: risk === 'high'
          ? '高波动阿尔法 — 高波动策略捕捉突破性收益。'
          : '低波动异象 — 低波动组合长期跑赢市场。',
        expectedIC: 0.06,
        backtestSharpe: 0.88, backtestMaxDD: 0.10,
        applicableTemplate: 'us-low-vol-defense',
      },
    ];
  }

  private suggestFactors(holdings: BlindBoxHolding[], risk?: string): string[][] {
    const markets = [...new Set(holdings.map(h => h.market))];
    const base1 = ['MOM_20', 'TREND_STRENGTH', 'VOL_BREAKOUT'];
    const base2 = ['PE_RATIO', 'PB_RATIO', 'ROE', 'DIVIDEND', 'QUALITY'];

    if (markets.includes('CRYPTO')) {
      return [['FUNDING_RATE', 'MOM_1M', 'OPEN_INTEREST', 'VOL_BREAKOUT', 'TURNOVER'], ['BTC_BETA', 'ETH_BETA']];
    }
    if (risk === 'high') {
      return [['MOM_20', 'VOL_BREAKOUT', 'TURNOVER', 'SHARPE', 'BETA'], base2];
    }
    return [base1, base2];
  }

  // ── Unlock ─────────────────────────────────────────────────────────

  unlockCard(requestId: string, userId: string, cardNumber: number, balanceUSDT: number): UnlockResult {
    const box = this.boxes.get(requestId);
    if (!box) return { success: false, cardNumber, chargedUSDT: 0, error: 'Box not found' };
    if (cardNumber < 1 || cardNumber > 3) return { success: false, cardNumber, chargedUSDT: 0, error: 'Invalid card number' };

    const card = box.cards[cardNumber - 1];
    if (!card) return { success: false, cardNumber, chargedUSDT: 0, error: 'Card not found' };
    if (card.cardNumber === 1) return { success: true, cardNumber: 1, chargedUSDT: 0, card }; // already free

    const unlockKey = userId + ':' + requestId;
    let unlocks = this.userUnlocks.get(unlockKey);
    if (!unlocks) { unlocks = new Set(); this.userUnlocks.set(unlockKey, unlocks); }
    if (unlocks.has(cardNumber)) return { success: true, cardNumber, chargedUSDT: 0, card }; // already unlocked

    if (balanceUSDT < card.priceUSDT) {
      return { success: false, cardNumber, chargedUSDT: 0, error: 'Insufficient balance' };
    }

    // Unlock
    unlocks.add(cardNumber);
    card.unlocked = true;
    card.deepseekAdviceCN = this.generateAdvice(card.combo);
    card.deepseekAdvice = this.generateAdviceEn(card.combo);
    this.totalRevenue += card.priceUSDT;

    return { success: true, cardNumber, chargedUSDT: card.priceUSDT, card };
  }

  private generateAdvice(combo: FactorCombo): string {
    return '【' + combo.nameCN + '】因子IC=' + combo.expectedIC.toFixed(3)
      + '，夏普=' + (combo.backtestSharpe ?? 0).toFixed(2)
      + '。建议持有周期2-4周，止损' + ((combo.backtestMaxDD ?? 0.15) * 100).toFixed(0) + '%。可一键应用到"' + (combo.applicableTemplate ?? '自定义') + '"策略模板。';
  }

  private generateAdviceEn(combo: FactorCombo): string {
    return '[' + combo.name + '] IC=' + combo.expectedIC.toFixed(3)
      + ', Sharpe=' + (combo.backtestSharpe ?? 0).toFixed(2)
      + '. Suggested holding: 2-4 weeks, stop-loss at ' + ((combo.backtestMaxDD ?? 0.15) * 100).toFixed(0) + '%. Apply to "'
      + (combo.applicableTemplate ?? 'Custom') + '" template.';
  }

  // ── Management ──────────────────────────────────────────────────────

  getBox(requestId: string): BlindBoxResult | null {
    return this.boxes.get(requestId) ?? null;
  }

  isCardUnlocked(userId: string, requestId: string, cardNumber: number): boolean {
    return this.userUnlocks.get(userId + ':' + requestId)?.has(cardNumber) ?? false;
  }

  getStats() {
    return {
      totalBoxes: this.boxes.size,
      totalRevenue: this.totalRevenue,
      avgCardsUnlocked: this.userUnlocks.size > 0
        ? Array.from(this.userUnlocks.values()).reduce((s, u) => s + u.size, 0) / this.userUnlocks.size
        : 0,
    };
  }

  // ── IPC ────────────────────────────────────────────────────────────

  static registerIPC(mainProcess: any, engine: BlindBoxEngine): void {
    mainProcess.handle('blindbox:generate', async (_e: any, req: BlindBoxRequest) =>
      engine.generate(req));
    mainProcess.handle('blindbox:unlock', async (_e: any, requestId: string, userId: string, cardNumber: number, balance: number) =>
      engine.unlockCard(requestId, userId, cardNumber, balance));
    mainProcess.handle('blindbox:get', async (_e: any, requestId: string) =>
      engine.getBox(requestId));
    mainProcess.handle('blindbox:stats', async () => engine.getStats());
  }

  reset(): void {
    this.boxes.clear();
    this.userUnlocks.clear();
    this.totalRevenue = 0;
  }
}
