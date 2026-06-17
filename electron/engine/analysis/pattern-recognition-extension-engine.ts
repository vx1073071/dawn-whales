// ── R269 JVS-4 形态21扩展引擎 (PatternRecognitionExtensionEngine) ──
// 新增20种K线形态: 总形态数31→51
// 三只乌鸦/三白兵/上升下降三法/梯底/梯顶/刺透/乌云盖顶/
// 十字孕线/母子/弃婴/反冲/分手线/约会线/塔顶/塔底/倒锤子/上吊线/流星/捉腰带

import type { KLine, PatternMatch } from './pattern-recognition-21-engine';

export type ExtPatternType =
  | 'three_black_crows' | 'three_white_soldiers' | 'rising_three_methods' | 'falling_three_methods'
  | 'ladder_bottom' | 'ladder_top'
  | 'piercing_line' | 'dark_cloud_cover'
  | 'harami_cross' | 'mother_child'
  | 'abandoned_baby' | 'counterattack'
  | 'separating_lines' | 'rendezvous'
  | 'tower_top' | 'tower_bottom'
  | 'inverted_hammer' | 'hanging_man'
  | 'shooting_star' | 'belt_hold';

export interface ExtPatternMatch extends PatternMatch {
  pattern: ExtPatternType | PatternMatch['pattern'];
  subType?: string;
  confirmationIndex?: number;
}

export interface PatternRecognitionExtConfig {
  candleBodyThreshold?: number;
  dojiThreshold?: number;
  trendLookback?: number;
}

const DEFAULT_EXT_CONFIG: Required<PatternRecognitionExtConfig> = {
  candleBodyThreshold: 0.1, dojiThreshold: 0.1, trendLookback: 5,
};

// ═══════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════

export class PatternRecognitionExtensionEngine {
  private config: Required<PatternRecognitionExtConfig>;
  private data: Map<string, KLine[]> = new Map();

  constructor(config?: PatternRecognitionExtConfig) { this.config = { ...DEFAULT_EXT_CONFIG, ...config }; }
  reset(): void { this.data.clear(); }
  updateConfig(patch: Partial<PatternRecognitionExtConfig>): void { this.config = { ...this.config, ...patch }; }
  loadData(symbol: string, bars: KLine[]): void { this.data.set(symbol.toUpperCase(), bars); }
  getData(symbol: string): KLine[] { return this.data.get(symbol.toUpperCase()) || []; }

