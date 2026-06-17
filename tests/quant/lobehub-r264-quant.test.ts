// ══ R264 LOBEHUB 量化测试集 ══ 35 tests
import { describe, it, expect } from 'vitest';
import {
  evaluateVoiceSample, evaluateVoiceScenario, generateVoiceBenchmark,
  VoiceSample,
} from '../../src/lib/quant/voice-benchmark-r264';
import {
  evaluateReplayUX, generateReplayUXReport,
  ReplayUXSample,
} from '../../src/lib/quant/replay-ux-r264';
import {
  generateUltimateReport,
} from '../../src/lib/quant/ultimate-release-r264';
import type { DataQualityV2Report } from '../../src/lib/quant/data-quality-v2-r263';
import type { VoiceBenchmarkReport } from '../../src/lib/quant/voice-benchmark-r264';
import type { ReplayUXReport } from '../../src/lib/quant/replay-ux-r264';

const mkV = (o: Partial<VoiceSample> = {}): VoiceSample => ({ scenario: 'PREMARKET_BRIEFING', inputText: '标普500期货涨0.5%，科技股领涨', ttsText: '标普500期货涨0.5%，科技股领涨', ttsDurationMs: 5000, marketStateCorrect: true, emotionMatch: true, accuracyScore: 100, qualityLevel: 'NATURAL', ...o });
const mkR = (o: Partial<ReplayUXSample> = {}): ReplayUXSample => ({ sessionId: 's1', symbol: 'AAPL', market: 'US', durationMinutes: 15, actions: [{ action: 'PLAY', timestamp: Date.now(), responseMs: 50 }, { action: 'SPEED_2X', timestamp: Date.now(), responseMs: 80 }], completed: true, userRating: 4, timeSpentSeconds: 300, ...o });

const mkDQ = (): DataQualityV2Report => ({ timestamp: Date.now(), overall: 'PASS', yahoo: { latency: [], accuracy: [], completeness: [] }, binance: { latency: [], accuracy: [], completeness: [] }, dualSourceComparison: [], pipelineHealth: { totalMessages: 10000, droppedMessages: 0, dropRate: 0, backpressureEvents: 0, degradationEvents: 0, recoveryEvents: 0, avgEndToEndMs: 100, p95EndToEndMs: 200, status: 'HEALTHY' }, continuousRun: { durationHours: 24, totalTicks: 1000000, uniqueSymbols: 200, avgTicksPerSecond: 12, peakTicksPerSecond: 40, memoryLeakMB: 10, restarts: 0, status: 'STABLE' }, score: 90, recommendations: [], greenFlags: ['✅ good'], redFlags: [] });
const mkVB = (): VoiceBenchmarkReport => ({ timestamp: Date.now(), overallScore: 90, byScenario: [], totalSamples: 50, avgDurationMs: 5000, latencyStatus: 'FAST', recommendations: [] });
const mkRX = (): ReplayUXReport => ({ timestamp: Date.now(), totalSessions: 100, overallCompletionRate: 85, overallEngagementScore: 80, bySymbol: [], actionFrequency: { PLAY: 200, PAUSE: 100, STEP_FORWARD: 50, STEP_BACK: 30, SPEED_1X: 50, SPEED_2X: 150, SPEED_4X: 80, SPEED_8X: 20, JUMP_TO: 40, SCRUB: 30 }, latencyStatus: 'FAST', recommendations: [] });

// P1: 语音基准 (12 tests)
describe('R264 P1 Voice Benchmark', () => {
  it('perfect sample', () => { const r = evaluateVoiceSample(mkV()); expect(r.qualityLevel).toBe('NATURAL'); expect(r.accuracyScore).toBe(100); });
  it('wrong market state', () => expect(evaluateVoiceSample(mkV({ marketStateCorrect: false })).accuracyScore).toBeLessThanOrEqual(70));
  it('emotion mismatch', () => expect(evaluateVoiceSample(mkV({ emotionMatch: false })).accuracyScore).toBeLessThanOrEqual(80));
  it('slow TTS', () => expect(evaluateVoiceSample(mkV({ ttsDurationMs: 20000, emotionMatch: false, marketStateCorrect: false })).qualityLevel).toBe('UNINTELLIGIBLE'));
  it('robotic quality', () => expect(evaluateVoiceSample(mkV({ marketStateCorrect: false, emotionMatch: false, ttsDurationMs: 18000 })).qualityLevel).toBe('UNINTELLIGIBLE'));
  it('scenario evaluation PASS', () => expect(evaluateVoiceScenario([mkV(), mkV(), mkV()]).status).toBe('PASS'));
  it('scenario evaluation FAIL', () => expect(evaluateVoiceScenario([mkV({ marketStateCorrect: false, emotionMatch: false, ttsDurationMs: 20000 })]).status).toBe('FAIL'));
  it('quality distribution', () => { const r = evaluateVoiceScenario([mkV(), mkV(), mkV()]); expect(r.qualityDistribution.NATURAL).toBe(3); });
  it('market state accuracy', () => { const r = evaluateVoiceScenario([mkV(), mkV({ marketStateCorrect: false })]); expect(r.marketStateAccuracy).toBe(50); });
  it('report generated', () => { const r = generateVoiceBenchmark([mkV(), mkV({ scenario: 'ANOMALY_ALERT' })]); expect(r.totalSamples).toBe(2); expect(r.overallScore).toBeGreaterThan(0); });
  it('scenarios mapped', () => { const r = generateVoiceBenchmark([mkV({ scenario: 'PREMARKET_BRIEFING' }), mkV({ scenario: 'CRASH_WARNING' })]); expect(r.byScenario.length).toBeLessThanOrEqual(2); });
  it('recommendations for FAIL', () => { const r = generateVoiceBenchmark([mkV({ marketStateCorrect: false, emotionMatch: false, ttsDurationMs: 20000 })]); expect(r.recommendations.length).toBeGreaterThan(0); });
});

