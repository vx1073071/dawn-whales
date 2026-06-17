// ══ R257 LOBEHUB QU-08: A/B测试首期启动 ══
// AB Test Campaign 001 — 4模板×1000用户分流+CTR统计+显著性报告
// "第一轮测试：用户喜欢什么推送？数据说了算。"

import {
  ABTestConfig, ABTestEvent, calculateABTestResult,
  assignVariant, createABTest,
} from './ab-test-engine-r254';

export interface ABCampaign001 {
  campaignId: string;
  name: string;
  startedAt: number;
  status: 'RUNNING' | 'COMPLETED' | 'STOPPED';
  tests: ABTestConfig[];
  totalUsers: number;
  results: ReturnType<typeof calculateABTestResult>[];
  summary: string;
  recommendations: string[];
}

const CAMPAIGN_TESTS: Array<{
  testId: string; testName: string; dimension: ABTestConfig['dimension'];
  variantADesc: string; variantAContent: string;
  variantBDesc: string; variantBContent: string;
  weightA: number; weightB: number;
}> = [
  {
    testId: 'r257-title', testName: '标题简洁vs故事', dimension: 'title',
    variantADesc: '简洁', variantAContent: 'BTC涨了5%',
    variantBDesc: '故事', variantBContent: 'BTC一小时涨了5%——市场在交易什么？',
    weightA: 0.5, weightB: 0.5,
  },
  {
    testId: 'r257-timing', testName: '推送时机(开盘前vs后)', dimension: 'timing',
    variantADesc: '开盘前15分钟(9:15)', variantAContent: '09:15',
    variantBDesc: '开盘后5分钟(9:35)', variantBContent: '09:35',
    weightA: 0.5, weightB: 0.5,
  },
  {
    testId: 'r257-media', testName: '纯文字vs文字+图表', dimension: 'media',
    variantADesc: '纯文字', variantAContent: 'text-only',
    variantBDesc: '文字+图表', variantBContent: 'text+chart',
    weightA: 0.5, weightB: 0.5,
  },
  {
    testId: 'r257-personalize', testName: '通用vs含持仓名', dimension: 'personalization',
    variantADesc: '通用', variantAContent: '市场异动：某板块波动>3%',
    variantBDesc: '含持仓名', variantBContent: '你关注的{stockName}出现异动！',
    weightA: 0.5, weightB: 0.5,
  },
];

export function launchCampaign001(totalUsers: number = 1000): ABCampaign001 {
  const tests = CAMPAIGN_TESTS.map(t =>
    createABTest(t.testId, t.testName, t.dimension, t.variantADesc, t.variantAContent, t.variantBDesc, t.variantBContent, t.weightA, t.weightB)
  );

  const startedAt = Date.now();
  for (const t of tests) {
    t.status = 'RUNNING';
  }

  return {
    campaignId: 'C001',
    name: '首期A/B测试——4维度×1000用户',
    startedAt,
    status: 'RUNNING',
    tests,
    totalUsers,
    results: [],
    summary: '4个测试维度并行运行，各1000用户分流。预期1-2天收集足够样本。',
    recommendations: [],
  };
}

export function simulateCampaignEvents(campaign: ABCampaign001, usersPerTest: number): ABTestEvent[] {
  const events: ABTestEvent[] = [];
  for (const test of campaign.tests) {
    for (let u = 0; u < usersPerTest; u++) {
      const uid = `u${u}`;
      const variant = assignVariant(uid, test);
      events.push({ testId: test.testId, variant, userId: uid, eventType: 'IMPRESSION', timestamp: Date.now() });

      // Simulate higher CTR for story titles and personalized
      let clickProb = 0.05;
      if (test.testId === 'r257-title' && variant === 'B') clickProb = 0.08;
      if (test.testId === 'r257-personalize' && variant === 'B') clickProb = 0.10;
      if (Math.random() < clickProb) {
        events.push({ testId: test.testId, variant, userId: uid, eventType: 'CLICK', timestamp: Date.now() });
        if (Math.random() < 0.3) {
          events.push({ testId: test.testId, variant, userId: uid, eventType: 'CONVERSION', timestamp: Date.now() });
        }
      }
    }
  }
  return events;
}

export function finalizeCampaign001(campaign: ABCampaign001, events: ABTestEvent[]): ABCampaign001 {
  const results: ABCampaign001['results'] = [];
  const recs: string[] = [];

  for (const test of campaign.tests) {
    const r = calculateABTestResult(test, events);
    results.push(r);

    if (r.status === 'B_WINS') {
      recs.push(`📊 ${test.testName}: B方案胜出(${((r.variantB.ctr - r.variantA.ctr) * 100).toFixed(1)}%提升, p=${r.pValue.toFixed(3)}) → 建议全面切换B方案`);
    } else if (r.status === 'A_WINS') {
      recs.push(`📊 ${test.testName}: A方案胜出 → 保持A方案`);
    } else {
      recs.push(`⏳ ${test.testName}: ${r.status === 'INSUFFICIENT_DATA' ? '数据不足继续收集' : '差异不显著'} → 等待更多样本`);
    }
  }

  return {
    ...campaign,
    status: 'COMPLETED',
    results,
    summary: `完成${campaign.tests.length}个测试，${campaign.totalUsers}用户分流。${results.filter(r => r.status.includes('WINS')).length}个测试有明显胜者。`,
    recommendations: recs,
  };
}

export default ABCampaign001;
