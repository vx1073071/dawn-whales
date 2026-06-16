// ══ R252 QClaw P2-24完: AI公开课最终章+毕业证书+全题库 ══
// Final piece: course completion system, full quiz bank, graduation
// Design: "学完不是结束——是鲸灵给你颁发毕业证书的开始"

export interface CourseCertificate {
  issuedTo: string;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  completedDate: string;
  grade: 'S' | 'A' | 'B' | 'C';
  quote: string;
  nextSteps: string[];
}

export interface QuizResult {
  total: number;
  correct: number;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C';
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

// ═══════════════════ 毕业证书生成 ═══════════════════

export function generateCertificate(completed: number, username: string): CourseCertificate {
  const grade: 'S' | 'A' | 'B' | 'C' =
    completed >= 45 ? 'S' :
    completed >= 30 ? 'A' :
    completed >= 15 ? 'B' : 'C';

  const quotes: Record<string, string> = {
    S: '鲸灵遇到过的所有学生里，你是走得最远的那一个。不是因为天赋——是因为你坚持到了最后。🐋',
    A: '你已经掌握了量化交易的核心。剩下的不是知识——是你在市场中积累的每一次"我懂了"的瞬间。',
    B: '过半了——你很棒。但别忘了：策略是用来跑的，不是用来存着的。多跑、多错、多学。',
    C: '开始就是胜利。大多数人连第一讲都没打开。你已经比他们强了。继续！',
  };

  const nextSteps: Record<string, string[]> = {
    S: [
      '在QUANT MOO里选3个你最喜欢的策略，小仓位实盘跑3个月',
      '每周写一篇交易日志——记录每一笔交易的"为什么"',
      '3个月后回头看：哪些策略在实盘里比回测差？为什么？',
      '把你的策略上架到QUANT MOO市场——让别人也来验证你的想法',
    ],
    A: [
      '把没学完的课程补上——模块七(进阶因子)里有加密和另类数据的硬核内容',
      '用一个策略小仓位实盘，每天记录——不用管赚赔，重点是执行',
      '30天后复盘：你的策略执行和回测有多少偏差？',
    ],
    B: [
      '继续学完剩下的课程——模块四到模块六是最实战的部分',
      '挑一个策略模板，把四铁律写完整——写下来比只在脑子里想有用10倍',
      '用模拟盘先跑2周，熟悉执行流程',
    ],
    C: [
      '继续学完剩下的课程——每天1讲，1个月后你就能自己跑策略了',
      '先把四铁律(L17)和仓位管理(L19)学完——这两讲是最重要的',
      '用模拟盘随便选几只股票——不是为了赚钱，是为了熟悉工具',
    ],
  };

  return {
    issuedTo: username,
    courseName: 'QUANT MOO量化交易公开课',
    totalLessons: 45,
    completedLessons: completed,
    completedDate: new Date().toISOString().split('T')[0],
    grade,
    quote: quotes[grade],
    nextSteps: nextSteps[grade],
  };
}

// ═══════════════════ 毕业寄语(TED风格) ═══════════════════

export const GRADUATION_SPEECH = {
  title: '🐋 你学完了。现在开始真正的比赛。',
  body: `恭喜你完成了QUANT MOO量化交易公开课。

45讲，从"量化是什么"走到"建立你自己的交易系统"。你知道因子、策略、回测、过拟合、仓位、止损、情绪——你知道的已经比90%的散户多了。

但坦白说：

这些东西在实盘面前，就像一个游泳教练把自由泳的原理讲完了，然后把学生推进了海里。

你接下来会遇到策略连续亏损——你要忍住不关掉它。
你接下来会遇到一个信号告诉你买，但你的直觉说卖——你要选哪一个？
你接下来会遇到"我的策略明明回测很好，为什么实盘在亏"——你要有耐心找到答案。

这些，不是课上能教你的。

所以今天不是你"毕业"的日子——是你"入学"的日子。你从现在开始，正式入学"市场"这门课。

这门课没有提纲、没有考试、没有毕业证书。
唯一的评分标准是：你明天、下个月、明年——还在不在用规则做交易。

鲸灵会一直陪你。当你想关掉策略的时候，来找我。当你连续亏损怀疑自己的时候，来找我。当你赚了钱有点膨胀了——也来找我。

这个对话框永远为你开着。

现在，关掉课程页面。
打开你的策略页面。
选一个策略。
用1/5仓位。
开始跑。`,
};

// ═══════════════════ 全题库 (45讲×2题 = 90题) ═══════════════════

export interface QuizQuestion {
  id: number;
  lessonNum: number;
  module: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const FULL_QUIZ_BANK: QuizQuestion[] = [
  // M1: 量化投资入门 (L1-L5) — 10题
  { id: 1, lessonNum: 1, module: '量化投资入门',
    question: '量化交易最核心的三个要素是？',
    options: ['A. 数学、物理、编程', 'B. 规则、数据、验证', 'C. 速度、杠杆、仓位', 'D. AI、云计算、大数据'],
    correct: 1, explanation: '量化=规则+数据+验证。不需要复杂的数学和AI——一个"PE<15就买"的规则也是量化。' },
  { id: 2, lessonNum: 1, module: '量化投资入门',
    question: '以下哪个不是量化交易的优势？',
    options: ['A. 避免情绪化决策', 'B. 可以回测验证', 'C. 保证100%赚钱', 'D. 规则客观可重复'],
    correct: 2, explanation: '量化不保证赚钱——它只保证你的决策是有规则的、可验证的。赚钱仍然是概率问题。' },
  { id: 3, lessonNum: 2, module: '量化投资入门',
    question: '策略开发的正确顺序是？',
    options: ['A. 实盘→回测→想法', 'B. 想法→规则→回测→实盘', 'C. 回测→规则→实盘→想法', 'D. 规则→实盘→回测→想法'],
    correct: 1, explanation: '先有一个想法→变成明确规则→用历史数据回测验证→结果还不错→小仓位实盘测试。' },
  { id: 4, lessonNum: 2, module: '量化投资入门',
    question: '"连续跌3天就买"这个想法缺少策略的哪个要素？',
    options: ['A. 没有说买什么', 'B. 没有说买多少', 'C. 没有说什么时候卖', 'D. 以上全部'],
    correct: 3, explanation: '它只说了一个条件，缺了买什么、买多少、什么时候卖——这是一个不完整的策略。' },
  { id: 5, lessonNum: 3, module: '量化投资入门',
    question: 'QUANT MOO里的"扫雷器"是干什么的？',
    options: ['A. 检查是否有内幕交易', 'B. 检测策略是否过拟合', 'C. 扫描市场热点', 'D. 预警股价暴跌'],
    correct: 1, explanation: '扫雷器用5种方法交叉验证你的策略——帮你发现"看起来赚钱但实盘可能亏"的过拟合问题。' },
  { id: 6, lessonNum: 3, module: '量化投资入门',
    question: '你不需要从零写策略——因为QUANT MOO提供了什么？',
    options: ['A. 88个现成的策略模板', 'B. 自动赚钱的机器人', 'C. 基金经理代操', 'D. 保证收益的算法'],
    correct: 0, explanation: '88个策略模板覆盖各种市场和因子组合，一键套用，然后你可以根据自己的判断修改参数。' },
  { id: 7, lessonNum: 4, module: '量化投资入门',
    question: 'PE=10意味着什么？',
    options: ['A. 公司每年赚10块钱', 'B. 花10块钱买1块钱年利润', 'C. 股价10元', 'D. 10年后回本'],
    correct: 1, explanation: 'PE=股价/每股利润。PE=10意味着你花10块钱买每年1块钱的利润——理论上10年回本。' },
  { id: 8, lessonNum: 4, module: '量化投资入门',
    question: 'ROE=20%意味着什么？',
    options: ['A. 公司每年增长20%', 'B. 公司股价涨了20%', 'C. 每100块股东本金一年赚20块', 'D. 分红率20%'],
    correct: 2, explanation: 'ROE=净利润/净资产。ROE=20%意味着每100块股东的钱，公司一年能赚20块——赚钱效率很高。' },
  { id: 9, lessonNum: 5, module: '量化投资入门',
    question: '"赚了觉得是自己厉害，亏了觉得是市场不好"是什么偏误？',
    options: ['A. 损失厌恶', 'B. 确认偏误', 'C. 过度自信', 'D. 锚定效应'],
    correct: 1, explanation: '确认偏误=你总是找证据证明自己是对的。赚=自己厉害；亏=市场有问题——这就是典型的确认偏误。' },
  { id: 10, lessonNum: 5, module: '量化投资入门',
    question: '亏损100块的痛苦大约是盈利100块快乐的几倍？',
    options: ['A. 一样', 'B. 2倍', 'C. 5倍', 'D. 10倍'],
    correct: 1, explanation: '行为金融学研究显示，损失的心理冲击约是同等收益的2倍——这就是"损失厌恶"。' },

  // M2: 因子投资基础 (L6-L10) — 10题
  { id: 11, lessonNum: 6, module: '因子投资基础',
    question: '以下哪个不是经典的因子类型？',
    options: ['A. 动量因子', 'B. 价值因子', 'C. 运气因子', 'D. 质量因子'],
    correct: 2, explanation: '运气不是一个因子——因为它是随机的、不可预测的、不可复制的。你只能在事后知道"运气好坏"。' },
  { id: 12, lessonNum: 6, module: '因子投资基础',
    question: 'Fama-French三因子模型不包括以下哪个？',
    options: ['A. 市场因子', 'B. 市值因子', 'C. 动量因子', 'D. 价值因子'],
    correct: 2, explanation: '经典Fama-French三因子=市场+市值(SMB)+价值(HML)。动量因子是后来追加的。' },
  { id: 13, lessonNum: 7, module: '因子投资基础',
    question: '动量因子在什么时间尺度最有效？',
    options: ['A. 过去1-3天', 'B. 过去6-12个月', 'C. 过去3-5年', 'D. 过去10年'],
    correct: 1, explanation: '6-12个月是动量因子的甜蜜点。太短(1个月内)容易反转，太长(3年+)趋势已经走完了。' },
  { id: 14, lessonNum: 7, module: '因子投资基础',
    question: '以下哪种情况动量策略容易亏损？',
    options: ['A. 市场稳步上涨', 'B. 市场崩溃后突然反转', 'C. 震荡市', 'D. 低成交量环境'],
    correct: 1, explanation: '市场崩溃后突然反转=动量崩溃。之前跌最多的股票反弹最猛，而动量策略还在持有"之前跌得少"的股票。' },
  { id: 15, lessonNum: 8, module: '因子投资基础',
    question: '什么情况下PE=5是陷阱而不是机会？',
    options: ['A. 公司在增长', 'B. 公司盈利在下降且行业在萎缩', 'C. 公司是新上市', 'D. 公司在海外市场'],
    correct: 1, explanation: 'PE低+盈利在下降+行业在萎缩=价值陷阱。市场给低PE不是因为"低估了"——是因为"它确实只值这么多"。' },
  { id: 16, lessonNum: 8, module: '因子投资基础',
    question: '避免价值陷阱最有效的方法是结合什么因子？',
    options: ['A. 动量因子', 'B. 市值因子', 'C. 质量因子(ROE/负债)', 'D. 波动率因子'],
    correct: 2, explanation: '质量因子=好公司。价值+质量=买便宜的+好公司的=不买便宜的+烂公司的=避开价值陷阱。' },
  { id: 17, lessonNum: 9, module: '因子投资基础',
    question: 'Piotroski F-Score的最高分是？',
    options: ['A. 5分', 'B. 7分', 'C. 9分', 'D. 10分'],
    correct: 2, explanation: 'F-Score最高9分。分越高=财务越健康。F-Score≥7通常被认为是优质公司。' },
  { id: 18, lessonNum: 9, module: '因子投资基础',
    question: '质量因子的主要受益场景是？',
    options: ['A. 牛市追涨', 'B. 熊市防守', 'C. 震荡市高抛低吸', 'D. 所有市场都一样'],
    correct: 1, explanation: '质量因子在熊市里有更好的防守属性——好公司的基本面能在经济下行时产生缓冲。' },
  { id: 19, lessonNum: 10, module: '因子投资基础',
    question: '为什么"PE+PB+PS"三个因子的组合价值不大？',
    options: ['A. 三个因子互相矛盾', 'B. 它们都是"便宜"因子，信息重复', 'C. 数据无法获取', 'D. 回测不支持'],
    correct: 1, explanation: 'PE/PB/PS都衡量"便宜"——信息高度重合。加三个不如一个PE+一个ROE(便宜+质量)效果好。' },
  { id: 20, lessonNum: 10, module: '因子投资基础',
    question: '多因子组合里，动量+价值的组合有什么好处？',
    options: ['A. 动量强时价值弱，反之亦然——自然对冲', 'B. 两个都强=双倍收益', 'C. 没有好处', 'D. 只有在A股有效'],
    correct: 0, explanation: '动量和价值天然负相关。一个策略赚钱时另一个可能亏——组合起来整体更平滑。' },

  // M3: 技术分析与信号 (L11-L15) — 10题
  { id: 21, lessonNum: 11, module: '技术分析与信号',
    question: '放量上涨+缩量下跌的组合代表什么？',
    options: ['A. 正常趋势中', 'B. 即将暴跌', 'C. 庄家在出货', 'D. 市场没有方向'],
    correct: 0, explanation: '上涨有人追(放量)、下跌没人逃(缩量)=健康趋势。反过来(缩量上涨+放量下跌)=警惕。' },
  { id: 22, lessonNum: 11, module: '技术分析与信号',
    question: '支撑位为什么有"支撑"效果？',
    options: ['A. 觉得股价便宜的人会买', 'B. 历史上有大量交易发生在那个区间', 'C. 主力在护盘', 'D. 公司会回购'],
    correct: 1, explanation: '支撑位=历史上那个区间有大量买入。价格跌回去时，之前没买到的和之前赚到了的会再次买入。' },
  { id: 23, lessonNum: 12, module: '技术分析与信号',
    question: 'MACD在什么情况下最有效？',
    options: ['A. 震荡市做高抛低吸', 'B. 趋势市做顺势交易', 'C. 任何市场都有效', 'D. 开盘前30分钟'],
    correct: 1, explanation: 'MACD=趋势指标。趋势市有效，震荡市反复打脸。用MACD前先判断市场有没有趋势。' },
  { id: 24, lessonNum: 12, module: '技术分析与信号',
    question: 'MACD背离——价格新高但MACD没新高——意味着什么？',
    options: ['A. 更强烈的买进信号', 'B. 上涨动力在衰竭', 'C. MACD坏了', 'D. 没有意义'],
    correct: 1, explanation: '价格新高+MACD没新高=虽然价格在涨，但上涨的速度在变慢。动力衰竭，可能快见顶了。' },
  { id: 25, lessonNum: 13, module: '技术分析与信号',
    question: 'RSI>70应该怎么做？',
    options: ['A. 立刻卖出', 'B. 判断市场状态后再决定', 'C. 加仓做空', 'D. 忽略，RSI没用'],
    correct: 1, explanation: 'RSI>70≠该卖了。强趋势中RSI可以在70以上很久。关键是判断是趋势市还是震荡市。' },
  { id: 26, lessonNum: 13, module: '技术分析与信号',
    question: 'RSI在哪种市场环境里最有效？',
    options: ['A. 强趋势上涨', 'B. 震荡市', 'C. 恐慌暴跌', 'D. 开盘时段'],
    correct: 1, explanation: 'RSI="回到均值"的效果在震荡市最强。趋势市里RSI会长时间停留在极端区域。' },
  { id: 27, lessonNum: 14, module: '技术分析与信号',
    question: '布林带宽度变窄意味着什么？',
    options: ['A. 股票要退市了', 'B. 低波动——接下来可能会有大波动', 'C. 股价不会再动了', 'D. 应该立刻买入'],
    correct: 1, explanation: '布林带窄=波动率低="暴风雨前的宁静"。通常不久后会有大幅突破（但方向不确定）。' },
  { id: 28, lessonNum: 14, module: '技术分析与信号',
    question: '价格持续"骑"在布林带上轨运行意味着什么？',
    options: ['A. 该卖了', 'B. 强趋势——不要逆势操作', 'C. 布林带参数设错了', 'D. 即将暴跌'],
    correct: 1, explanation: '价格沿着上轨走=超级强趋势。这时候不要因为"碰了上轨"就卖——趋势可能还很长。' },
  { id: 29, lessonNum: 15, module: '技术分析与信号',
    question: '成交量在技术分析中最重要的作用是？',
    options: ['A. 预测涨跌幅', 'B. 验证价格信号的真伪', 'C. 确定买卖时机', 'D. 没有作用'],
    correct: 1, explanation: '成交量不告诉你方向——但它告诉你"这个方向的力度有多真"。放量=真，缩量=可能是假。' },
  { id: 30, lessonNum: 15, module: '技术分析与信号',
    question: '巨量日意味着什么？',
    options: ['A. 一定会大涨', 'B. 这是重要的市场信号——可能见顶或见底', 'C. 没有意义', 'D. 应该忽略成交量'],
    correct: 1, explanation: '异常巨大的成交量=重大分歧。可能是聪明钱在买/卖。很可能是一个转折点。"天量见天价，地量见地价"。' },

  // M4: 策略设计与构建 (L16-L20) — 10题
  { id: 31, lessonNum: 16, module: '策略设计与构建',
    question: '一个好策略的最重要特征是？',
    options: ['A. 回测收益高', 'B. 你能说清楚"为什么能赚钱"', 'C. 参数很多可以调', 'D. 在其他软件上也有效'],
    correct: 1, explanation: '经济逻辑>回测数字。如果你说不清楚为什么这个策略能赚钱——回测再好也可能是运气。' },
  { id: 32, lessonNum: 16, module: '策略设计与构建',
    question: '以下哪个是个好策略的"经济逻辑"？',
    options: ['A. 因为回测显示赚钱', 'B. 因为散户恐慌卖出时机构在接盘', 'C. 因为AI推荐了它', 'D. 因为很多人都在用'],
    correct: 1, explanation: '"散户恐慌+机构接盘=逆向买入机会"是一条有行为金融学支撑的逻辑。其他三个都是"别人说好就是好"。' },
  { id: 33, lessonNum: 17, module: '策略设计与构建',
    question: '策略四铁律不包括？',
    options: ['A. 买什么', 'B. 什么时候买', 'C. 买多少', 'D. 赚多少跑'],
    correct: 3, explanation: '四铁律=买什么+什么时候买+买多少+什么时候卖。"赚多少跑"是卖出规则的一小部分。' },
  { id: 34, lessonNum: 17, module: '策略设计与构建',
    question: '设计策略时最常见的错误是？',
    options: ['A. 只在买入条件上花时间，忽略了卖出', 'B. 忽略了参数优化', 'C. 太早实盘', 'D. 回测时间太短'],
    correct: 0, explanation: '大多数人只关注"什么时候买"——但事实上，Exit比Entry更重要。不知道什么时候卖，一切白费。' },
  { id: 35, lessonNum: 18, module: '策略设计与构建',
    question: '你的策略用了5个参数——这危险吗？',
    options: ['A. 不危险，参数越多越精确', 'B. 有风险——可能过拟合', 'C. 太少，应该用10个以上', 'D. 参数数量无所谓'],
    correct: 1, explanation: '参数越多=自由度越大=越容易恰好和某段历史匹配=过拟合风险。建议不超过3-5个参数。' },
  { id: 36, lessonNum: 18, module: '策略设计与构建',
    question: '如果一个微小参数变化导致收益剧烈变化——这说明什么？',
    options: ['A. 这个参数非常关键', 'B. 策略对参数太敏感→可能过拟合', 'C. 应该继续调参', 'D. 这个参数方向是对的'],
    correct: 1, explanation: '参数敏感度太高=策略不稳定。好的参数是"差不多的范围里结果都还行"的高原型——而非尖峰型。' },
  { id: 37, lessonNum: 19, module: '策略设计与构建',
    question: '职业交易员每笔交易的风险通常控制在总资金的多少？',
    options: ['A. 0.1-0.5%', 'B. 1-2%', 'C. 5-10%', 'D. 只要觉得对，无所谓'],
    correct: 1, explanation: '每笔1-2%。这意味着即使连续亏损50-100次，你还在牌桌上。仓位策略的核心是"活下来"。' },
  { id: 38, lessonNum: 19, module: '策略设计与构建',
    question: '凯利公式的核心思想是？',
    options: ['A. 梭哈最强策略', 'B. 按胜率和盈亏比决定仓位大小', 'C. 每次只用1%资金', 'D. 亏了加倍'],
    correct: 1, explanation: '凯利公式=胜率越高+盈亏比越大→仓位可以越重。但就算最优，通常也不建议超过25%仓位。' },
  { id: 39, lessonNum: 20, module: '策略设计与构建',
    question: '什么时候应该关闭一个运行中的策略？',
    options: ['A. 连续亏损3笔', 'B. 连续亏损超过历史最大回撤的80%', 'C. 这个月没赚钱', 'D. 听说别人有更好的策略'],
    correct: 1, explanation: '历史最大回撤是策略的"最差历史表现"。如果连续亏损逼近这个极限，说明市场可能体制切换了。' },
  { id: 40, lessonNum: 20, module: '策略设计与构建',
    question: '最少多少笔交易后可以对策略做出统计判断？',
    options: ['A. 5笔', 'B. 20-30笔', 'C. 100笔', 'D. 1笔'],
    correct: 1, explanation: '样本量太少→结论不可靠。20-30笔是最小样本量。前10笔全赚或全亏都不能说明问题。' },

  // M5: 回测与验证 (L21-L25) — 10题
  { id: 41, lessonNum: 21, module: '回测与验证',
    question: '回测最该看什么指标（除了总收益）？',
    options: ['A. 日均涨幅', 'B. 最大回撤和夏普比率', 'C. 交易频率', 'D. 最赚钱的一笔'],
    correct: 1, explanation: '最大回撤告诉你"最惨的时候亏多少"，夏普比率告诉你"每承担一份风险赚多少回报"。这两个比总收益重要。' },
  { id: 42, lessonNum: 21, module: '回测与验证',
    question: '回测中"幸存者偏差"指的是？',
    options: ['A. 只有赚钱的策略被统计', 'B. 回测使用的股票都是现在还活着的', 'C. 策略在实盘中幸存下来', 'D. 过度乐观的收益预期'],
    correct: 1, explanation: '用今天的股票池回测过去=你只测试了"还活着"的股票。已经退市的呢？——这就是幸存者偏差。' },
  { id: 43, lessonNum: 22, module: '回测与验证',
    question: '过拟合最典型的信号是什么？',
    options: ['A. 只有样本内赚钱、样本外不赚钱', 'B. 最大回撤大', 'C. 胜率低于50%', 'D. 交易次数多'],
    correct: 0, explanation: '样本内(回测期)赚很多→样本外(新时间段)暴跌=典型过拟合。你拟合了历史的噪音，不是市场的规律。' },
  { id: 44, lessonNum: 22, module: '回测与验证',
    question: 'QUANT MOO扫雷器用几种方法交叉验证过拟合？',
    options: ['A. 1种', 'B. 3种', 'C. 5种', 'D. 10种'],
    correct: 2, explanation: '5种：样本内外对比、参数敏感度、Bootstrap置信区间、猴子测试、蒙特卡洛模拟。' },
  { id: 45, lessonNum: 23, module: '回测与验证',
    question: '蒙特卡洛模拟在策略评估中的作用是？',
    options: ['A. 预测明天涨跌', 'B. 测试"如果历史交易顺序不同，策略还会不会赚钱"', 'C. 优化参数', 'D. 找最佳买卖点'],
    correct: 1, explanation: '蒙特卡洛把历史交易顺序随机打乱一万次，看你的策略在最倒霉的排序下最多亏多少。' },
  { id: 46, lessonNum: 23, module: '回测与验证',
    question: '蒙特卡洛模拟不适合哪种策略？',
    options: ['A. 日频动量策略', 'B. 依赖特定时序的事件驱动策略', 'C. 多因子策略', 'D. 均线策略'],
    correct: 1, explanation: '事件驱动策略（如财报后买）依赖事件发生的时间顺序——打乱后就失去意义了。' },
  { id: 47, lessonNum: 24, module: '回测与验证',
    question: '回测里的利润在实盘可能消失的主要原因是？',
    options: ['A. 策略失效了', 'B. 滑点和手续费', 'C. 数据不准', 'D. 运气不好'],
    correct: 1, explanation: '回测假设你以完美价格成交。实盘里你想买100元可能买成100.1元(滑点)，还要交手续费。高频策略尤其敏感。' },
  { id: 48, lessonNum: 24, module: '回测与验证',
    question: '一个好的滑点估算方法是？',
    options: ['A. 全部设成0.5%', 'B. 按流动性：大盘股0.05-0.1%、小盘股0.3-0.5%', 'C. 不需要估算', 'D. 设成0'],
    correct: 1, explanation: '大盘股流动性好→滑点低(0.05-0.1%)。小盘股流动性差→滑点高(0.3-0.5%)。极端行情1-2%。' },
  { id: 49, lessonNum: 25, module: '回测与验证',
    question: '如果你的策略在1000个随机策略中排名第80——这意味着？',
    options: ['A. 策略很差', 'B. 策略有效（前8%）', 'C. 运气好', 'D. 应该优化'],
    correct: 1, explanation: '前8%说明你的策略确实比92%的随机买法好——这是真Alpha。前50%=你的策略跟扔飞镖差不多。' },
  { id: 50, lessonNum: 25, module: '回测与验证',
    question: '超额收益(Alpha)是什么？',
    options: ['A. 总收益', 'B. 策略收益-基准收益', 'C. 最高单日收益', 'D. 手续费后的收益'],
    correct: 1, explanation: 'Alpha=你的策略赚的-同期大盘赚的。如果大盘涨了20%你的策略涨了25%→Alpha=5%。这才是你的真本事。' },

  // M6: 实盘与心理 (L26-L30) — 10题
  { id: 51, lessonNum: 26, module: '实盘与心理',
    question: '从回测到实盘，第一步应该？',
    options: ['A. 全仓买入', 'B. 用1/5仓位先跑1个月', 'C. 等最好的买入时机', 'D. 再回测更多历史数据'],
    correct: 1, explanation: '先小仓位验证——不是验证策略赚不赚钱，是验证策略执行和回测是一致的(滑点/成交率一致)。' },
  { id: 52, lessonNum: 26, module: '实盘与心理',
    question: '实盘前30天最重要的目标是什么？',
    options: ['A. 赚钱', 'B. 验证策略执行是否和回测一致', 'C. 打败其他人', 'D. 找到更好的策略'],
    correct: 1, explanation: '前30天目标≠赚钱。目标是看实盘中滑点、成交率、时机偏差是否和回测一致。' },
  { id: 53, lessonNum: 27, module: '实盘与心理',
    question: '股票从100跌到50——要涨多少才能回100？',
    options: ['A. 50%', 'B. 100%', 'C. 200%', 'D. 25%'],
    correct: 1, explanation: '50到100=涨100%。这就是不止损的隐藏代价——亏50%容易，回本需要翻倍。' },
  { id: 54, lessonNum: 27, module: '实盘与心理',
    question: '以下哪个是移动止损的正确应用？',
    options: ['A. 止损线永远不动', 'B. 赚钱后把止损线往上提锁定利润', 'C. 亏损后把止损线往下移', 'D. 赚钱后取消止损'],
    correct: 1, explanation: '移动止损=价格涨了→止损线跟着上移→锁定的利润越来越多。价格跌了→止损线不动→该走还是走。' },
  { id: 55, lessonNum: 28, module: '实盘与心理',
    question: 'VIX>40通常意味着？',
    options: ['A. 火速卖出所有股票', 'B. 恐慌可能已到顶点——反而是机会', 'C. 市场会上涨', 'D. VIX数值没有意义'],
    correct: 1, explanation: 'VIX>40=极度恐慌。历史上VIX见顶往往是市场见底的前兆——但当下的决策仍需要结合其他信号。' },
  { id: 56, lessonNum: 28, module: '实盘与心理',
    question: 'Put/Call比率高意味着什么？',
    options: ['A. 很多人看好后市', 'B. 市场在极端看空——但可能反转', 'C. 没有意义', 'D. 应该买入看涨期权'],
    correct: 1, explanation: 'P/C高=太多人在买看跌期权=市场已经为下跌做好了准备→反而空头的弹药快用完了→大概率反转。' },
  { id: 57, lessonNum: 29, module: '实盘与心理',
    question: '一个好的每日交易流程不应该花超过多少时间在"盯盘"上？',
    options: ['A. 10分钟', 'B. 30分钟', 'C. 2小时', 'D. 整天'],
    correct: 1, explanation: '如果你花了超过30分钟在盯盘上→你是在噪音里游泳。策略应该告诉你什么时候行动，不需要你一直盯着。' },
  { id: 58, lessonNum: 29, module: '实盘与心理',
    question: '管理3-5个策略和找更多新策略，哪个更有效？',
    options: ['A. 找更多新策略', 'B. 执行好3-5个现有策略', 'C. 两者一样', 'D. 看情况'],
    correct: 1, explanation: '策略不是越多越好。把时间花在"3-5个策略执行到位"比"不停找新策略"有效得多。' },
  { id: 59, lessonNum: 30, module: '实盘与心理',
    question: '学完45讲课之后，接下来最重要的是？',
    options: ['A. 再学一遍', 'B. 开始做——用一个策略小仓位实盘', 'C. 等市场好再开始', 'D. 找更厉害的课程'],
    correct: 1, explanation: '45节课不如一笔交易。知识不会赚钱——行动才会。用最小的仓位开始，边做边学。' },
  { id: 60, lessonNum: 30, module: '实盘与心理',
    question: '量化交易最重要的品质是什么？',
    options: ['A. 聪明', 'B. 数学好', 'C. 坚持——持续用规则做交易', 'D. 速度快'],
    correct: 2, explanation: '最赚钱的不是最聪明的交易员——是最能坚持的。策略好+坚持执行=长期收益 > 策略极好+三天打鱼。' },

  // M7: 进阶因子 (L31-L35) — 10题
  { id: 61, lessonNum: 31, module: '进阶因子',
    question: 'Smart Beta ETF是什么？',
    options: ['A. 主动管理基金', 'B. 按因子规则选股打包的被动ETF', 'C. AI管理的基金', 'D. 保本理财产品'],
    correct: 1, explanation: 'Smart Beta=介于被动和主动之间。按因子规则(价值/动量/质量等)选股打包成ETF，省去你自己选股的麻烦。' },
  { id: 62, lessonNum: 31, module: '进阶因子',
    question: 'Smart Beta ETF的最大隐藏风险是？',
    options: ['A. 管理费太高', 'B. 因子拥挤——所有人都在买同一个策略', 'C. 流动性差', 'D. 没有风险'],
    correct: 1, explanation: '当所有人都在涌入同一个Smart Beta ETF（如低波动）→这个因子的溢价被挤没了→反而开始失效。' },
  { id: 63, lessonNum: 32, module: '进阶因子',
    question: 'BTC的MVRV>3通常意味着什么？',
    options: ['A. BTC被低估了', 'B. 大部分BTC持有者都在赚钱→可能过热', 'C. BTC即将暴涨', 'D. 没有意义'],
    correct: 1, explanation: 'MVRV=市值/实现价值。>3意味着市场平均成本远低于当前价格→大部分人浮盈→获利盘随时可能砸盘。' },
  { id: 64, lessonNum: 32, module: '进阶因子',
    question: '加密货币的资金费率高意味着什么？',
    options: ['A. 持有现货的人很多', 'B. 做多合约的人太多→空头弹药匮乏→挤兑风险', 'C. 应该买入', 'D. 市场很健康'],
    correct: 1, explanation: '资金费率=多头付给空头的保险费。费率高=太多人做多→一旦下跌，多头被清算→连锁爆仓。' },
  { id: 65, lessonNum: 33, module: '进阶因子',
    question: 'ESG因子的量化逻辑是？',
    options: ['A. 好公司应该赚更多钱', 'B. ESG好的公司经营更稳健→风险更低', 'C. 道德越高回报越高', 'D. ESG评分=赚钱能力'],
    correct: 1, explanation: 'ESG通过"风险更低"来产生回报溢价——非"做好事有回报"。治理好、环境意识强的公司，出黑天鹅的概率更小。' },
  { id: 66, lessonNum: 33, module: '进阶因子',
    question: 'ESG因子在中国A股的主要问题是？',
    options: ['A. 中国公司都不环保', 'B. ESG数据质量和评级体系还不成熟', 'C. A股不支持ESG投资', 'D. ESG和中国市场无关'],
    correct: 1, explanation: 'A股的ESG披露和评级标准还在发展中——不同评级机构给同一家公司的评分差别很大，参考价值有限。' },
  { id: 67, lessonNum: 34, module: '进阶因子',
    question: '为什么美股有效的动量因子在A股可能不一样？',
    options: ['A. A股没有动量', 'B. A股散户占比高——追涨杀跌更极端但反转也更快', 'C. A股不可以用动量', 'D. 没有区别'],
    correct: 1, explanation: '散户占比高→情绪驱动的追涨杀跌更猛→动量更极端→但见顶后反转也更猛。策略参数需要相应调整。' },
  { id: 68, lessonNum: 34, module: '进阶因子',
    question: '港股特有的一个因子信号是？',
    options: ['A. K线形态', 'B. 港股通资金流向——南下资金大幅流入的港股长期表现更好', 'C. MACD金叉', 'D. 没有特殊因子'],
    correct: 1, explanation: '港股通资金流向是港股独有的"因子"——南下资金的买入方向有持续的信息优势，长期跟踪有效。' },
  { id: 69, lessonNum: 35, module: '进阶因子',
    question: '以下哪种数据最可能属于靠谱的另类数据？',
    options: ['A. Twitter某大V对股票的评论', 'B. 停车场卫星图中车流量下降', 'C. 某AI生成的"买入信号"', 'D. 社交媒体的表情包数量'],
    correct: 1, explanation: '停车场卫星图=客观、可量化、难以操纵。Twitter评论=噪音大、容易操纵。靠谱的另类数据需要客观性。' },
  { id: 70, lessonNum: 35, module: '进阶因子',
    question: '散户最容易获取的另类数据替代品是？',
    options: ['A. 卫星数据', 'B. Google Trends搜索热度', 'C. 信用卡交易数据', 'D. 私有卫星图像'],
    correct: 1, explanation: 'Google Trends免费、可获取、趋势清晰——品牌搜索热度和某些公司的业绩有一定相关性。' },

  // M8: 实战案例 (L36-L40) — 10题
  { id: 71, lessonNum: 36, module: '实战案例',
    question: '2020年3月熊市中表现最抗跌的因子策略是？',
    options: ['A. 动量策略', 'B. 价值策略', 'C. 低波动策略', 'D. 成长策略'],
    correct: 2, explanation: '低波动策略在恐慌中表现最好——这正是它被设计来做的事。动量策略在暴跌中通常表现最差。' },
  { id: 72, lessonNum: 36, module: '实战案例',
    question: '2020年3月教会我们的最重要的事是？',
    options: ['A. 永远不要买股票', 'B. 危机中"能执行策略"比"认清哪些是好策略"更重要', 'C. 量化策略没用', 'D. 应该全仓做空'],
    correct: 1, explanation: '恐慌中你知道"应该逆向买入"——但你敢吗？知道和做到之间，隔着情绪控制。' },
  { id: 73, lessonNum: 37, module: '实战案例',
    question: '2022年价值因子大爆发的原因是什么？',
    options: ['A. 运气好', 'B. 美联储加息→利率上升→"今天的利润"比"未来的利润"更值钱', 'C. 价值因子突然变有效了', 'D. 科技公司业绩变差'],
    correct: 1, explanation: '加息→贴现率上升→未来现金流的现值下降→"现在就能赚钱"的价值股比"将来才能赚钱"的成长股更有吸引力。' },
  { id: 74, lessonNum: 37, module: '实战案例',
    question: '2010-2020年价值因子跑输，如果你在此期间坚持了——2022年你得到了什么？',
    options: ['A. 继续亏损', 'B. 一年赚回了过去10年的超额损失', 'C. 没什么变化', 'D. 价值因子彻底失效'],
    correct: 1, explanation: '2022年MSCI价值指数跑赢成长指数约20个百分点——10年的亏空，一年就填回来了。' },
  { id: 75, lessonNum: 38, module: '实战案例',
    question: 'AI泡沫中出现"动量集中度过高"意味着什么？',
    options: ['A. 这是重大机会', 'B. 反转可能很大——泡沫不长久', 'C. 应该加仓', 'D. AI技术是未来，不怕泡沫'],
    correct: 1, explanation: '当动量策略40%+的仓位集中在一个行业=危险信号。泡沫越大，戳破后的踩踏越猛烈。' },
  { id: 76, lessonNum: 38, module: '实战案例',
    question: '如何防止动量策略在泡沫中踩踏？',
    options: ['A. 不管泡沫，让策略自己跑', 'B. 限制持仓集中度——某行业占比不超过30%', 'C. 全部卖出', 'D. 改用价值策略'],
    correct: 1, explanation: '持仓集中度限制是最简单的风控——不把鸡蛋放在一个篮子里，哪怕这个篮子"看起来"在飞。' },
  { id: 77, lessonNum: 39, module: '实战案例',
    question: '一个策略从设计到稳定盈利通常需要多长时间？',
    options: ['A. 一周', 'B. 一个月', 'C. 3-6个月甚至更长', 'D. 一天'],
    correct: 2, explanation: '设计→回测→扫雷→调整→小仓位实盘→观察→优化→加大仓位。这个过程快的3个月，正常的6-12个月。' },
  { id: 78, lessonNum: 39, module: '实战案例',
    question: '当策略在实盘中连续亏损时，第一步应该？',
    options: ['A. 关掉策略找新的', 'B. 判断是策略逻辑问题还是市场体制切换', 'C. 加倍赌注把亏的赚回来', 'D. 放弃量化'],
    correct: 1, explanation: '先判断原因：是策略本来就有问题(逻辑漏洞)，还是市场体制换了(策略"不擅长"的时期)。' },
  { id: 79, lessonNum: 40, module: '实战案例',
    question: '卖方策略和买方策略的最大区别是？',
    options: ['A. 卖方策略收益率更高', 'B. 卖方策略"好看"(曲线完美)，买方策略"有用"(扛得住真实市场)', 'C. 没有区别', 'D. 卖方策略更便宜'],
    correct: 1, explanation: '卖方策略的KPI是"让别人觉得好"→回测被美化。买方策略的KPI是"自己用着赚钱"→实盘表现真实。' },
  { id: 80, lessonNum: 40, module: '实战案例',
    question: '真正赚钱的策略为什么很少被公开上架？',
    options: ['A. 因为策略没用', 'B. 因为公开后资金涌入→策略立刻失效', 'C. 因为创作者不想分享', 'D. 策略都过拟合了'],
    correct: 1, explanation: '一个好策略被大量资金同时执行→同一个交易信号→大家一起买→价格推上去→收益摊薄→失效。' },

  // M9: 高级话题 (L41-L45) — 10题
  { id: 81, lessonNum: 41, module: '高级话题',
    question: '最好的对冲是？',
    options: ['A. 买等量的看跌期权', 'B. 找一个和你持仓负相关的资产', 'C. 把所有仓位卖掉', 'D. 买对家公司的股票'],
    correct: 1, explanation: '买等量看跌期权太贵。最佳对冲=持仓跌了对冲一定涨。比如股票+长期国债(经典60/40组合)。' },
  { id: 82, lessonNum: 41, module: '高级话题',
    question: '分散和对冲的区别是？',
    options: ['A. 没有区别', 'B. 分散=减少单一风险；对冲=用负相关资产保护', 'C. 对冲就是分散', 'D. 分散优于对冲'],
    correct: 1, explanation: '分散="不把所有鸡蛋放一个篮子里"。对冲="篮子摔了也有安全网接着"。两者互补，不是替代。' },
  { id: 83, lessonNum: 42, module: '高级话题',
    question: 'ADX>25通常意味着什么？',
    options: ['A. 震荡市', 'B. 趋势市', 'C. 即将崩盘', 'D. 市场没有方向'],
    correct: 1, explanation: 'ADX(Average Directional Index)>25=趋势明确。ADX<20=震荡市。ADX不告诉你方向，告诉你"趋势强度"。' },
  { id: 84, lessonNum: 42, module: '高级话题',
    question: 'Vix指数低于15意味着什么？',
    options: ['A. 极度恐慌', 'B. 低波动——市场很平静', 'C. 应该卖出', 'D. 没有参考价值'],
    correct: 1, explanation: 'VIX<15=低波动、"太平日子"。但要注意：低波动通常不会持续很久——在大波动之前，波动率往往很低。' },
  { id: 85, lessonNum: 43, module: '高级话题',
    question: '两个收益率10%但相关性为0.2的策略组合——总收益可能？',
    options: ['A. 还是10%，但波动大幅下降', 'B. 变成20%', 'C. 变成5%', 'D. 没有任何变化'],
    correct: 0, explanation: '低相关性+相同收益=总收益基本不变但总波动率大幅下降。这就是多策略的"免费午餐"。' },
  { id: 86, lessonNum: 43, module: '高级话题',
    question: '策略组合中"等权重"配置方法的最大优点是？',
    options: ['A. 收益最高', 'B. 最保险——不做主观判断，不偏好任何策略', 'C. 波动最小', 'D. 适合所有市场'],
    correct: 1, explanation: '等权重=不预判哪个策略接下来会好。虽然不一定最优，但它不会因为"你偏好错了"而导致重大偏差。' },
  { id: 87, lessonNum: 44, module: '高级话题',
    question: '职业量化交易员每天花在盯盘上的时间建议不超过？',
    options: ['A. 15分钟', 'B. 30分钟', 'C. 2小时', 'D. 8小时'],
    correct: 1, explanation: '策略应该自动化——你每天只需要检查信号、确认是否按计划执行。盯盘>30分钟=你的策略没设计好。' },
  { id: 88, lessonNum: 44, module: '高级话题',
    question: '周末最适合做什么量化相关的事？',
    options: ['A. 两天都在盯盘（虽然不开盘）', 'B. 回测新想法、复盘本周、更新策略组合', 'C. 不要碰量化——完全休息', 'D. 每天随机交易'],
    correct: 1, explanation: '周末2小时=最佳研究时间。回测上周想到的新点子、复盘本周执行情况、调整下月策略组合。' },
  { id: 89, lessonNum: 45, module: '高级话题',
    question: '学完45讲之后，鲸灵建议的第一步行动是？',
    options: ['A. 继续找更好的课程', 'B. 选一个策略+小仓位+开始跑', 'C. 等所有条件完美再开始', 'D. 分享给别人让别人先试'],
    correct: 1, explanation: '45节课不如一笔交易。立刻行动——选一个最简单的策略，用最小的仓位，先跑起来再说。' },
  { id: 90, lessonNum: 45, module: '高级话题',
    question: '量化交易最重要的品质是什么？',
    options: ['A. 数学天赋', 'B. 编程能力', 'C. 坚持用规则执行', 'D. 运气好'],
    correct: 2, explanation: '坚持>天赋。一个"还行"的策略+严格执行 > 一个"完美"的策略+三天打鱼。长期盈利=纪律×时间。' },
];

// ═══════════════════ 测验评分 ═══════════════════

export function gradeQuiz(correct: number, total: number): QuizResult {
  const score = (correct / total) * 100;

  const grade: QuizResult['grade'] =
    score >= 90 ? 'S' :
    score >= 75 ? 'A' :
    score >= 60 ? 'B' : 'C';

  const feedbacks: Record<string, string> = {
    S: '🏆 学霸级别！45讲课你已经消化得很好了。但别忘了——懂了不等于能在实盘中做到。',
    A: '👍 很不错！你掌握了大部分核心概念。建议回头翻翻你答错的题目的解释。',
    B: '📚 及格了——但还有提升空间。你答错的那几题对应了一些重要概念，建议重新看对应的几讲。',
    C: '📖 还需要多学学——但没关系。量化交易不是拼"第一次考试拿高分"，是拼"持续学习的能力"。',
  };

  const weaknesses: string[] = [];
  if (score < 80) weaknesses.push('建议重点复习你答错的题目对应的课程模块');
  if (score < 60) weaknesses.push('建议从模块一(量化入门)重新看起——打好基础最重要');

  return {
    total,
    correct,
    score,
    grade,
    feedback: feedbacks[grade],
    strengths: score >= 80 ? ['因子分类、回测方法、仓位管理概念掌握良好'] : ['已经迈出了第一步'],
    weaknesses,
  };
}

// ═══════════════════ 课程索引 ═══════════════════

export const COURSE_INDEX = {
  title: 'QUANT MOO量化交易公开课 — 完整课程索引',
  totalModules: 9,
  totalLessons: 45,
  totalQuizQuestions: 90,
  modules: [
    { name: '量化投资入门', lessons: 'L1-L5', description: '从零认识量化交易', quizCount: 10 },
    { name: '因子投资基础', lessons: 'L6-L10', description: '掌握因子的核心概念', quizCount: 10 },
    { name: '技术分析与信号', lessons: 'L11-L15', description: '技术指标的量化使用', quizCount: 10 },
    { name: '策略设计与构建', lessons: 'L16-L20', description: '从想法到完整策略', quizCount: 10 },
    { name: '回测与验证', lessons: 'L21-L25', description: '用数据验证你的策略', quizCount: 10 },
    { name: '实盘与心理', lessons: 'L26-L30', description: '从纸上到真钱', quizCount: 10 },
    { name: '进阶因子', lessons: 'L31-L35', description: '高级因子和另类数据', quizCount: 10 },
    { name: '实战案例', lessons: 'L36-L40', description: '真实市场的血泪教训', quizCount: 10 },
    { name: '高级话题', lessons: 'L41-L45', description: '对冲·体制·多策略·生活', quizCount: 10 },
  ],
  totalStudyTime: '37.5小时（45讲×平均10分钟）',
  recommendedPath: [
    '第一周 M1+M2: 理解量化和因子基础 (10讲)',
    '第二周 M3: 技术指标的量化视角 (5讲)',
    '第三周 M4+M5: 策略设计和回测 (10讲)',
    '第四周 M6+M7: 实盘心理和进阶因子 (10讲)',
    '第五周 M8+M9: 实战案例和高级话题 (10讲)',
  ],
};

export default { FULL_QUIZ_BANK, GRADUATION_SPEECH, COURSE_INDEX, generateCertificate, gradeQuiz };