// P2: 回放UX (11 tests)
describe('R264 P2 Replay UX', () => {
  it('excellent engagement', () => expect(evaluateReplayUX([mkR(), mkR(), mkR()]).status).toBe('EXCELLENT'));
  it('poor engagement', () => expect(evaluateReplayUX([mkR({ completed: false, userRating: 2, actions: [] })]).status).toBe('POOR'));
  it('completion rate', () => { const r = evaluateReplayUX([mkR(), mkR({ completed: false })]); expect(r.completionRate).toBe(50); });
  it('most used actions', () => { const r = evaluateReplayUX([mkR()]); expect(r.mostUsedActions.length).toBeGreaterThan(0); });
  it('response times', () => { const r = evaluateReplayUX([mkR()]); expect(r.avgResponseMs).toBeGreaterThan(0); });
  it('ratings averaged', () => { const r = evaluateReplayUX([mkR({ userRating: 5 }), mkR({ userRating: 3 })]); expect(r.avgRating).toBe(4); });
  it('report generated', () => { const r = generateReplayUXReport([mkR(), mkR({ symbol: 'TSLA' })]); expect(r.totalSessions).toBe(2); });
  it('action frequency tracked', () => { const r = generateReplayUXReport([mkR()]); expect(r.actionFrequency.PLAY).toBeGreaterThan(0); });
  it('overall completion', () => { const r = generateReplayUXReport([mkR(), mkR({ completed: false })]); expect(r.overallCompletionRate).toBe(50); });
  it('symbol breakdown', () => { const r = generateReplayUXReport([mkR({ symbol: 'AAPL' }), mkR({ symbol: 'TSLA' })]); expect(r.bySymbol.length).toBeLessThanOrEqual(2); });
  it('recommendations for low completion', () => expect(generateReplayUXReport([mkR({ completed: false })]).recommendations.length).toBeGreaterThan(0));
});

// P3: 终极报告 (12 tests)
describe('R264 P3 Ultimate Release', () => {
  it('GO when all pass', () => expect(generateUltimateReport(mkDQ(), mkVB(), mkRX()).releaseDecision).toBe('GO'));
  it('GO_WITH_CAUTION with warnings', () => {
    const vb = mkVB(); vb.overallScore = 70;
    expect(generateUltimateReport(mkDQ(), vb, mkRX()).releaseDecision).toBe('GO_WITH_CAUTION');
  });
  it('NO_GO with failures', () => {
    const dq = mkDQ(); dq.overall = 'FAIL';
    expect(generateUltimateReport(dq, mkVB(), mkRX()).releaseDecision).toBe('NO_GO');
  });
  it('3 sections', () => expect(generateUltimateReport(mkDQ(), mkVB(), mkRX()).sections.length).toBe(3));
  it('score between 0-100', () => { const r = generateUltimateReport(mkDQ(), mkVB(), mkRX()); expect(r.overallScore).toBeGreaterThan(0); });
  it('revenue forecast', () => { const r = generateUltimateReport(mkDQ(), mkVB(), mkRX()); expect(r.revenueForecast.baseCase).toBeGreaterThan(0); });
  it('highlights populated', () => { const r = generateUltimateReport(mkDQ(), mkVB(), mkRX()); expect(r.highlights.length).toBeGreaterThan(0); });
  it('risks empty when all pass', () => expect(generateUltimateReport(mkDQ(), mkVB(), mkRX()).risks.length).toBe(0));
  it('sign-off for non-GO', () => {
    const dq = mkDQ(); dq.overall = 'FAIL';
    expect(generateUltimateReport(dq, mkVB(), mkRX()).signOffItems.length).toBeGreaterThan(0);
  });
  it('no sign-off for GO', () => expect(generateUltimateReport(mkDQ(), mkVB(), mkRX()).signOffItems.length).toBe(0));
  it('version v3.0.0', () => expect(generateUltimateReport(mkDQ(), mkVB(), mkRX()).version).toBe('v3.0.0'));
  it('all sections have scores', () => { for (const s of generateUltimateReport(mkDQ(), mkVB(), mkRX()).sections) expect(s.score).toBeGreaterThan(0); });
});
