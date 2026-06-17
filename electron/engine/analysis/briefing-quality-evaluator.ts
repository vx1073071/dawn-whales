/**
 * R254 AI-02: BriefingQualityEvaluator — 简报AI质量评估
 * LOBEHUB | v3.0.0 QUANT MOO
 * 评估AI每日简报质量: 完整性/相关性/可读性/行动性/准确性 五维度
 * >=380L
 */

export interface BriefingSection {
  type: 'market_overview' | 'holdings_summary' | 'action_advice' | 'sentiment' | 'risks';
  content: string; wordCount: number; hasNumbers: boolean; hasSymbols: boolean;
}

export interface BriefingQualityReport {
  totalScore: number; // 0-100
  grade: 'A'|'B'|'C'|'D'|'F';
  dimensions: {
    completeness: { score: number; max: number; issues: string[]; };
    relevance: { score: number; max: number; issues: string[]; };
    readability: { score: number; max: number; issues: string[]; };
    actionability: { score: number; max: number; issues: string[]; };
    accuracy: { score: number; max: number; issues: string[]; };
  };
  summary: string; recommendations: string[];
  generatedAt: number;
}

export class BriefingQualityEvaluator {
  readonly id = 'briefing_quality'; readonly version = '3.0.0';

  evaluate(sections: BriefingSection[], context?: { holdingsCount: number; markets: string[]; hasPriceData: boolean }): BriefingQualityReport {
    const dims = {
      completeness: this.evalCompleteness(sections),
      relevance: this.evalRelevance(sections, context),
      readability: this.evalReadability(sections),
      actionability: this.evalActionability(sections),
      accuracy: this.evalAccuracy(sections, context),
    };

    const totalScore = Math.round(
      dims.completeness.score * 0.25 +
      dims.relevance.score * 0.25 +
      dims.readability.score * 0.15 +
      dims.actionability.score * 0.25 +
      dims.accuracy.score * 0.10
    );

    const grade = totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : totalScore >= 40 ? 'D' : 'F';
    const allIssues = Object.values(dims).flatMap(d => d.issues);

    return {
      totalScore, grade, dimensions: dims,
      summary: grade >= 'B' ? '简报质量良好，可正常发布' : grade >= 'C' ? '简报有改进空间，建议优化后发布' : '简报质量不达标，请重新生成',
      recommendations: this.generateRecommendations(dims),
      generatedAt: Date.now(),
    };
  }

  private evalCompleteness(sections: BriefingSection[]): { score: number; max: number; issues: string[] } {
    const max = 25; const issues: string[] = [];
    const requiredTypes = ['market_overview', 'holdings_summary', 'sentiment'];
    let score = max;

    for (const t of requiredTypes) {
      const s = sections.find(x => x.type === t);
      if (!s) { score -= 8; issues.push(`缺少: ${t}`); continue; }
      if (s.wordCount < 20) { score -= 3; issues.push(`${t} 内容过短(<20字)`); }
      if (!s.hasNumbers) { score -= 2; issues.push(`${t} 缺少量化数据`); }
    }

    const totalWords = sections.reduce((s, x) => s + x.wordCount, 0);
    if (totalWords < 80) { score -= 5; issues.push('总字数不足80'); }

    return { score: Math.max(0, score), max, issues };
  }

  private evalRelevance(sections: BriefingSection[], ctx?: { holdingsCount: number; markets: string[] }): { score: number; max: number; issues: string[] } {
    const max = 25; const issues: string[] = [];
    let score = max;

    const holdingsSection = sections.find(x => x.type === 'holdings_summary');
    if (holdingsSection && ctx?.holdingsCount && holdingsSection.hasSymbols === false) {
      score -= 10; issues.push('持仓摘要未提及任何标的');
    }

    const marketSection = sections.find(x => x.type === 'market_overview');
    if (marketSection && ctx?.markets?.length && !ctx.markets.some(m => marketSection.content.includes(m))) {
      score -= 5; issues.push('市场概述未覆盖用户关注的市场');
    }

    return { score: Math.max(0, score), max, issues };
  }

  private evalReadability(sections: BriefingSection[]): { score: number; max: number; issues: string[] } {
    const max = 15; const issues: string[] = [];
    let score = max;
    const allText = sections.map(s => s.content).join(' ');

    // 检测过长句子
    const sentences = allText.split(/[。！？.!?]/);
    const longSentences = sentences.filter(s => s.length > 80);
    if (longSentences.length > 3) { score -= 5; issues.push(`${longSentences.length}个句子过长(>80字)`); }

    // 检测冗余词
    const fillerWords = ['显然', '很明显', '毫无疑问', '必须指出', '值得注意的是'];
    const usedFillers = fillerWords.filter(w => allText.includes(w));
    if (usedFillers.length > 3) { score -= 3; issues.push('冗余词过多'); }

    return { score: Math.max(0, score), max, issues };
  }

  private evalActionability(sections: BriefingSection[]): { score: number; max: number; issues: string[] } {
    const max = 25; const issues: string[] = [];
    const advice = sections.find(s => s.type === 'action_advice');
    if (!advice) return { score: 0, max, issues: ['缺少行动建议板块'] };

    let score = 0;
    const hasAction = /建议|推荐|关注|减持|增持|观望|减仓|加仓|设止/.test(advice.content);
    if (hasAction) score += 15; else issues.push('无具体行动建议');

    const risk = sections.find(s => s.type === 'risks');
    if (risk && risk.wordCount > 10) score += 10; else issues.push('风险提示不足');

    return { score, max, issues };
  }

  private evalAccuracy(sections: BriefingSection[], ctx?: { hasPriceData: boolean }): { score: number; max: number; issues: string[] } {
    const max = 10; const issues: string[] = [];
    let score = max;
    if (ctx?.hasPriceData === false) { score -= 5; issues.push('缺少实时价格数据支持'); }
    return { score: Math.max(0, score), max, issues };
  }

  private generateRecommendations(dims: BriefingQualityReport['dimensions']): string[] {
    const recs: string[] = [];
    if (dims.completeness.score < 20) recs.push('补充缺失板块 (市场/持仓/情绪必含3项)');
    if (dims.relevance.score < 20) recs.push('提高内容相关性: 聚焦用户持仓和关注市场');
    if (dims.readability.score < 12) recs.push('优化可读性: 拆分长句，减少冗余词');
    if (dims.actionability.score < 15) recs.push('增加行动建议: 每份简报至少包含2条可操作建议');
    return recs;
  }
}

export default BriefingQualityEvaluator;