  // ═══════════ 1. Three Black Crows (三只乌鸦) ═══════════
  detectThreeBlackCrows(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 4) return res;
    for (let i = 3; i < bars.length; i++) {
      const a = bars[i - 3], b = bars[i - 2], c = bars[i - 1];
      if (a.c >= a.o || b.c >= b.o || c.c >= c.o) continue;
      if (!this._isBearish(b) || !this._isBearish(c)) continue;
      if (b.o >= a.o || b.o <= a.c) continue;
      if (c.o >= b.o || c.o <= b.c) continue;
      if (this._upWick(b) / Math.max(b.h - b.l, 0.0001) > 0.3) continue;
      if (this._upWick(c) / Math.max(c.h - c.l, 0.0001) > 0.3) continue;
      if (b.c >= a.c || c.c >= b.c) continue;
      res.push({ pattern: 'three_black_crows', name: '三只乌鸦', direction: 'bearish', reliability: 80, startIndex: i - 3, endIndex: i - 1, priceLevels: { target: c.c * 0.95 }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 2. Three White Soldiers (三白兵) ═══════════
  detectThreeWhiteSoldiers(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 4) return res;
    for (let i = 3; i < bars.length; i++) {
      const a = bars[i - 3], b = bars[i - 2], c = bars[i - 1];
      if (a.c <= a.o || b.c <= b.o || c.c <= c.o) continue;
      if (!this._isBullish(b) || !this._isBullish(c)) continue;
      if (b.o <= a.o || b.o >= a.c) continue;
      if (c.o <= b.o || c.o >= b.c) continue;
      if (this._loWick(b) / Math.max(b.h - b.l, 0.0001) > 0.3) continue;
      if (this._loWick(c) / Math.max(c.h - c.l, 0.0001) > 0.3) continue;
      if (b.c <= a.c || c.c <= b.c) continue;
      res.push({ pattern: 'three_white_soldiers', name: '三白兵', direction: 'bullish', reliability: 80, startIndex: i - 3, endIndex: i - 1, priceLevels: { target: c.c * 1.05 }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 3. Rising Three Methods (上升三法) ═══════════
  detectRisingThreeMethods(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 6) return res;
    for (let i = 5; i < bars.length; i++) {
      const d1 = bars[i - 5], d2 = bars[i - 4], d3 = bars[i - 3], d4 = bars[i - 2], d5 = bars[i - 1];
      if (!this._isBullish(d1) || !this._isLong(d1)) continue;
      if ([d2, d3, d4].some((c) => c.h > d1.h || c.l < d1.l)) continue;
      const d1b = Math.abs(d1.c - d1.o);
      if ([d2, d3, d4].some((c) => Math.abs(c.c - c.o) > d1b * 0.3)) continue;
      if (!this._isBullish(d5) || !this._isLong(d5) || d5.c <= d1.h) continue;
      res.push({ pattern: 'rising_three_methods', name: '上升三法', direction: 'bullish', reliability: 80, startIndex: i - 5, endIndex: i - 1, priceLevels: { target: d5.c * 1.03 }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 4. Falling Three Methods (下降三法) ═══════════
  detectFallingThreeMethods(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 6) return res;
    for (let i = 5; i < bars.length; i++) {
      const d1 = bars[i - 5], d2 = bars[i - 4], d3 = bars[i - 3], d4 = bars[i - 2], d5 = bars[i - 1];
      if (!this._isBearish(d1) || !this._isLong(d1)) continue;
      if ([d2, d3, d4].some((c) => c.h > d1.h || c.l < d1.l)) continue;
      const d1b = Math.abs(d1.c - d1.o);
      if ([d2, d3, d4].some((c) => Math.abs(c.c - c.o) > d1b * 0.3)) continue;
      if (!this._isBearish(d5) || !this._isLong(d5) || d5.c >= d1.l) continue;
      res.push({ pattern: 'falling_three_methods', name: '下降三法', direction: 'bearish', reliability: 80, startIndex: i - 5, endIndex: i - 1, priceLevels: { target: d5.c * 0.97 }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 5. Ladder Bottom (梯底) ═══════════
  detectLadderBottom(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 5) return res;
    for (let i = 4; i < bars.length; i++) {
      const a = bars[i - 4], b = bars[i - 3], c = bars[i - 2], d = bars[i - 1];
      if (!this._isBearish(a) || !this._isBearish(b) || !this._isBearish(c)) continue;
      if (b.c >= a.c || c.c >= b.c) continue;
      if (!this._isBullish(d)) continue;
      if (this._loWick(d) / Math.max(d.h - d.l, 0.0001) < 0.6) continue;
      if (d.o > c.c) continue;
      res.push({ pattern: 'ladder_bottom', name: '梯底', direction: 'bullish', reliability: 70, startIndex: i - 4, endIndex: i - 1, priceLevels: { target: d.h * 1.03 }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 6. Ladder Top (梯顶) ═══════════
  detectLadderTop(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 5) return res;
    for (let i = 4; i < bars.length; i++) {
      const a = bars[i - 4], b = bars[i - 3], c = bars[i - 2], d = bars[i - 1];
      if (!this._isBullish(a) || !this._isBullish(b) || !this._isBullish(c)) continue;
      if (b.c <= a.c || c.c <= b.c) continue;
      if (!this._isBearish(d)) continue;
      if (this._upWick(d) / Math.max(d.h - d.l, 0.0001) < 0.6) continue;
      if (d.o < c.c) continue;
      res.push({ pattern: 'ladder_top', name: '梯顶', direction: 'bearish', reliability: 70, startIndex: i - 4, endIndex: i - 1, priceLevels: { target: d.l * 0.97 }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 7. Piercing Line (刺透) ═══════════
  detectPiercingLine(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isBearish(d1) || !this._isBullish(d2)) continue;
      if (d2.o >= d1.l) continue;
      const mid = (d1.o + d1.c) / 2;
      if (d2.c <= mid || d2.c >= d1.o) continue;
      res.push({ pattern: 'piercing_line', name: '刺透', direction: 'bullish', reliability: 68, startIndex: i - 1, endIndex: i, priceLevels: { target: d2.c * 1.03 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 8. Dark Cloud Cover (乌云盖顶) ═══════════
  detectDarkCloudCover(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isBullish(d1) || !this._isBearish(d2)) continue;
      if (d2.o <= d1.h) continue;
      const mid = (d1.o + d1.c) / 2;
      if (d2.c >= mid || d2.c <= d1.o) continue;
      res.push({ pattern: 'dark_cloud_cover', name: '乌云盖顶', direction: 'bearish', reliability: 68, startIndex: i - 1, endIndex: i, priceLevels: { target: d2.c * 0.97 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 9. Harami Cross (十字孕线) ═══════════
  detectHaramiCross(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isLong(d1)) continue;
      if (!this._isDoji(d2)) continue;
      if (d2.h > d1.h || d2.l < d1.l) continue;
      res.push({ pattern: 'harami_cross', name: '十字孕线', direction: d1.c > d1.o ? 'bearish' : 'bullish', reliability: 75, startIndex: i - 1, endIndex: i, priceLevels: {}, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 10. Mother-Child (母子) ═══════════
  detectMotherChild(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isLong(d1)) continue;
      if (d2.h > d1.h || d2.l < d1.l) continue;
      const d2b = Math.abs(d2.c - d2.o), d1b = Math.abs(d1.c - d1.o);
      if (d2b > d1b * 0.5) continue;
      res.push({ pattern: 'mother_child', name: '母子', direction: d2.c > d2.o ? 'bullish' : 'bearish', reliability: 60, startIndex: i - 1, endIndex: i, priceLevels: {}, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 11. Abandoned Baby (弃婴) ═══════════
  detectAbandonedBaby(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 3) return res;
    for (let i = 2; i < bars.length; i++) {
      const d1 = bars[i - 2], d2 = bars[i - 1], d3 = bars[i];
      if (!this._isBearish(d1) || !this._isLong(d1)) continue;
      if (!this._isDoji(d2)) continue;
      if (d2.h >= d1.l) continue;
      if (!this._isBullish(d3) || !this._isLong(d3)) continue;
      if (d3.l <= d2.h) continue;
      res.push({ pattern: 'abandoned_baby', name: '弃婴', direction: 'bullish', reliability: 90, startIndex: i - 2, endIndex: i, priceLevels: { target: d3.c * 1.05 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 12. Counterattack (反冲) ═══════════
  detectCounterattack(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isLong(d1) || !this._isLong(d2)) continue;
      if (d1.c > d1.o && d2.c < d2.o && Math.abs(d1.c - d2.c) / Math.max(d2.h - d2.l, 0.01) < 0.1)
        res.push({ pattern: 'counterattack', name: '反冲', direction: 'bullish', reliability: 65, startIndex: i - 1, endIndex: i, priceLevels: {}, confirmationIndex: i + 1 });
      else if (d1.c < d1.o && d2.c > d2.o && Math.abs(d1.c - d2.c) / Math.max(d2.h - d2.l, 0.01) < 0.1)
        res.push({ pattern: 'counterattack', name: '反冲', direction: 'bearish', reliability: 65, startIndex: i - 1, endIndex: i, priceLevels: {}, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 13. Separating Lines (分手线) ═══════════
  detectSeparatingLines(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isLong(d1) || !this._isLong(d2)) continue;
      const same = (d1.c > d1.o && d2.c > d2.o) || (d1.c < d1.o && d2.c < d2.o);
      if (!same) continue;
      if (d2.o > 0 && Math.abs(d2.o - d1.o) / d2.o > 0.02) continue;
      res.push({ pattern: 'separating_lines', name: '分手线', direction: d2.c > d2.o ? 'bullish' : 'bearish', reliability: 60, startIndex: i - 1, endIndex: i, priceLevels: {}, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 14. Rendezvous (约会线) ═══════════
  detectRendezvous(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const d1 = bars[i - 1], d2 = bars[i];
      if (!this._isLong(d1) || !this._isLong(d2)) continue;
      const opp = (d1.c > d1.o && d2.c < d2.o) || (d1.c < d1.o && d2.c > d2.o);
      if (!opp) continue;
      if (d1.c > 0 && Math.abs(d2.c - d1.c) / d1.c > 0.02) continue;
      res.push({ pattern: 'rendezvous', name: '约会线', direction: d2.c > d2.o ? 'bullish' : 'bearish', reliability: 70, startIndex: i - 1, endIndex: i, priceLevels: {}, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 15. Tower Top (塔顶) ═══════════
  detectTowerTop(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 5) return res;
    for (let i = 4; i < bars.length; i++) {
      const d1 = bars[i - 4], d2 = bars[i - 3], d3 = bars[i - 2], d4 = bars[i - 1];
      if (!this._isBullish(d1) || !this._isBullish(d2) || d2.c <= d1.c) continue;
      if (!this._isBearish(d3) || !this._isBearish(d4) || d3.c >= d2.h || d4.c >= d3.c) continue;
      if (d4.l > d1.o) continue;
      res.push({ pattern: 'tower_top', name: '塔顶', direction: 'bearish', reliability: 75, startIndex: i - 4, endIndex: i - 1, priceLevels: { neckline: d1.o, target: d1.o - (d2.h - d1.o) }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 16. Tower Bottom (塔底) ═══════════
  detectTowerBottom(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 5) return res;
    for (let i = 4; i < bars.length; i++) {
      const d1 = bars[i - 4], d2 = bars[i - 3], d3 = bars[i - 2], d4 = bars[i - 1];
      if (!this._isBearish(d1) || !this._isBearish(d2) || d2.c >= d1.c) continue;
      if (!this._isBullish(d3) || !this._isBullish(d4) || d3.c <= d2.l || d4.c <= d3.c) continue;
      if (d4.h < d1.o) continue;
      res.push({ pattern: 'tower_bottom', name: '塔底', direction: 'bullish', reliability: 75, startIndex: i - 4, endIndex: i - 1, priceLevels: { neckline: d1.o, target: d1.o + (d1.o - d2.l) }, confirmationIndex: i });
    }
    return res;
  }

  // ═══════════ 17. Inverted Hammer (倒锤子) ═══════════
  detectInvertedHammer(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1], curr = bars[i], rng = curr.h - curr.l;
      if (rng <= 0 || prev.c >= prev.o) continue;
      if (Math.abs(curr.c - curr.o) > rng * 0.3) continue;
      if (this._loWick(curr) / rng > 0.2 || this._upWick(curr) / rng < 0.5) continue;
      res.push({ pattern: 'inverted_hammer', name: '倒锤子', direction: 'bullish', reliability: 60, startIndex: i, endIndex: i, priceLevels: { target: curr.h + rng * 0.5 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 18. Hanging Man (上吊线) ═══════════
  detectHangingMan(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1], curr = bars[i], rng = curr.h - curr.l;
      if (rng <= 0 || prev.c <= prev.o) continue;
      if (Math.abs(curr.c - curr.o) > rng * 0.3) continue;
      if (this._upWick(curr) / rng > 0.2 || this._loWick(curr) / rng < 0.6) continue;
      res.push({ pattern: 'hanging_man', name: '上吊线', direction: 'bearish', reliability: 65, startIndex: i, endIndex: i, priceLevels: { target: curr.l - rng * 0.5 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 19. Shooting Star (流星) ═══════════
  detectShootingStar(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1], curr = bars[i], rng = curr.h - curr.l;
      if (rng <= 0 || prev.c <= prev.o) continue;
      if (Math.abs(curr.c - curr.o) > rng * 0.3) continue;
      if (this._loWick(curr) / rng > 0.2 || this._upWick(curr) / rng < 0.6) continue;
      res.push({ pattern: 'shooting_star', name: '流星', direction: 'bearish', reliability: 70, startIndex: i, endIndex: i, priceLevels: { target: curr.l - rng * 0.5 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 20. Belt Hold (捉腰带) ═══════════
  detectBeltHold(symbol: string): ExtPatternMatch[] {
    const bars = this.getData(symbol); const res: ExtPatternMatch[] = [];
    if (bars.length < 2) return res;
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1], curr = bars[i], rng = curr.h - curr.l;
      if (rng <= 0) continue;
      const body = Math.abs(curr.c - curr.o);
      if (body < rng * 0.6) continue;
      if (curr.c > curr.o && this._loWick(curr) / rng < 0.15 && this._upWick(curr) / rng < 0.2 && prev.c < prev.o)
        res.push({ pattern: 'belt_hold', name: '捉腰带', direction: 'bullish', reliability: 55, startIndex: i, endIndex: i, priceLevels: { target: curr.c * 1.03 }, confirmationIndex: i + 1 });
      else if (curr.c < curr.o && this._upWick(curr) / rng < 0.15 && this._loWick(curr) / rng < 0.2 && prev.c > prev.o)
        res.push({ pattern: 'belt_hold', name: '捉腰带', direction: 'bearish', reliability: 55, startIndex: i, endIndex: i, priceLevels: { target: curr.c * 0.97 }, confirmationIndex: i + 1 });
    }
    return res;
  }

  // ═══════════ 全量扫描 ═══════════
  detectAll(symbol: string): ExtPatternMatch[] {
    return [
      ...this.detectThreeBlackCrows(symbol),
      ...this.detectThreeWhiteSoldiers(symbol),
      ...this.detectRisingThreeMethods(symbol),
      ...this.detectFallingThreeMethods(symbol),
      ...this.detectLadderBottom(symbol),
      ...this.detectLadderTop(symbol),
      ...this.detectPiercingLine(symbol),
      ...this.detectDarkCloudCover(symbol),
      ...this.detectHaramiCross(symbol),
      ...this.detectMotherChild(symbol),
      ...this.detectAbandonedBaby(symbol),
      ...this.detectCounterattack(symbol),
      ...this.detectSeparatingLines(symbol),
      ...this.detectRendezvous(symbol),
      ...this.detectTowerTop(symbol),
      ...this.detectTowerBottom(symbol),
      ...this.detectInvertedHammer(symbol),
      ...this.detectHangingMan(symbol),
      ...this.detectShootingStar(symbol),
      ...this.detectBeltHold(symbol),
    ];
  }

  summarize(symbol: string): { total: number; bullish: number; bearish: number; neutral: number; byPattern: Record<string, number> } {
    const all = this.detectAll(symbol);
    const byPattern: Record<string, number> = {};
    let bull = 0, bear = 0, neut = 0;
    for (const m of all) {
      byPattern[m.pattern as string] = (byPattern[m.pattern as string] || 0) + 1;
      if (m.direction === 'bullish') bull++;
      else if (m.direction === 'bearish') bear++;
      else neut++;
    }
    return { total: all.length, bullish: bull, bearish: bear, neutral: neut, byPattern };
  }

  // ═══════════ helpers ═══════════
  private _isBullish(c: KLine): boolean { return c.c > c.o; }
  private _isBearish(c: KLine): boolean { return c.c < c.o; }
  private _upWick(c: KLine): number { return c.h - Math.max(c.o, c.c); }
  private _loWick(c: KLine): number { return Math.min(c.o, c.c) - c.l; }
  private _isLong(c: KLine): boolean { return Math.abs(c.c - c.o) / Math.max(c.h - c.l, 0.0001) > this.config.candleBodyThreshold * 5; }
  private _isDoji(c: KLine): boolean { return Math.abs(c.c - c.o) / Math.max(c.h - c.l, 0.0001) < this.config.dojiThreshold; }
}

// Singleton
let prExtInstance: PatternRecognitionExtensionEngine | null = null;
export function getPatternRecognitionExtensionEngine(config?: PatternRecognitionExtConfig): PatternRecognitionExtensionEngine {
  if (!prExtInstance) prExtInstance = new PatternRecognitionExtensionEngine(config);
  return prExtInstance;
}
export function resetPatternRecognitionExtensionEngine(): void { prExtInstance = null; }
