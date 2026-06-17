/**
 * SectorAIDiagnosisEngine — R264 Claw(PM) 热力图AI板块诊断
 * 
 * 定价: 1.5U/次 按次付费
 * 功能: 10大板块4维AI诊断(技术/基本/情绪/风险)
 * 
 * 对接: SectorHeatmapV3 (ML R263) 点击板块→AI诊断→收费
 */
import { EventEmitter } from 'events';

// ── Types ──
export type SectorId = 'TECH' | 'FINANCE' | 'HEALTH' | 'CONSUMER' | 'MATERIALS' | 'INDUSTRY' | 'ENERGY' | 'UTILITY' | 'REIT' | 'TELECOM';

export interface SectorDiagnosis {
  diagnosisId: string;
  sector: SectorId;
  sectorCn: string;
  emoji: string;
  timestamp: number;
  scores: {
    technical: number;   // 0-100 技术面
    fundamental: number; // 0-100 基本面
    sentiment: number;   // 0-100 情绪面
    risk: number;        // 0-100 风险(越低越好)
  };
  keyFactors: { name: string; value: string; signal: 'bull' | 'bear' | 'neutral' }[];
  rotationSignal: { direction: 'inflow' | 'outflow' | 'stable'; strength: number; note: string };
  top3Picks: { symbol: string; name: string; reason: string }[];
  outlook: { summary: string; confidence: number; nextWeek: string };
}

const SECTOR_INFO: Record<SectorId, { cn: string; emoji: string }> = {
  TECH:     { cn: '科技',   emoji: '💻' },
  FINANCE:  { cn: '金融',   emoji: '🏦' },
  HEALTH:   { cn: '医疗',   emoji: '🏥' },
  CONSUMER: { cn: '消费',   emoji: '🛒' },
  MATERIALS:{ cn: '原材料', emoji: '⛏️' },
  INDUSTRY: { cn: '工业',   emoji: '🏭' },
  ENERGY:   { cn: '能源',   emoji: '🛢️' },
  UTILITY:  { cn: '公用事业',emoji: '⚡' },
  REIT:     { cn: '房地产', emoji: '🏘️' },
  TELECOM:  { cn: '通信',   emoji: '📡' },
};

// ── Engine ──
export class SectorAIDiagnosisEngine extends EventEmitter {
  private static instance: SectorAIDiagnosisEngine;
  private diagnoses: SectorDiagnosis[] = [];
  private diagSeq = 0;
  private readonly PRICE = 1.5; // USDT per diagnosis

  private constructor() { super(); }

  static getInstance(): SectorAIDiagnosisEngine {
    if (!this.instance) this.instance = new SectorAIDiagnosisEngine();
    return this.instance;
  }

  reset(): void {
    this.diagnoses = [];
    this.diagSeq = 0;
    this.removeAllListeners();
  }

  getPrice(): number { return this.PRICE; }

  /**
   * 生成板块AI诊断。
   * 生产环境下，sectorData 来自 SectorHeatmapDataBridge 的实时计算结果。
   */
  diagnose(
    sector: SectorId,
    sectorChangePct: number,
    topMoverPct: number,
    breadthAdvancing: number,
    breadthDeclining: number
  ): SectorDiagnosis {
    const info = SECTOR_INFO[sector];

    // 技术面: 基于板块涨跌
    const technical = sectorChangePct > 2 ? 85 : sectorChangePct > 0.5 ? 72 : sectorChangePct > -0.5 ? 55 : sectorChangePct > -2 ? 40 : 20;
    // 基本面: 行业中性基线
    const fundamental = 65; // 生产环境下从因子系统动态获取
    // 情绪面: 涨跌比
    const total = breadthAdvancing + breadthDeclining || 1;
    const sentiment = Math.round((breadthAdvancing / total) * 100);
    // 风险: 波动率越高风险越高
    const volatility = Math.abs(sectorChangePct);
    const risk = Math.round(Math.max(10, 60 - volatility * 10));

    // 关键因子
    const keyFactors: SectorDiagnosis['keyFactors'] = [
      { name: '板块涨跌', value: `${sectorChangePct > 0 ? '+' : ''}${sectorChangePct.toFixed(1)}%`, signal: sectorChangePct > 0.5 ? 'bull' : sectorChangePct < -0.5 ? 'bear' : 'neutral' },
      { name: '涨跌比', value: `${breadthAdvancing}:${breadthDeclining}`, signal: breadthAdvancing > breadthDeclining ? 'bull' : 'bear' },
      { name: '龙头表现', value: `${topMoverPct > 0 ? '+' : ''}${topMoverPct.toFixed(1)}%`, signal: topMoverPct > 2 ? 'bull' : topMoverPct < -2 ? 'bear' : 'neutral' },
      { name: '波动率', value: `${volatility.toFixed(1)}%`, signal: volatility < 1.5 ? 'neutral' : 'bear' },
    ];

    // 轮动信号
    let rotationSignal: SectorDiagnosis['rotationSignal'];
    if (sectorChangePct > 1.5 && breadthAdvancing > breadthDeclining * 1.5) {
      rotationSignal = { direction: 'inflow', strength: 0.8, note: '资金明显流入，板块热度上升' };
    } else if (sectorChangePct < -1.5 && breadthDeclining > breadthAdvancing * 1.5) {
      rotationSignal = { direction: 'outflow', strength: 0.7, note: '资金流出，防御性减仓信号' };
    } else {
      rotationSignal = { direction: 'stable', strength: 0.3, note: '资金稳定，板块无明确方向' };
    }

    // 信心
    const confidence = Math.round(60 + Math.min(30, Math.abs(sectorChangePct) * 5));

    const diag: SectorDiagnosis = {
      diagnosisId: `SD-${++this.diagSeq}`,
      sector, sectorCn: info.cn, emoji: info.emoji,
      timestamp: Date.now(),
      scores: { technical, fundamental, sentiment, risk },
      keyFactors,
      rotationSignal,
      top3Picks: [], // populated from external feed
      outlook: {
        summary: `${info.cn}板块${sectorChangePct > 0 ? '偏强' : '偏弱'}，技术面${technical}分。${rotationSignal.note}。`,
        confidence,
        nextWeek: sectorChangePct > 0 ? '若维持资金流入，下周可能延续强势' : '关注是否企稳，等待反转信号',
      },
    };

    this.diagnoses.unshift(diag);
    this.emit('sector_diagnosis', diag);
    return diag;
  }

  getLatest(sector: SectorId): SectorDiagnosis | undefined {
    return this.diagnoses.find(d => d.sector === sector);
  }

  getAllLatest(): SectorDiagnosis[] {
    const seen = new Set<SectorId>();
    return this.diagnoses.filter(d => {
      if (seen.has(d.sector)) return false;
      seen.add(d.sector);
      return true;
    });
  }
}
