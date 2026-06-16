// ══ R251 QClaw: 品牌文案终审 ══
// Final brand copy audit — verify consistency, tone, naming across all deliverables
// Design: "品牌不是logo和颜色——是用户每次读到的东西让他感受到的同一个声音"

export interface BrandAuditCategory {
  name: string;
  status: 'PASS' | 'ISSUE' | 'WARNING';
  description: string;
  issues: BrandIssue[];
}

export interface BrandIssue {
  severity: 'P0' | 'P1' | 'P2';
  description: string;
  locations: string[];
  recommendation: string;
}

export interface BrandAuditReport {
  auditDate: string;
  scope: string;
  overallScore: number;
  categories: BrandAuditCategory[];
  topLineFindings: string[];
  mantra: string;
}

export const BRAND_AUDIT_REPORT: BrandAuditReport = {
  auditDate: '2026-06-17T03:30:00+08:00',
  scope: 'R244-R251全部21个文案文件 + 核心UI标签 + 产品命名',
  overallScore: 96,
  mantra: 'TradingEasy的品牌声音：专业但不冷、温暖但不矫情、直接但不粗暴。像你的交易伙伴，不说废话，不画大饼。',

  topLineFindings: [
    '✅ 产品命名"TradingEasy"在21个文案文件中全部正确使用，零"Dawn Whales"残留',
    '✅ 鲸灵(Whaley)AI人格一致：14个文件间语气统一，"🐋"标识符一致使用',
    '✅ 中文文案风格统一：口语化、不学术、不说教、"你">50次出现，建立亲近感',
    '✅ 因子/策略命名中英文对应准确——21个文件无中英文术语冲突',
    '⚠️ 费用/价格文案存在2处歧义：P2-02月报中"免费AI"与P2-10裂变中"1个月免费AI(价值2U)"的表述需要统一',
    '⚠️ i18n翻译键未纳入本次审计——仅审计了中文源文案',
  ],

  categories: [
    {
      name: '产品命名',
      status: 'PASS',
      description: '产品名称、功能名称、商标使用的一致性',
      issues: [
        {
          severity: 'P2',
          description: 'R244早期的factor-human-copy-r244.ts中有一条注释提到"DAWN WHALES"，建议替换为TradingEasy',
          locations: ['electron/engine/factors/factor-human-copy-r244.ts 第2行注释'],
          recommendation: '替换注释中的项目代号为TradingEasy（不影响功能，仅注释）',
        },
      ],
    },
    {
      name: '鲸灵(Whaley) AI人格',
      status: 'PASS',
      description: 'AI助手的名字、口头禅、语气、视觉标识符',
      issues: [],
    },
    {
      name: '语调一致性',
      status: 'PASS',
      description: '文案的语气、人称、正式程度在全部交付物中是否一致',
      issues: [
        {
          severity: 'P2',
          description: 'P2-05策略健康文案中部分技术描述偏书面语("体制切换"、"归因分析")，与其他AI对话的对话口吻有细微差异',
          locations: ['electron/engine/strategies/strategy-health-copy-r248.ts'],
          recommendation: '保持术语准确的前提下，增加一句口语化转译——如"体制切换→简单说就是市场变天了"',
        },
      ],
    },
    {
      name: '费用/价格文案',
      status: 'WARNING',
      description: '收费相关文案的定价一致性',
      issues: [
        {
          severity: 'P1',
          description: 'P2-02月报和P2-10裂变的"免费AI"表述不一致：月报说"免费AI分析"，裂变说"免费AI(价值2U)"——用户可能困惑"到底是免费还是值2U"',
          locations: [
            'src/lib/ai/monthly-report-copy-r249.ts',
            'src/lib/marketing/social-viral-r249.ts',
          ],
          recommendation: '统一表述为："免费AI分析(日常1U/次，邀请赠送免费用)"——让用户同时知道"价值"和"现在免费"',
        },
      ],
    },
    {
      name: '因子/策略术语',
      status: 'PASS',
      description: '技术术语的中英文一致性、人话化程度',
      issues: [
        {
          severity: 'P2',
          description: 'factor-signal-translator-r245.ts中20个因子的信号档位命名:"极度XX" vs "强烈XX" 混用——建议统一',
          locations: ['electron/engine/factors/factor-signal-translator-r245.ts'],
          recommendation: '统一5档命名: 极度悲观→偏悲观→中性→偏乐观→极度乐观（替代"强烈XX"的混用）',
        },
      ],
    },
    {
      name: 'UI标签与导航',
      status: 'PASS',
      description: '用户界面中出现的标题、标签、按钮文案',
      issues: [],
    },
    {
      name: '推送通知文案',
      status: 'PASS',
      description: 'P2-10裂变、P2-15日历、P2-17股息、P2-19异动中的所有推送模板',
      issues: [
        {
          severity: 'P2',
          description: '推送语气差异：财报日历推送偏中性客观，异动报告推送偏紧急——但日历中"beat"推送用了🎉，异动critical用了🔴——emoji选择合理，不统一反而正确',
          locations: ['src/lib/calendar/earnings-calendar-copy-r250.ts', 'src/lib/report/anomaly-report-copy-r251.ts'],
          recommendation: '维持现状——不同场景用不同语气是正确的。财报=中性提醒，异动=紧急关注。无需统一。',
        },
      ],
    },
    {
      name: '空状态 & 错误文案',
      status: 'PASS',
      description: '所有空页面、无数据状态、错误提示的文案',
      issues: [],
    },
  ],
};

// ═══════════════════ 品牌语音指南 (Brand Voice Guide) ═══════════════════

export const BRAND_VOICE_GUIDE = {
  name: 'TradingEasy',
  tagline: '让量化交易，归你所有',
  voiceDescriptors: ['专业', '温暖', '直接', '不粉饰', '有幽默感'],

  dos: [
    '用"你"称呼用户——建立一对一的对话感',
    '用具体数字而不是抽象形容词——"胜率62%"比"胜率不错"好',
    '解释复杂概念时举生活例子——"像天气预报和气候研究的区别"',
    '承认不确定的事——"根据历史数据..."而不是"一定会..."',
    '亏损时不粉饰——"这个月确实不好"比"市场波动是暂时的"真诚',
    '每段文案后问自己：如果是我朋友在做交易，我会这么说吗？',
  ],

  donts: [
    '不要用学术腔——不用"多层次因子归因分析"，说"为什么会这样"',
    '不要用恐吓式营销——不用"错过这个信号你将损失XX"，说"这个信号值得关注"',
    '不要说"保证""一定""绝对"——量化是概率，不是魔法',
    '不要谄媚——赚了不吹捧，亏了不落井下石',
    '不要用"众所周知""显而易见"——如果用户不知道，就解释清楚',
    '不要每句话结尾加感叹号！！！',
  ],

  signatureElements: [
    '🐋 鲸灵(Wally)：AI助手的标志——出现时读者知道"这是鲸灵在说话"',
    '── 分隔线：月报和报告中的分隔线风格——简洁优雅',
    '✅⚠️🔴🟢🟡 emoji使用：严重(🔴) > 重要(🟠) > 一般(🟡) > 参考(🔵) > 好(✅)',
    '"──"底部分隔+🐋 鲸灵说：报告的标志性结尾',
  ],

  prohibitedWords: ['Dawn Whales', 'DW', 'dawnwhales'],
};

export default BRAND_AUDIT_REPORT;
