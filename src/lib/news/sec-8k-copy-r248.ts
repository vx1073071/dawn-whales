// ══ R248 QClaw P1-14: SEC 8-K 人话文案 ══
// Translate cryptic SEC 8-K filing items into actionable investor language
// Design: "8-K Item 2.06 → 公司承认资产不值钱了"

export type ImpactDirection = 'positive' | 'negative' | 'neutral' | 'uncertain';

export interface EightKItem {
  itemNumber: string;
  title: string;
  /** 人话标题 */
  humanTitle: string;
  /** 一句话解释 */
  oneLiner: string;
  /** 对股价的典型影响 */
  typicalImpact: ImpactDirection;
  /** 投资者应该怎么做 */
  whatInvestorShouldDo: string;
  /** 用户收到推送时的文案 */
  pushCopy: {
    title: string;
    body: string;
    cta: string;
  };
}

export const SEC_8K_ITEMS: EightKItem[] = [
  {
    itemNumber: '1.01',
    title: 'Entry into a Material Definitive Agreement',
    humanTitle: '签了大合同',
    oneLiner: '公司签了一个重要合同——可能是大客户、大供应商、或者战略合作。',
    typicalImpact: 'positive',
    whatInvestorShouldDo: '看合同金额占公司营收的比例。如果>10%，这是实质性利好——说明公司在扩张。但别被"战略合作"这种词迷惑，看有没有具体的数字。',
    pushCopy: {
      title: '{company} 签了个大合同',
      body: '{company}签了{deal_type}，涉及金额约{amount}。这笔交易占去年营收的{pct}%。{analyst_view}。',
      cta: '看合同详情',
    },
  },
  {
    itemNumber: '1.02',
    title: 'Termination of a Material Definitive Agreement',
    humanTitle: '重要合同被取消了',
    oneLiner: '之前的重要合同被单方面终止——客户跑了、合作伙伴不干了。',
    typicalImpact: 'negative',
    whatInvestorShouldDo: '搞清楚是哪一方终止的。如果是客户终止（比如丢了最大客户），这是致命信号——立刻检查你持仓里有没有这只票。如果是公司主动终止（比如换了更好的合作方），反而可能是好事。',
    pushCopy: {
      title: '⚠️ {company} 丢了一个大合同',
      body: '{company}的{deal_type}合同被{terminating_party}终止了。这个合同占去年营收的{pct}%。{context_explain}。',
      cta: '分析影响',
    },
  },
  {
    itemNumber: '2.01',
    title: 'Completion of Acquisition or Disposition of Assets',
    humanTitle: '买了/卖了大东西',
    oneLiner: '公司买了（收购）或卖了（剥离）一项重要资产——可能改变了整个公司的业务结构。',
    typicalImpact: 'uncertain',
    whatInvestorShouldDo: '收购：看买价贵不贵（溢价率）、买的业务跟主业协不协同。剥离：看卖掉的业务是不是拖后腿的——如果是，卖掉是好事。核心判断标准：交易宣布后分析师是上调还是下调了目标价。',
    pushCopy: {
      title: '{company} 刚刚{action}了一项重要资产',
      body: '{company}花了{amount} {action_cn}{target}。市场反应: 股价{direction}{change}%。分析师{bull_count}上调{bear_count}下调目标价。',
      cta: '看懂这笔交易',
    },
  },
  {
    itemNumber: '2.02',
    title: 'Results of Operations and Financial Condition',
    humanTitle: '财报提前发布了',
    oneLiner: '公司提前发布了业绩数据——可能是营收、利润，或者某个关键经营指标。',
    typicalImpact: 'uncertain',
    whatInvestorShouldDo: '拿到数据后立刻做三件事：1) 和上个季度比（环比的趋势），2) 和去年同期比（同比的趋势），3) 和华尔街预期比（是超了还是miss了）。最重要的是第3点——股价已经在price-in预期了，超预期才能涨。',
    pushCopy: {
      title: '{company} 提前透露了业绩',
      body: '{company}发布{period} {metric_type}: {actual}。华尔街预期{estimate}——{beat_miss}。去年同期的这个数字是{yoy_value}。',
      cta: '看业绩对比',
    },
  },
  {
    itemNumber: '2.03',
    title: 'Creation of a Direct Financial Obligation',
    humanTitle: '公司借了一大笔钱',
    oneLiner: '公司发行了新的债券或借了银行贷款——资产负债表上多了负债。',
    typicalImpact: 'neutral',
    whatInvestorShouldDo: '借钱本身不是坏事——关键看三点：1) 借来的钱干什么（扩张=好，还旧债=一般，给老板发奖金=坏），2) 利率是多少（对比公司现有债务的平均利率），3) 期限多久（短期债多=流动性风险）。如果利率比之前的债还低，说明市场信任这家公司。',
    pushCopy: {
      title: '{company} 借了{amount}',
      body: '{company}发行了{debt_type}，利率{rate}%，期限{term}。公司的总负债现在是{total_debt}，利息覆盖率{coverage}x。',
      cta: '看负债分析',
    },
  },
  {
    itemNumber: '2.04',
    title: 'Triggering Events That Accelerate Financial Obligation',
    humanTitle: '债主来催债了',
    oneLiner: '公司触发了某个债务条款——可能是没按时还钱，或者财务指标不达标，债主可以要求立刻还钱。',
    typicalImpact: 'negative',
    whatInvestorShouldDo: '这是红色警报。说明公司财务已经恶化到触发了借款合同里的保护条款。立刻查：1) 触发金额多大，2) 公司有没有能力还（现金够不够），3) 会不会引发连锁反应（其他债主也来催）。如果现金不够，这可能是破产的前奏。',
    pushCopy: {
      title: '🚨 {company} 触发债务违约条款',
      body: '{company}触发了{debt_type}的{clause_type}条款，涉及金额{amount}。公司账上现金{total_cash}——{assessment}。',
      cta: '立即查看详情',
    },
  },
  {
    itemNumber: '2.05',
    title: 'Costs Associated with Exit or Disposal Activities',
    humanTitle: '裁员/关厂/退出业务',
    oneLiner: '公司宣布裁员、关闭工厂或退出某个业务——正在"瘦身"。',
    typicalImpact: 'uncertain',
    whatInvestorShouldDo: '裁员是把双刃剑：短期成本会增加（遣散费），但长期成本会下降。核心判断：裁的是"肥肉"还是"核心"？如果是裁掉不赚钱的业务线，这是好事（专注主业）。如果是核心部门也裁人，说明情况比表面更糟。',
    pushCopy: {
      title: '{company} 宣布{cuts_type}',
      body: '{company}将{action_detail}，涉及{affected_count}人/{pct}%员工。预计节省年成本{savings}，但一次性支出{cost}。{stock_reaction}。',
      cta: '分析影响',
    },
  },
  {
    itemNumber: '2.06',
    title: 'Material Impairments',
    humanTitle: '公司承认资产不值钱了',
    oneLiner: '公司说"我们账上的某个资产，实际上价值比账面要低"——主动承认贬值。',
    typicalImpact: 'negative',
    whatInvestorShouldDo: '资产减值是会计调整，不直接消耗现金——但它是管理层承认"之前的收购/投资做得不好"的信号。看减值规模占净资产比例：<5%=小问题，>20%=意味着之前好几年的利润可能都是虚的。同时看是否是"洗澡式减值"（新任CEO一把清掉前任的烂摊子）。',
    pushCopy: {
      title: '{company} 承认{asset}不值钱了',
      body: '{company}对{asset}计提了{amount}的减值，占净资产的{pct}%。这意味着{human_explain}。{context_add}。',
      cta: '看减值详情',
    },
  },
  {
    itemNumber: '3.01',
    title: 'Notice of Delisting or Failure to Satisfy Listing Rule',
    humanTitle: '要退市了！',
    oneLiner: '交易所发了警告：公司不符合上市条件了——可能是股价太低、市值太小、或没按时交财报。',
    typicalImpact: 'negative',
    whatInvestorShouldDo: '收到退市警告不等于马上退市——通常有30-180天的整改期。但这是一个"最后的警告"信号。立刻看：1) 是技术性问题（晚交财报）还是根本性问题（股价<1元），2) 公司有没有提出整改方案（发公告了没）。如果是股价<1元问题，公司通常会并股自救。',
    pushCopy: {
      title: '🚨 {company} 收到退市警告',
      body: '{exchange}通知{company}：因{reason}，不符合继续上市条件。公司有{cure_period}天整改。{probability_assessment}。',
      cta: '立即查看',
    },
  },
  {
    itemNumber: '4.02',
    title: 'Non-Reliance on Previously Issued Financial Statements',
    humanTitle: '之前的财报不准，别信了',
    oneLiner: '公司说之前的财报有问题，投资者不应该再依赖那些数字——可能要重述（restate）。',
    typicalImpact: 'negative',
    whatInvestorShouldDo: '这是非常严重的信号——意味着之前的财务数据可能是虚假的。立刻做两件事：1) 看看涉及的金额多大（少报了还是多报了利润），2) 之前审计师是谁（四大还是小事务所）。如果金额重大且是小事务所审计的，立刻卖出。财务造假的公司不值得信任。',
    pushCopy: {
      title: '🔴 {company} 说之前的财报别信',
      body: '{company}宣布{period}的财报不可信赖，涉及{issue_type}。预计调整金额约{amount}，影响{metric}约{direction}{adjustment}。审计师为{auditor}。',
      cta: '紧急查看',
    },
  },
  {
    itemNumber: '5.02',
    title: 'Departure/Appointment of Directors or Certain Officers',
    humanTitle: '高管走人了/换人了',
    oneLiner: 'CEO、CFO或者某个关键高管辞职（或被炒了），公司要换人。',
    typicalImpact: 'uncertain',
    whatInvestorShouldDo: 'CEO走人永远是重大事件——但好坏取决于原因。看公告措辞："个人原因/追求其他机会"=可能被炒了；"退休/健康原因"=可能真的老了；"与董事会在战略上存在分歧"=内斗。CFO走人要更加警觉——CFO通常知道公司财务有什么问题。此外看接任者背景：是从内部提拔（稳定）还是外部空降（变革）。',
    pushCopy: {
      title: '{company} 的 {position} {action}了',
      body: '{company}宣布{position} {name} {action_reason}。接任者为{successor}，来自{successor_bg}。股价{direction}{change}%。',
      cta: '分析影响',
    },
  },
  {
    itemNumber: '5.07',
    title: 'Submission of Matters to a Vote of Security Holders',
    humanTitle: '股东大会投票结果出来了',
    oneLiner: '股东对管理层提案投票的结果——包括薪酬方案、董事选举、ESG提案等。',
    typicalImpact: 'neutral',
    whatInvestorShouldDo: '核心看两项投票：1) 高管薪酬方案通过率——如果低于70%说明股东对管理层不满，2) 董事连任得票率——如果有董事得票低于50%，说明机构投资者在施压。不满的股东=潜在的激进投资者入局，可能推着公司改变策略。',
    pushCopy: {
      title: '{company} 股东大会投票结果',
      body: '高管薪酬方案以{pay_vote}%通过。{director_name}董事连任得票{director_vote}%。{key_proposal}以{proposal_vote}%{result}。',
      cta: '看投票详情',
    },
  },
];

/** Get 8-K item by number */
export function get8KItem(itemNumber: string): EightKItem | undefined {
  return SEC_8K_ITEMS.find(i => i.itemNumber === itemNumber);
}

/** Get impact badge text */
export function getImpactBadge(impact: ImpactDirection): string {
  const map: Record<ImpactDirection, string> = {
    positive: '🟢 利好',
    negative: '🔴 利空',
    neutral: '⚪ 中性',
    uncertain: '🟡 看情况',
  };
  return map[impact];
}

/** Generate user-facing 8-K push notification */
export function generate8KPush(itemNumber: string, params: Record<string, string>): { title: string; body: string; cta: string } {
  const item = get8KItem(itemNumber);
  if (!item) return { title: '新8-K文件', body: '{company}提交了8-K文件。', cta: '查看' };
  let { title, body, cta } = item.pushCopy;
  for (const [k, v] of Object.entries(params)) {
    const re = new RegExp(`\\{${k}\\}`, 'g');
    title = title.replace(re, v);
    body = body.replace(re, v);
  }
  return { title, body, cta };
}

export default SEC_8K_ITEMS;
