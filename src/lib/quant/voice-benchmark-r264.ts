// ══ R264 LOBEHUB P1: 语音播报质量基准 ══
export type VoiceScenario = 'PREMARKET_BRIEFING' | 'ANOMALY_ALERT' | 'CRASH_WARNING' | 'EARNINGS_SURPRISE' | 'SECTOR_ROTATION';
export type VoiceQualityLevel = 'NATURAL' | 'ACCEPTABLE' | 'ROBOTIC' | 'UNINTELLIGIBLE';

export interface VoiceSample {
  scenario: VoiceScenario;
  inputText: string;
  ttsText: string;
  ttsDurationMs: number;
  marketStateCorrect: boolean;
  emotionMatch: boolean;      // 语气匹配市场状态？
  accuracyScore: number;       // 0-100
  qualityLevel: VoiceQualityLevel;
}

export interface VoiceQualityResult {
  scenario: VoiceScenario;
  samples: number;
  avgAccuracy: number;
  avgDurationMs: number;
  marketStateAccuracy: number;
  emotionAccuracy: number;
  qualityDistribution: Record<VoiceQualityLevel, number>;
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export interface VoiceBenchmarkReport {
  timestamp: number;
  overallScore: number;
  byScenario: VoiceQualityResult[];
  totalSamples: number;
  avgDurationMs: number;
  latencyStatus: 'FAST' | 'ACCEPTABLE' | 'SLOW';
  recommendations: string[];
}

// ═══════════════════ 语音场景 ═══════════════════

export const VOICE_SCENARIOS: Record<VoiceScenario, { name: string; expectedEmotion: string; maxDurationMs: number }> = {
  PREMARKET_BRIEFING: { name: '盘前简报', expectedEmotion: 'calm_professional', maxDurationMs: 15000 },
  ANOMALY_ALERT: { name: '异动提醒', expectedEmotion: 'alert_urgent', maxDurationMs: 8000 },
  CRASH_WARNING: { name: '崩盘预警', expectedEmotion: 'serious_calm', maxDurationMs: 12000 },
  EARNINGS_SURPRISE: { name: '财报异动', expectedEmotion: 'surprised_energetic', maxDurationMs: 10000 },
  SECTOR_ROTATION: { name: '板块轮动', expectedEmotion: 'analytical_neutral', maxDurationMs: 18000 },
};

// ═══════════════════ 单样本评估 ═══════════════════

export function evaluateVoiceSample(sample: VoiceSample): VoiceSample {
  let accuracyScore = 100;

  // Deduct for each issue
  if (!sample.marketStateCorrect) accuracyScore -= 30;
  if (!sample.emotionMatch) accuracyScore -= 20;
  if (sample.ttsDurationMs > VOICE_SCENARIOS[sample.scenario].maxDurationMs) accuracyScore -= 15;
  if (sample.ttsText.length < sample.inputText.length * 0.5) accuracyScore -= 15;

  let qualityLevel: VoiceQualityLevel;
  if (accuracyScore >= 90) qualityLevel = 'NATURAL';
  else if (accuracyScore >= 70) qualityLevel = 'ACCEPTABLE';
  else if (accuracyScore >= 50) qualityLevel = 'ROBOTIC';
  else qualityLevel = 'UNINTELLIGIBLE';

  return { ...sample, accuracyScore: Math.max(0, accuracyScore), qualityLevel };
}

// ═══════════════════ 场景级评估 ═══════════════════

export function evaluateVoiceScenario(samples: VoiceSample[]): VoiceQualityResult {
  if (samples.length === 0) {
    return { scenario: 'PREMARKET_BRIEFING', samples: 0, avgAccuracy: 0, avgDurationMs: 0, marketStateAccuracy: 0, emotionAccuracy: 0, qualityDistribution: { NATURAL: 0, ACCEPTABLE: 0, ROBOTIC: 0, UNINTELLIGIBLE: 0 }, status: 'FAIL' };
  }

  const evaluated = samples.map(evaluateVoiceSample);
  const scenario = evaluated[0].scenario;

  const avgAccuracy = evaluated.reduce((s, v) => s + v.accuracyScore, 0) / evaluated.length;
  const avgDuration = evaluated.reduce((s, v) => s + v.ttsDurationMs, 0) / evaluated.length;
  const marketStateAccuracy = evaluated.filter(v => v.marketStateCorrect).length / evaluated.length * 100;
  const emotionAccuracy = evaluated.filter(v => v.emotionMatch).length / evaluated.length * 100;

  const qualityDistribution: VoiceQualityResult['qualityDistribution'] = { NATURAL: 0, ACCEPTABLE: 0, ROBOTIC: 0, UNINTELLIGIBLE: 0 };
  for (const v of evaluated) qualityDistribution[v.qualityLevel]++;

  let status: VoiceQualityResult['status'];
  if (avgAccuracy >= 85) status = 'PASS';
  else if (avgAccuracy >= 65) status = 'WARNING';
  else status = 'FAIL';

  return {
    scenario, samples: evaluated.length,
    avgAccuracy: Math.round(avgAccuracy * 10) / 10,
    avgDurationMs: Math.round(avgDuration),
    marketStateAccuracy: Math.round(marketStateAccuracy * 10) / 10,
    emotionAccuracy: Math.round(emotionAccuracy * 10) / 10,
    qualityDistribution, status,
  };
}

// ═══════════════════ 全量报告 ═══════════════════

export function generateVoiceBenchmark(allSamples: VoiceSample[]): VoiceBenchmarkReport {
  const byScenario: VoiceQualityResult[] = [];
  const scenarios = [...new Set(allSamples.map(s => s.scenario))];

  for (const sc of scenarios) {
    byScenario.push(evaluateVoiceScenario(allSamples.filter(s => s.scenario === sc)));
  }

  const totalSamples = allSamples.length;
  const avgDuration = allSamples.reduce((s, v) => s + v.ttsDurationMs, 0) / Math.max(1, totalSamples);
  const overallScore = byScenario.reduce((s, r) => s + r.avgAccuracy, 0) / Math.max(1, byScenario.length);

  let latencyStatus: VoiceBenchmarkReport['latencyStatus'];
  if (avgDuration < 8000) latencyStatus = 'FAST';
  else if (avgDuration < 15000) latencyStatus = 'ACCEPTABLE';
  else latencyStatus = 'SLOW';

  const recs: string[] = [];
  for (const r of byScenario) {
    if (r.status === 'FAIL') recs.push(`❌ ${VOICE_SCENARIOS[r.scenario].name}语音不达标`);
    else if (r.status === 'WARNING') recs.push(`⚠️ ${VOICE_SCENARIOS[r.scenario].name}语音需优化`);
  }
  if (latencyStatus === 'SLOW') recs.push('⚠️ TTS延迟过高—影响实时播报体验');

  return { timestamp: Date.now(), overallScore: Math.round(overallScore), byScenario, totalSamples, avgDurationMs: Math.round(avgDuration), latencyStatus, recommendations: recs };
}

export default VoiceBenchmarkReport;
