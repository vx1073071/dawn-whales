/**
 * Factor Humanize Copy Library — 因子人话翻译文案库
 *
 * 42因子的"人话比喻"文案 + 15指标的速判翻译。
 * 用于 AI Factor Advisor 输出 + FactorCard hover 展示 + FactorLab 新手引导。
 *
 * 每条文案包含:
 *   - oneLineDescription: 一句话描述 (≤25字, 卡片显示)
 *   - humanStory: 大白话解释 (≤80字, 详情面板)
 *   - goodNews: 当这个因子数值"好"时怎么解释
 *   - badNews: 当这个因子数值"差"时怎么解释
 *   - metaphor: 生活化比喻 (让新手能类比理解)
 *   - goodWhen: 什么情况下这个因子好用 (市场环境)
 *   - badWhen: 什么情况下这个因子不好用 (失效场景)
 *
 * @module factor-copy-library
 * @author QClaw(设计虾)
 * @task R181 P0-09
 */

// ─── 类型定义 ────────────────────────────────────────────

export interface FactorCopy {
  /** 因子技术ID */
  factorId: string;
  /** 中文名称 */
  nameCN: string;
  /** 分类: momentum/value/quality/volatility/liquidity/size/sentiment/macro/crypto */
  category: string;
  /** 一句话描述 (≤25字) */
  oneLineDescriptionCN: string;
  /** 大白话解释 (≤80字) */
  humanStoryCN: string;
  /** 好消息：当因子数值"好"时的解读 */
  goodNews: string;
  /** 坏消息：当因子数值"差"时的解读 */
  badNews: string;
  /** 生活化比喻 */
  metaphor: string;
  /** 什么市场环境好用 */
  goodWhen: string;
  /** 什么市场环境失效 */
  badWhen: string;
}

// ─── 42因子人话文案库 ────────────────────────────────────

export const FACTOR_COPY_LIBRARY: Record<string, FactorCopy> = {

  // ═══ 动量因子 (4) ═══════════════════════════════════════

  MOM_12M: {
    factorId: 'MOM_12M',
    nameCN: '12月动量',
    category: 'momentum',
    oneLineDescriptionCN: '过去12个月涨得好的股票，未来还可能继续涨',
    humanStoryCN:
      '就像赛跑，前半程跑得快的人后半程往往也不慢。12个月动量因子就是找那些"已经在跑道上领先"的股票，假设这个趋势还会持续。',
    goodNews: '动量因子IC为正值且稳定，说明"强者恒强"的规律正在发挥作用——市场在奖励持续上涨的股票。',
    badNews: '动量因子IC下降或为负，说明市场在"杀高位"——之前涨得好的股票现在反而在跌，趋势已经反转。',
    metaphor: '🏃 就像百米赛跑：50米领先的人，80米处大概率还是领先——除非他突然抽筋。',
    goodWhen: '趋势市（牛市中期），资金持续流入强势板块，动量因子表现最好。',
    badWhen: '震荡市或熊市初期，前期强势股容易补跌，动量因子会"追高被套"。',
  },

  MOM_1M: {
    factorId: 'MOM_1M',
    nameCN: '1月动量',
    category: 'momentum',
    oneLineDescriptionCN: '最近1个月涨势好的股票，短期惯性可能持续',
    humanStoryCN:
      '刚过去的1个月里表现最好的股票，就像刚加速的汽车，惯性还会往前冲一小段。但注意这个"惯性"很短，可能一两周就衰竭了。',
    goodNews: '1月动量信号强，说明市场短期趋势明确——顺势而为的机会窗口在打开。',
    badNews: '1月动量反转，说明市场在快速轮动——今天涨的明天可能就跌了，短线追涨风险极高。',
    metaphor: '🚗 就像刚踩油门的车：前几秒推背感很强，但红绿灯一来就得刹车。',
    goodWhen: '单边上涨或下跌市——趋势越清晰，1月惯性越可靠。',
    badWhen: '震荡市——来得快去得也快，容易"买在尖顶上"。',
  },

  RSI_14: {
    factorId: 'RSI_14',
    nameCN: '相对强弱(RSI)',
    category: 'momentum',
    oneLineDescriptionCN: '衡量股价"涨累了没有"的温度计——太高=过热，太低=过冷',
    humanStoryCN:
      '就像体温计，RSI告诉你股价是否"发烧"了。超过70就是"高烧"（可能该退烧了），低于30就是"低温"（可能该回暖了）。但它只管"现在热不热"，不管"为什么这么热"。',
    goodNews: 'RSI从低位(30)回升，可能意味着"过冷"的股票正在回暖——是潜在买点。',
    badNews: 'RSI在高位(70)持续不跌，意味着"高烧不退"——虽然还在涨，但回调风险在积累。',
    metaphor: '🌡️ 体温计：38°C就该注意了，40°C一定要降温。但发着烧还能跑步的也有（强趋势）。',
    goodWhen: '震荡市——RSI的"高抛低吸"信号在箱体震荡中非常有效。',
    badWhen: '强趋势市——RSI可能长期趴在80或20，反复"超买"信号会变成噪音。',
  },

  MACD: {
    factorId: 'MACD',
    nameCN: 'MACD',
    category: 'momentum',
    oneLineDescriptionCN: '快慢两条均线的距离——距离变大=趋势加速，距离缩小=趋势衰竭',
    humanStoryCN:
      '把快的人和慢的人放一起跑，看他们之间的距离。距离越来越大说明快的人越跑越快（趋势加速）；距离越来越小说明快的人累了在减速（趋势衰竭，可能反转）。',
    goodNews: 'MACD金叉（快线从下穿到上），是"加速信号"——趋势可能从下跌转为上涨。',
    badNews: 'MACD死叉（快线从上跌到下），是"衰竭信号"——上涨趋势可能到头了。',
    metaphor: '🏃‍♂️🏃 两个人跑步：快的越跑越远=趋势强；快的慢下来=可能要转身了。',
    goodWhen: '趋势明显时——MACD的交叉信号在持续上涨或下跌中很准。',
    badWhen: '横盘震荡——反复金叉死叉，每次都是假信号，俗称"MACD打脸"。',
  },

  // ═══ 价值因子 (5) ═══════════════════════════════════════

  HML: {
    factorId: 'HML',
    nameCN: '价值(HML)',
    category: 'value',
    oneLineDescriptionCN: '便宜的股票 vs 贵的股票——便宜的不一定不好',
    humanStoryCN:
      '高账面/市值比（即"便宜"的股票）长期来看回报更高。就像逛超市，打折区不一定都是烂货——有些好公司只是因为暂时不受欢迎就被低估了。',
    goodNews: '价值因子溢价明显，说明市场在"回归理性"——被低估的公司正在被重新发现价值。',
    badNews: '价值因子跑输成长因子，说明市场正在"奖赏梦想、惩罚现实"——这个阶段赚钱的公司反而被冷落。',
    metaphor: '🛒 超市折扣区：有些是临期的该扔，有些是包装旧了但内容没变——价值投资就是挑后者。',
    goodWhen: '利率上升期或经济复苏初期——钱变贵了，大家开始精打细算，便宜的反而吃香。',
    badWhen: '科技牛市或流动性泛滥——没人关心价格是否合理，"能涨就行"。',
  },

  'EarnYield(EP)': {
    factorId: 'EarnYield(EP)',
    nameCN: '盈利收益率',
    category: 'value',
    oneLineDescriptionCN: '每花1块钱买股票，公司能赚回来多少——回报越高越划算',
    humanStoryCN:
      '盈利收益率就是"买入价格 ÷ 每股盈利"，数字越大说明你花的钱买到更多盈利。就像买房子，租金回报率越高，你的投入越划算。',
    goodNews: '盈利收益率高且稳定上升，说明公司赚钱能力在增强而股价还没追上来——找到了"被低估的好公司"。',
    badNews: '盈利收益率突然跳升——可能不是因为公司赚更多了，而是股价暴跌了——别被便宜迷惑。',
    metaphor: '🏠 买房看租金回报率：月租5000、房200万=回报率3%；月租5000、房150万=回报率4%——当然买150万的划算。',
    goodWhen: '价值回归阶段——当市场重新关注公司的实际盈利能力时，这个因子最有效。',
    badWhen: '成长股爆发期——营收暴增但盈利还跟不上的阶段，这个因子会误判"太贵"。',
  },

  DivYield: {
    factorId: 'DivYield',
    nameCN: '股息率',
    category: 'value',
    oneLineDescriptionCN: '股价跌了也不怕——每年分红就是你的"保底收益"',
    humanStoryCN:
      '不管股价涨跌，高股息公司每年都会给你发钱。就像买了只会下蛋的母鸡，即使鸡肉价格跌了，鸡蛋还是照下不误。',
    goodNews: '股息率持续上升且股息支付率合理（<60%），说明公司有真金白银分给股东——不是纸上利润。',
    badNews: '股息率异常高（>8%）——可能不是慷慨大方，而是股价跌太多了，而且很可能要削减分红。',
    metaphor: '🐔 下蛋母鸡：鸡价可能跌，但鸡蛋不会停。前提是——这只鸡不是病鸡（不是要破产了）。',
    goodWhen: '低利率环境或市场恐慌期——"确定的分红"比"可能的涨幅"更让人安心。',
    badWhen: '高成长市场——分红再高也比不上股价翻倍，"捡了芝麻丢了西瓜"。',
  },

  'BookToPrice(BP)': {
    factorId: 'BookToPrice(BP)',
    nameCN: '市净率(反向)',
    category: 'value',
    oneLineDescriptionCN: '公司"清盘价" vs "市场价"——折价越多越安全',
    humanStoryCN:
      '账面价值是你把公司全部卖了能收回多少钱。市净率越高说明市场给公司的溢价越离谱；越低说明你花的钱越接近公司的"清算价"。就像买二手车，越接近报废价值越安全——最多亏到报废价。',
    goodNews: '市净率低且ROE高——"便宜的好公司"——你花很少的钱买到了很强的盈利能力。',
    badNews: '市净率低但ROE也低——"便宜是有原因的"——这公司可能真的不值钱。',
    metaphor: '🚗 二手车：10万的车卖5万=便宜；但如果是泡水车，卖2万也不要——便宜≠好。',
    goodWhen: '熊市底部或金融/能源等重资产行业——这些行业用账面价值衡量最准确。',
    badWhen: '科技/互联网等轻资产行业——这些公司的价值在"人"和"数据"里，不在"资产"里。',
  },

  GROWTH: {
    factorId: 'GROWTH',
    nameCN: '成长因子',
    category: 'value',
    oneLineDescriptionCN: '营收和盈利增长速度——不是现在赚多少，而是未来能多赚多少',
    humanStoryCN:
      '成长因子关注的是"加速度"而不是"速度"。一家公司今年赚10亿明年赚12亿（20%增长），比一家每年稳定赚15亿的公司更受成长投资者青睐。',
    goodNews: '成长因子溢价明显，说明市场愿意为"未来"付高价——这个时候要顺势而为。',
    badNews: '成长因子跑输，说明市场从"谈梦想"切换到"看业绩"——那些只有故事没有利润的公司首先被抛弃。',
    metaphor: '🌱 竹子和松树：竹子一天长一米但容易折（高成长+高风险），松树长得慢但能活几百年（稳定但不刺激）。',
    goodWhen: '低利率+经济扩张——借钱便宜，增长故事有泡沫可吹。',
    badWhen: '加息周期——未来的钱变贵了，大家只要"现在"，不要"可能"。',
  },

  // ═══ 质量因子 (5) ═══════════════════════════════════════

  QUAL: {
    factorId: 'QUAL',
    nameCN: '质量因子',
    category: 'quality',
    oneLineDescriptionCN: '好公司在任何时候都不差——高ROE+低杠杆+稳定盈利',
    humanStoryCN:
      '质量因子就是找"各项指标都过硬"的公司——不仅赚钱(高ROE)，而且赚的是真钱(稳定盈利)，借钱也借得克制(低杠杆)。就像挑员工，不仅绩效好，还不出错、不惹事。',
    goodNews: '质量因子溢价，说明市场在"避险"——大家只敢买最好的公司。',
    badNews: '质量因子跑输，说明市场在"撒钱"——不管好公司烂公司都在涨，质量区分度下降。',
    metaphor: '🎓 学霸 vs 投机者：学霸到哪都能考好(质量因子保底)；投机者一次押对也能高分(但下次呢？)。',
    goodWhen: '经济下行或市场恐慌——"好公司在危机中不会死"的信念支撑质量因子。',
    badWhen: '牛市狂潮——"鸡犬升天"时，好公司和差公司都在涨，多付的"质量溢价"显得白花了。',
  },

  RMW: {
    factorId: 'RMW',
    nameCN: '盈利能力',
    category: 'quality',
    oneLineDescriptionCN: '赚钱能力强的公司跑赢赚钱能力弱的——这听起来像是废话，但确实有效',
    humanStoryCN:
      '把公司按"赚到的钱÷总资产"排序，高的减低的——这个差距就是盈利能力溢价。就像两个同样1亿资产的公司，一个每年赚2000万，一个赚200万，长期来看前者股价一定更好。',
    goodNews: 'RMW溢价高，说明市场在"论功行赏"——真正赚钱的公司被资金认可。',
    badNews: 'RMW溢价收缩或为负，说明市场不关心盈利质量——可能是在追逐概念和故事。',
    metaphor: '💰 两个便利店：一个日流水2万，一个2千——不用想都知道该买第一个的股票。',
    goodWhen: '财报季——当大家关注"数字"时，盈利好的公司涨得最稳。',
    badWhen: '概念炒作期——"ChatGPT概念"不需要盈利，只需要想象力。',
  },

  CMA: {
    factorId: 'CMA',
    nameCN: '投资风格(保守vs激进)',
    category: 'quality',
    oneLineDescriptionCN: '不乱花钱的公司跑赢乱投资的公司——管理层纪律很重要',
    humanStoryCN:
      '总资产增长慢的公司（保守派）长期回报高于总资产快速增长的公司（激进派）。激进扩张往往意味着"用股东的钱打水漂"，而保守经营的公司知道"钱要花在刀刃上"。',
    goodNews: 'CMA溢价为正，说明市场在惩罚乱花钱的公司——纪律比规模重要。',
    badNews: 'CMA溢价为负，说明市场在奖励"胆子大"——烧钱换增长的模式被追捧。',
    metaphor: '🏦 两个老板：一个把利润再投资建厂房(保守)，一个拿去收购20家公司(激进)——前者的股票往往更稳。',
    goodWhen: '经济不确定期——乱投资的恶果会在下行期集中爆发。',
    badWhen: '流动性泛滥——钱太好借，激进扩张暂时看不到恶果。',
  },

  ROE_Quality: {
    factorId: 'ROE_Quality',
    nameCN: 'ROE质量',
    category: 'quality',
    oneLineDescriptionCN: '不是所有ROE都一样——真金白银的ROE vs 借来的ROE',
    humanStoryCN:
      '两家公司ROE都是20%。A公司靠产品竞争力(真)；B公司靠疯狂借钱加杠杆(假)。市场好的时候分不出来，市场差的时候B会"爆"。ROE质量因子就是把B类公司筛掉。',
    goodNews: '高质量ROE公司持续跑赢，说明"真功夫"被市场认可。',
    badNews: '高质量ROE溢价缩小，意味市场不区分"真赚钱"和"借来的繁荣"——风险在积累。',
    metaphor: '🪜 两个人站在高处：A靠自己跳上去的，B站在梯子上——风一来B就摔了。',
    goodWhen: '信贷收紧或市场恐慌——"杠杆包装的ROE"首先崩塌。',
    badWhen: '降息放水期——谁都借得到钱，杠杆不是问题。',
  },

  STABILITY: {
    factorId: 'STABILITY',
    nameCN: '盈利稳定性',
    category: 'quality',
    oneLineDescriptionCN: '每年赚得"差不多"的公司 > 一年爆赚一年亏损的公司',
    humanStoryCN:
      '收益波动小的公司长期回报更高，因为市场不喜欢"惊喜"（尤其是负面的）。想象两个员工：一个每个月稳定拿1万，一个这个月2万下个月0——老板更放心把重要任务给第一个。',
    goodNews: '盈利稳定性因子溢价——市场在"要确定性"而非"赌惊喜"。',
    badNews: '盈利稳定公司被冷落——市场在追逐"可能翻倍"的股票，不在乎稳定。',
    metaphor: '📊 心电图：优美的正弦波(稳定盈利) vs 乱跳的杂波(盈利忽高忽低)——医生只看前者说"健康"。',
    goodWhen: '市场波动加大时——稳定成为稀缺品。',
    badWhen: '大牛市——"谁在乎你稳不稳，能涨就行"。',
  },

  // ═══ 波动/风险因子 (5) ══════════════════════════════════

  VOL_60D: {
    factorId: 'VOL_60D',
    nameCN: '低波动',
    category: 'volatility',
    oneLineDescriptionCN: '波动小的股票长期回报反而更高——少折腾、多赚',
    humanStoryCN:
      '60日价格波动率低的股票，历史长期回报高于高波动股。这听起来反常理（波动大不应该补偿多吗？），但事实是：低波动股票就像开车稳的老司机，虽然不飙车，但到达目的地的概率更高。',
    goodNews: '低波动溢价明显——"稳"正在被市场奖励，说明市场情绪偏谨慎。',
    badNews: '低波动因子跑输——市场在"追涨杀跌"模式，波动越大越赚钱，稳反而是错。',
    metaphor: '🚗 老司机vs飙车党：飙车的偶尔先到，但翻车概率大得多。老司机每次都到，综合下来先到次数更多。',
    goodWhen: '市场恐慌或下行期——"我不想赚大钱，只想少亏钱"的心态推高低波动因子。',
    badWhen: '牛市高潮——"越刺激越赚钱"，低波动被嘲笑为"养老策略"。',
  },

  BETA: {
    factorId: 'BETA',
    nameCN: '贝塔(市场敏感度)',
    category: 'volatility',
    oneLineDescriptionCN: '大盘涨1%，这只涨多少？——你的股票跟大盘有多紧',
    humanStoryCN:
      'Beta=1就是和大盘同涨同跌；Beta=1.5就是大盘涨1%它涨1.5%（但跌也一样放大）；Beta=0.5就是大盘涨1%它只涨0.5%（跌也减半）。选Beta就是选"你愿意跟大盘绑多紧"。',
    goodNews: '你的策略Beta正好匹配你的风险偏好——市场涨了你享受，跌了你受得了。',
    badNews: '策略Beta超出你的预期——市场涨的时候开心，跌的时候才发现自己绑了枚炸弹。',
    metaphor: '🎢 过山车(Beta高) vs 旋转木马(Beta低)：想刺激坐过山车，想安全坐木马——别坐了过山车才喊晕。',
    goodWhen: '牛市——高Beta放大收益；熊市——低Beta减少损失。',
    badWhen: '你用错了Beta——牛市中用低Beta=少赚，熊市中用高Beta=多亏。',
  },

  ATR_14: {
    factorId: 'ATR_14',
    nameCN: '平均真实波幅',
    category: 'volatility',
    oneLineDescriptionCN: '股票最近14天的"震幅"有多大——越大=越刺激=止损要设得越宽',
    humanStoryCN:
      'ATR告诉你"这只股票正常一天能波动多少"。ATR=2元的股票，一天涨跌2元是家常便饭；ATR=0.5元的股票，一天波动超过5毛就算异常。止损位要根据ATR来设，否则被"正常波动"震出去。',
    goodNews: 'ATR适中——波动可控，止损好设，持仓体验好。',
    badNews: 'ATR突然放大——说明出现了预期外的事件，原有的止损位可能不够宽。',
    metaphor: '📏 跳跳床：振幅小的床(低ATR)躺着舒服；振幅大的床(高ATR)能跳很高但容易摔。',
    goodWhen: '止损位设置——ATR是天然的止损宽度参考。',
    badWhen: '只用ATR挑股票——高ATR不等于差(可能是机会)，低ATR不等于好(可能是死股)。',
  },

  MAX_DRAWDOWN: {
    factorId: 'MAX_DRAWDOWN',
    nameCN: '最大回撤',
    category: 'volatility',
    oneLineDescriptionCN: '从最高点掉下来最惨的一次跌了多少——衡量"最坏情况"',
    humanStoryCN:
      '最大回撤是你的策略从"最得意"到"最绝望"跌了多少。50%最大回撤意味着：即使策略最后赚钱了，中间你可能已经亏到怀疑人生了。最大回撤是考验"你能不能坚持到策略生效"的指标。',
    goodNews: '最大回撤远低于同类策略——你的风险管理做得不错。',
    badNews: '最大回撤超预期——即使最终盈利，中间的大跌足以让大多数人提前离场。',
    metaphor: '🕳️ 走路掉坑里：策略的"坑"有多深？10%的坑爬起来拍拍土继续走；50%的坑可能要叫救护车了。',
    goodWhen: '评估策略可行性——如果最大回撤让你睡不着，策略再好也执行不下去。',
    badWhen: '只看最大回撤不看收益——回撤5%年化3%的策略，不如回撤15%年化20%的。',
  },

  FX_EXPOSURE: {
    factorId: 'FX_EXPOSURE',
    nameCN: '汇率暴露',
    category: 'volatility',
    oneLineDescriptionCN: '你的海外资产赚/亏了多少汇率钱——这个跟你选的股票无关',
    humanStoryCN:
      '买美股赚了10%，但美元贬值了5%——实际到手只剩5%。汇率暴露就是你投资中"不受你控制、但会影响你收益"的部分。对于跨境投资者，这个因子有时候比选股更重要。',
    goodNews: '汇率对你有利——等于白捡一个加成buff。',
    badNews: '汇率在吃掉你的投资回报——你选股再好也扛不住货币贬值。',
    metaphor: '💱 去国外旅游：买了便宜货(赚钱了)，但换汇手续费吃掉一半利润——汇率就是那个手续费。',
    goodWhen: '有明确的汇率观点——如果你判断美元会走强，就应该增加美元资产。',
    badWhen: '你完全忽略它——到头来"赚了价差、赔了汇差"。',
  },

  // ═══ 规模/流动性因子 (4) ════════════════════════════════

  SIZE: {
    factorId: 'SIZE',
    nameCN: '规模因子(小盘效应)',
    category: 'size',
    oneLineDescriptionCN: '小公司长期跑赢大公司——因为"船小好调头"也有"容易翻"',
    humanStoryCN:
      '历史数据表明小市值公司长期回报高于大市值。就像创业公司vs国企——前者可能翻100倍也可能倒闭，后者稳但难有大惊喜。规模因子就是赌"这个世界会奖励更多的小公司成长为大公司"。',
    goodNews: '小盘溢价明显——"小而美"正被市场发现。',
    badNews: '小盘跑输大盘——可能预示经济下行(小公司抗风险能力弱)、或流动性紧缩(小股票没人交易)。',
    metaphor: '🚤 快艇vs航母：快艇灵活跑得快(小盘)，但暴风雨来了容易被掀翻；航母慢但稳(大盘)。',
    goodWhen: '经济复苏初期——小公司弹性大，复苏时最先反弹。',
    badWhen: '经济衰退——小公司融资困难，倒闭风险大增。',
  },

  LIQ: {
    factorId: 'LIQ',
    nameCN: '流动性因子',
    category: 'liquidity',
    oneLineDescriptionCN: '买得进来、卖得出去——冷门股票虽有补偿但未必值得',
    humanStoryCN:
      '流动性差的股票交易成本高（买卖价差大）、进出困难。历史数据显示，流动性差的股票有"流动性溢价"——因为没人要，所以便宜。但这种便宜是有代价的：你想卖的时候可能卖不出去。',
    goodNews: '流动性溢价存在——你承担了"卖不掉"的风险，所以得到了更高的潜在回报。',
    badNews: '流动性正在恶化——"卖不掉"从理论风险变成了现实问题。',
    metaphor: '🏪 便利店vs批发市场：便利店随时能卖但利润薄(高流动性低溢价)，批发市场利润高但一次要卖一车(低流动性高溢价)。',
    goodWhen: '小资金+长期持有——流动性差一点没关系，反正不急着卖。',
    badWhen: '大资金或短期交易——流动性差会让你"进得去出不来"。',
  },

  ADX: {
    factorId: 'ADX',
    nameCN: '趋势强度(ADX)',
    category: 'momentum',
    oneLineDescriptionCN: '趋势有没有"力道"——不是方向，是力度',
    humanStoryCN:
      'ADX不告诉你趋势是涨还是跌，只告诉你"趋势有多强"。ADX>25说明趋势有力度，ADX<20说明行情在"摸鱼"——乱晃没方向。',
    goodNews: 'ADX上升——趋势在加速，顺势而为的策略成功率上升。',
    badNews: 'ADX下降——趋势在减弱，之前有效的策略可能开始失效，波动增加。',
    metaphor: '💪 举重：不是看杠铃往哪个方向举(涨跌)，而是看举的人力气有多大(趋势强度)。力竭了就掉下来。',
    goodWhen: '趋势策略——只在ADX>25时才入场，避免在"摸鱼"行情中反复止损。',
    badWhen: '震荡策略——ADX高说明趋势强，震荡策略的"高抛低吸"会被趋势方向碾压。',
  },

  TURNOVER: {
    factorId: 'TURNOVER',
    nameCN: '换手率',
    category: 'liquidity',
    oneLineDescriptionCN: '市场上这只股票在"倒手"多快——太高=热度，也可能是"击鼓传花"',
    humanStoryCN:
      '换手率=某段时间有多少股票被交易了。高换手说明"关注度高、筹码在流动"——可能是好事(被大量买入)，也可能是坏事(被大量卖出)。低换手说明"冷清"——可能是价值被低估无人问津，也可能真的是垃圾。',
    goodNews: '换手率异常放大伴随价格上涨——"放量上攻"，说明有资金在推动。',
    badNews: '换手率异常放大伴随价格下跌——"放量下跌"，说明有人在不计成本地出逃。',
    metaphor: '🔄 击鼓传花：花传得越快(高换手)，鼓声随时会停——你不想当最后一棒。',
    goodWhen: '确认趋势——量价配合(涨+放量=真涨, 跌+缩量=假跌)。',
    badWhen: '独自使用——高换手可能是主力出货，低换手可能是僵尸股。',
  },

  // ═══ 情绪/资金流因子 (5) ════════════════════════════════

  OBV: {
    factorId: 'OBV',
    nameCN: '能量潮(OBV)',
    category: 'sentiment',
    oneLineDescriptionCN: '涨的时候买的人多不多——"量在价先"，钱先动、股价后动',
    humanStoryCN:
      'OBV是"聪明钱"的追踪器：涨的日子成交量大=聪明钱在买，跌的日子成交量大=聪明钱在卖。如果股价创新高但OBV没跟上——这叫"量价背离"，可能是个假突破。',
    goodNews: 'OBV与股价同步上行——"量价齐升"，上涨有真金白银支撑。',
    badNews: '股价涨但OBV跌——"量价背离"，可能是拉高出货，后面大概率回调。',
    metaphor: '🌊 海浪：浪花(股价)可能乱溅，但暗流(成交量)才是真正推动水面的力量——看暗流，别看浪花。',
    goodWhen: '确认突破——股价突破阻力位+OBV同步新高=真突破。',
    badWhen: '低流动性股票——少量资金就能画出一个假的OBV形态。',
  },

  CMF: {
    factorId: 'CMF',
    nameCN: '蔡金资金流',
    category: 'sentiment',
    oneLineDescriptionCN: '钱在流入还是流出——收盘价在高位=钱进来了，收盘价在低位=钱跑了',
    humanStoryCN:
      '蔡金资金流看的是"当日收盘价在最高最低之间的位置"乘以成交量。如果连续多日收盘在当日高点附近且放量=钱在涌入；反之=钱在撤出。',
    goodNews: 'CMF持续为正且上升——资金在持续流入，"买气"充足。',
    badNews: 'CMF为负或从正转负——资金正在撤退，即使股价还没跌也要警惕。',
    metaphor: '🏊 游泳池：看水是涌入还是流出——CMF就是"进水管减出水管"的净流量。',
    goodWhen: '中期趋势判断——CMF比单日成交量更能反映"资金态度"。',
    badWhen: '极端高波动——一天之内价格上下扫荡，收盘位置不能代表全天资金流向。',
  },

  US_INST_HOLD: {
    factorId: 'US_INST_HOLD',
    nameCN: '机构持仓变化',
    category: 'sentiment',
    oneLineDescriptionCN: '聪明钱在加仓还是减仓——跟着机构走不一定对，但逆着走更危险',
    humanStoryCN:
      '机构（基金/养老金/保险）的持仓变化比散户更"有研究基础"。当多数机构在加仓，说明专业投资者看好；当多数机构在减仓，说明专业投资者在撤退。但注意：机构也可能集体犯错。',
    goodNews: '机构持仓增加——专业投资者在用真金白银投票"看好"。',
    badNews: '机构持仓减少——可能他们知道了你还没知道的事情。',
    metaphor: '🐘 大象(机构)在丛林中移动：跟在后面相对安全，但记得大象也会踩错路。',
    goodWhen: '中长线投资——机构持仓变化通常在季度级别才有意义。',
    badWhen: '短线交易——机构调仓延迟数月才披露，你看到时黄花菜都凉了。',
  },

  US_SHORT_RATIO: {
    factorId: 'US_SHORT_RATIO',
    nameCN: '空头持仓比率',
    category: 'sentiment',
    oneLineDescriptionCN: '市场上有多少人在赌这只股票下跌——极端高=可能轧空暴涨',
    humanStoryCN:
      '空头比率高说明"很多人看空这只股票"。但这是一个双刃剑：如果空头是对的，股价会跌；如果空头错了，他们会被迫"买回来平仓"→反而推高股价（轧空）。',
    goodNews: '空头比率极高(>20%)——如果有利好消息，可能出现"轧空"暴涨（做空的人踩踏式买入）。',
    badNews: '空头比率持续上升——专业的做空机构可能看到了基本面的致命问题。',
    metaphor: '⚔️ 弹簧：压得越紧（空头越多），一旦松手弹得越高（轧空）。但也要确认弹簧不会断（公司不会破产）。',
    goodWhen: '寻找"反向机会"——极度看空但公司基本面不差=可能轧空。',
    badWhen: '公司确实有问题——空头聚集是有原因的，别跟在秃鹫后面捡骨头。',
  },

  US_BUYBACK: {
    factorId: 'US_BUYBACK',
    nameCN: '回购收益率',
    category: 'sentiment',
    oneLineDescriptionCN: '公司用自己的钱买自己的股票——管理层在说"我们被低估了"',
    humanStoryCN:
      '公司回购股票=减少市场上流通的股票数量=每股盈利自动增加。就像切蛋糕——蛋糕大小不变，但分的人少了，每人分到的就多了。回购是最直接的"公司认为股价太低"的信号。',
    goodNews: '回购加速——管理层在巨额回购，说明他们真觉得自己的股票便宜。',
    badNews: '回购减少或发新股稀释——可能是公司缺钱，也可能是在高位减持。',
    metaphor: '🍕 切披萨：8个人分(100%流通)每人1/8；回购后只有6个人分=每人1/6——你什么都没干，份额变大了。',
    goodWhen: '股价低迷+公司现金充足——这是"真心回购"而非"装模作样"。',
    badWhen: '高位回购——可能不是在"捡便宜"，而是帮内部人士出货。',
  },

  // ═══ 宏观因子 (4) ════════════════════════════════════════

  US_VIX: {
    factorId: 'US_VIX',
    nameCN: '恐慌指数(VIX)',
    category: 'macro',
    oneLineDescriptionCN: '市场的"恐惧温度计"——越高=越害怕=越可能触底',
    humanStoryCN:
      'VIX衡量市场对未来30天波动的预期。VIX<15=天下太平；15-25=有点紧张；25-35=明显恐慌；>35=极度恐惧。数据显示，VIX极高时买入通常有好回报——但这个操作需要钢铁般的心态。',
    goodNews: 'VIX从高位回落——恐慌退潮，风险偏好回升，风险资产迎来反弹。',
    badNews: 'VIX快速攀升——市场在"逃命模式"，这种时候什么都可能跌。',
    metaphor: '🌡️ 市场体温：正常=37°C，发烧=40°C——有时高烧之后免疫力反而更强(反弹)，但高烧本身很危险。',
    goodWhen: '逆向投资——"在别人恐惧时贪婪"的前提是你有足够的子弹和耐心。',
    badWhen: '实际危机——如果恐慌是"真的糟了"而非"暂时怕了"，抄底会抄在半山腰。',
  },

  SECTOR_ROTATION: {
    factorId: 'SECTOR_ROTATION',
    nameCN: '行业轮动',
    category: 'macro',
    oneLineDescriptionCN: '每个经济阶段"该涨"的行业不同——在正确的季节种正确的庄稼',
    humanStoryCN:
      '经济有其周期：复苏→过热→滞胀→衰退。每个阶段受益的行业不同——复苏时买科技和消费，滞胀时买能源和材料，衰退时买公用事业和医疗。选对了季节选对了种子，收成差不了。',
    goodNews: '行业轮动信号清晰——当前经济阶段与历史规律匹配，按"剧本"配置胜率更高。',
    badNews: '行业轮动紊乱——宏观信号混乱，没有一个行业板块显示出明确的"应有表现"。',
    metaphor: '🌾 四季农时：春天种什么、秋天收什么——硬要在冬天种西瓜，神仙也救不了。',
    goodWhen: '宏观周期清晰——利率、GDP、通胀方向一致时，行业轮动最可靠。',
    badWhen: '政策强力干预——"看不见的手"被"看得见的政策"打乱了，历史规律暂时失效。',
  },

  YIELD: {
    factorId: 'YIELD',
    nameCN: '利率敏感度',
    category: 'macro',
    oneLineDescriptionCN: '利率涨这只跌多少——利率是金融万物的"地心引力"',
    humanStoryCN:
      '利率敏感度告诉你"加息对这只股票/策略有多大影响"。高利率敏感意味着：只要央行传出加息风声，你的组合就绿了。债券+公用事业+高杠杆公司=利率敏感度高。',
    goodNews: '利率下降——你持有的高利率敏感性资产要"起飞"了。',
    badNews: '利率上升——高利率敏感性资产首当其冲，降久期是保命动作。',
    metaphor: '🎈 气球和铁球：低利率=空气轻，气球(成长股)飞得高；加息=空气变重，气球全掉下来。',
    goodWhen: '有明确的利率观点——你觉得利率会降→加配利率敏感资产。',
    badWhen: '利率走势不明——那就保持中性久期，别赌方向。',
  },

  OPTION_PCR: {
    factorId: 'OPTION_PCR',
    nameCN: '看跌/看涨比率',
    category: 'macro',
    oneLineDescriptionCN: '市场上买保险的人多还是买彩票的人多——极端值往往是反向信号',
    humanStoryCN:
      'Put(看跌/保险)÷Call(看涨/彩票)的比例。PCR>1=买保险的人多于买彩票的(恐慌)；PCR<0.5=买彩票的远多于买保险的(贪婪)。极端值往往是反向指标——"人人都买保险时，灾难可能已经过去了"。',
    goodNews: 'PCR极高——市场极端恐慌，历史上的买入机会往往出现在这个时刻。',
    badNews: 'PCR极低——市场极端自满，"什么都不会错"的心态往往是暴风雨前的宁静。',
    metaphor: '🎰 赌场：大家都在买"跌"的时候(高PCR)，通常离底不远了；大家都在买"涨"的时候(低PCR)，小心庄家要收网。',
    goodWhen: '市场情绪极端——PCR是"别人恐惧我贪婪"的量化版本。',
    badWhen: '结构性变化——如果市场永久性地更"恐跌"了，PCR的"正常值"也会改变。',
  },

  // ═══ 加密因子 (10) ══════════════════════════════════════

  CRYPTO_FUNDING: {
    factorId: 'CRYPTO_FUNDING',
    nameCN: '资金费率',
    category: 'crypto',
    oneLineDescriptionCN: '做多的人付钱给做空的人还是反过来——费率极端=趋势可能反转',
    humanStoryCN:
      '永续合约每8小时结算一次的资金费率，反映了多空双方的力量对比。正费率=多头人多→多头要付钱给空头——这是"从众的代价"。费率极高时(>0.1%)，做空不仅可以赚价差，还能额外收到资金费。',
    goodNews: '资金费率从极值回归中性——说明多空力量正在平衡，趋势更健康。',
    badNews: '资金费率持续极高——"多头拥挤"，一旦踩踏就是连环爆仓。',
    metaphor: '🏋️ 跷跷板：多头太沉(正费率高)→收费让多头变轻→跷跷板回平衡→或者突然全部跳下去(崩盘)。',
    goodWhen: '趋势健康时——费率在0.01%-0.03%之间表明趋势可持续。',
    badWhen: '费率>0.1%——拥挤的多头随时可能变成"跑得快"游戏。',
  },

  CRYPTO_OI_DELTA: {
    factorId: 'CRYPTO_OI_DELTA',
    nameCN: '持仓量变化',
    category: 'crypto',
    oneLineDescriptionCN: '钱是进来了还是出去了——OI+价格=4种组合，只有1种是真的涨',
    humanStoryCN:
      '持仓量(Open Interest)变化+价格变化=4种情形：OI↑价↑=真涨(钱在入场)；OI↓价↑=假涨(空头平仓推高的，不可持续)；OI↑价↓=真跌(钱在入场做空)；OI↓价↓=假跌(多头平仓砸的，可能反弹)。',
    goodNews: 'OI与价格同步上升——"真正的牛市"，有增量资金在源源不断进来。',
    badNews: '价格涨但OI在跌——"伪牛市"，只是空头平仓在推动，没有新钱入场，随时可能崩。',
    metaphor: '🔍 看戏还要看后面的工作人员(持仓量)，不能光看台上演员(价格)——后台没人了，戏就快散场了。',
    goodWhen: '确认趋势——OI+价格同向=真的趋势，背离=假的趋势。',
    badWhen: '独立使用——OI需要结合价格方向解读，单独一个OI数字没有意义。',
  },

  CRYPTO_EXCHANGE_FLOW: {
    factorId: 'CRYPTO_EXCHANGE_FLOW',
    nameCN: '交易所净流量',
    category: 'crypto',
    oneLineDescriptionCN: '币在流入交易所还是流出——流入=准备卖，流出=准备拿住',
    humanStoryCN:
      '追踪链上数据：币从钱包转入交易所=可能准备卖出(利空)；币从交易所提走转入冷钱包=持有人想长期持有(利多)。就像超市的仓库监控——大量货搬到货架上是准备打折卖，搬到仓库深处是囤货。',
    goodNews: '大量净流出——"聪明钱"在提币到冷钱包囤货，供应减少=价格有上升压力。',
    badNews: '大量净流入——有人在把币往交易所搬，准备好卖了，供应增加=抛压到来。',
    metaphor: '🏪 超市仓库：商品从仓库搬到货架(流入交易所)=要打折卖了；从货架搬回仓库(流出)=老板不急着卖。',
    goodWhen: '检测大额异动——单笔>1000BTC的流入/流出=重要信号。',
    badWhen: '交易所内部转账——平台自己挪钱包也会产生"流入流出"，这些是噪音。',
  },

  CRYPTO_ORDERBOOK_IMB: {
    factorId: 'CRYPTO_ORDERBOOK_IMB',
    nameCN: '订单簿不平衡',
    category: 'crypto',
    oneLineDescriptionCN: '买盘和卖盘谁更"厚"——厚的一方更可能主导下一个价格方向',
    humanStoryCN:
      '订单簿不平衡=买盘总量÷卖盘总量。>1说明买家多于卖家(潜在上涨压力)，<1说明卖家多于买家(潜在下跌压力)。但注意：大单可能是"幽灵单"——挂出来吸引人但随时会撤。',
    goodNews: '买盘持续厚于卖盘——"接盘力量"在积累，价格下跌时有人在底下兜着。',
    badNews: '卖盘突然堆厚——可能有大户在"铺货"准备砸盘。',
    metaphor: '🛒 排队：买东西的队伍(买盘)比卖东西的(卖盘)长一倍，老板当然要涨价——谁急谁吃亏。',
    goodWhen: '短期方向判断——订单簿不平衡是"下一秒"的指向标。',
    badWhen: '骗线——有些挂单不是为了成交，是为了制造假象引诱你下单。',
  },

  CRYPTO_VOL_RATIO: {
    factorId: 'CRYPTO_VOL_RATIO',
    nameCN: '波动率比值',
    category: 'crypto',
    oneLineDescriptionCN: '现在的波动跟历史比是高是低——低波动后往往跟着大波动',
    humanStoryCN:
      '当前波动率÷历史波动率。>1=比历史平均更"刺激"，<1=比历史平均更"平静"。加密市场有个规律：长期低波动之后往往会爆发大幅波动。就像弹簧，压缩得越久，弹起来越猛。',
    goodNews: '波动率比值回到正常范围——市场在"恢复理智"，策略信号更可靠。',
    badNews: '波动率比值持续低于0.5——"暴风雨前的宁静"，大幅波动随时可能来袭，要做好风控。',
    metaphor: '🎪 马戏团：长时间安静=要放大招了；一直很吵=正常表演中。加密市场在安静时最危险。',
    goodWhen: '波动回归策略——当前波动远低于历史=可能即将有大行情，期权双买策略也好用。',
    badWhen: '市场结构永久变化——如果市场真的变"温顺"了，历史波动率就是错的参考基准。',
  },

  CRYPTO_VOLUME_PROFILE: {
    factorId: 'CRYPTO_VOLUME_PROFILE',
    nameCN: '成交量分布POC',
    category: 'crypto',
    oneLineDescriptionCN: '哪个价格上交易最多——这个价格是"共识"，突破它=趋势来了',
    humanStoryCN:
      '成交量分布的最密集位置(Point of Control)就是"市场最认可的价格"。POC以上=多数人盈利→有支撑；POC以下=多数人亏损→有阻力。价格一旦突破POC，就是新的趋势方向。',
    goodNews: '价格在POC以上运行——大多数持仓者是盈利的，市场情绪偏乐观。',
    badNews: '价格跌破POC——大多数持仓者变为亏损，恐慌性抛售风险增加。',
    metaphor: '⚓ 船锚：POC就是市场的锚——锚在上面船在上面的区域活动；锚一旦被拉起来，船就不知道漂去哪了。',
    goodWhen: '判断支撑阻力——POC是比传统技术分析更"客观"的支撑阻力位。',
    badWhen: '重大新闻——突发事件会瞬间打破POC结构，此前的共识失效。',
  },

  CRYPTO_BTC_CORR: {
    factorId: 'CRYPTO_BTC_CORR',
    nameCN: 'BTC相关性',
    category: 'crypto',
    oneLineDescriptionCN: '你的山寨币跟BTC走得有多紧——BTC跌时谁也跑不了',
    humanStoryCN:
      '大多数加密资产跟BTC高度相关。BTC涨=大家狂欢，BTC跌=全军覆没。BTC相关性高的山寨币=你其实在买"3倍杠杆的BTC"；BTC相关性低的=你至少在"分散化"上做了努力。',
    goodNews: 'BTC相关性下降——你的策略或选币真正与BTC脱钩，达到了分散化目的。',
    badNews: 'BTC相关性接近1——你买的每一种币都在"同一艘船上"——BTC沉了你也沉。',
    metaphor: '🚢 泰坦尼克号：BTC是船，山寨币是船上的人——船沉了，不分头等舱三等舱。',
    goodWhen: 'BTC横盘——低BTC相关性的币有机会走独立行情。',
    badWhen: 'BTC暴跌——相关性会瞬间飙升到0.9+，所谓的"独立行情"瞬间蒸发。',
  },

  CRYPTO_NVT: {
    factorId: 'CRYPTO_NVT',
    nameCN: 'NVT比率',
    category: 'crypto',
    oneLineDescriptionCN: '网络的"市盈率"——市值÷链上交易量，太高=泡沫',
    humanStoryCN:
      'NVT就是加密版的PE（市盈率）：市值÷日链上交易额。NVT高=市值高于网络实际使用量（可能高估）。NVT低=市值低于网络使用价值（可能低估）。就像一家餐厅，排队的人很多但股价没涨——可能是低估了。',
    goodNews: 'NVT在低位——网络使用量支撑着当前市值，没有泡沫。',
    badNews: 'NVT极高——市值跟网络实际使用完全脱节，这是典型的"炒作溢价"。',
    metaphor: '🏪 餐厅估值：市值=股价，链上交易=排队人数。排队的人多了股价没涨=低估；没人排队股价翻倍=泡沫。',
    goodWhen: '长期估值判断——NVT不会告诉你明天涨跌，但会告诉你一年后来看现在是否太贵。',
    badWhen: '链上交易量失真——有些链上"刷量"交易会虚增使用量，拉低NVT造成低估假象。',
  },

  CRYPTO_ACTIVE_ADDR: {
    factorId: 'CRYPTO_ACTIVE_ADDR',
    nameCN: '活跃地址数',
    category: 'crypto',
    oneLineDescriptionCN: '每天有多少人在用这个网络——用户数增长=价值增长的基础',
    humanStoryCN:
      '日活跃地址数是加密网络的"日活用户(DAU)"——最基础也最重要的健康指标。活跃地址持续增长=越来越多的人在真正使用这个网络；活跃地址下降=用户在流失，熊市可能还没结束。',
    goodNews: '活跃地址持续创新高——网络在有机增长，这是牛市的"燃料"。',
    badNews: '活跃地址持续下滑——"用户都跑了"，价格再涨也可能是拉高出货。',
    metaphor: '📱 App日活：活跃地址越多=用这个App的人越多=App越值钱。一个没人用的App值100亿？泡沫。',
    goodWhen: '判断项目长期价值——真正被使用的网络才会存活下来。',
    badWhen: '短期交易——活跃地址是"慢变量"，不适合用来择时。',
  },

  CRYPTO_LIQUIDATIONS: {
    factorId: 'CRYPTO_LIQUIDATIONS',
    nameCN: '爆仓热度',
    category: 'crypto',
    oneLineDescriptionCN: '多少人被强制平仓了——大规模爆仓后往往是方向反转',
    humanStoryCN:
      '当大量杠杆仓位被强制平仓时，会产生一种"踩踏效应"——爆仓的人被迫卖出（无论方向），进一步推动了价格，引发更多人爆仓……直到杠杆被出清干净。此时往往是趋势反转的起点。',
    goodNews: '大规模爆仓后——"杠杆已经清洗干净"，反而健康了，可以入场了。',
    badNews: '爆仓数据突然飙升——你如果也带了杠杆，下一个爆的可能就是你。',
    metaphor: '🎳 多米诺骨牌：一块倒→全倒。但全部倒完后，你可以从容地重新摆牌了(抄底)。',
    goodWhen: '检测杠杆出清——爆仓量达到近期极值后往往出现趋势反转。',
    badWhen: '试图接飞刀——爆仓过程中价格会跌到你想象不到的位置。',
  },

  // ═══ 港股特有因子 (4) ════════════════════════════════════

  HKEX_SOUTHBOUND: {
    factorId: 'HKEX_SOUTHBOUND',
    nameCN: '南向资金',
    category: 'sentiment',
    oneLineDescriptionCN: '内地资金在买还是在卖港股——"国家队"的风向标',
    humanStoryCN:
      '通过港股通从内地流向香港的资金。南向资金持续净流入=内地看好港股，净流出=内地撤资。南向资金体量巨大（日均几十亿），是港股最重要的增量资金来源之一。',
    goodNews: '南向资金连续多日净流入——"内资在抄底"，港股可能迎来资金驱动的反弹。',
    badNews: '南向资金大幅流出——不仅是外资在卖，连"自己人"也不看好了。',
    metaphor: '💰 水管：南向资金就是从内地接过来的一根"水管"——水龙头开着=港股有活水；水龙头关了=港股干涸。',
    goodWhen: '方向判断——南向资金是港股量价关系中最可靠的领先指标之一。',
    badWhen: '单纯跟单——南向资金有时候也是"追涨杀跌"的，不是每次都对。',
  },

  HKEX_WARRANT_IV: {
    factorId: 'HKEX_WARRANT_IV',
    nameCN: '窝轮隐含波动率',
    category: 'sentiment',
    oneLineDescriptionCN: '市场认为未来会有多大波动——香港版的"VIX"',
    humanStoryCN:
      '窝轮（权证）的隐含波动率反映了香港市场对未来波动的预期。IV上升=市场认为要"来事"了，IV下降=市场觉得风平浪静。极端IV值往往出现在恐慌或狂热之时。',
    goodNews: 'IV从高位回落——恐慌情绪消散，市场恢复理性。',
    badNews: 'IV加速飙升——市场在"惊慌失措"，这个时候不要接飞刀。',
    metaphor: '🎢 排队长度：IV高=排队的人焦虑(觉得要出大事)；IV低=排队的很淡定(觉得没啥大不了的)。',
    goodWhen: '判断市场情绪——IV是"恐惧指数"的香港版本。',
    badWhen: '结构性变化——如果有重大制度变化，IV的"正常值"可能永久性改变。',
  },

  HKEX_FUND_HOLD: {
    factorId: 'HKEX_FUND_HOLD',
    nameCN: '基金持仓',
    category: 'sentiment',
    oneLineDescriptionCN: '基金在香港买了什么——"大钱"的方向就是安全感的方向',
    humanStoryCN:
      '追踪香港注册基金和ETF的持仓变化。当多数基金同时增持某个板块时，会形成"自我实现的预言"——更多买入推高价格，吸引更多资金，价格更高……',
    goodNews: '基金持仓集中度上升——"聪明钱"正在形成共识，这个方向值得关注。',
    badNews: '基金持仓过度集中——"拥挤交易"一旦反转，杀伤力巨大。',
    metaphor: '🐑 羊群：领头羊(头部基金)往哪走，其他羊(散户+小基金)跟着走——但悬崖到了谁都会跳。',
    goodWhen: '趋势跟踪——基金持仓变化是滞后指标，但在趋势市中"滞后"反而意味着"跟随趋势"。',
    badWhen: '市场顶部——基金持仓达到历史极值时，通常意味着"该买的都买完了"。',
  },

  HKEX_CBCS_PREMIUM: {
    factorId: 'HKEX_CBCS_PREMIUM',
    nameCN: '牛熊证溢价',
    category: 'sentiment',
    oneLineDescriptionCN: '牛证太贵还是熊证太贵——市场情绪的"定价"',
    humanStoryCN:
      '牛熊证是港股特色的杠杆工具。牛证溢价=看涨的赌注贵了，说明"看涨的太多了"；熊证溢价=看跌的赌注贵了，说明"看跌的太多了"。极端溢价往往是反向指标。',
    goodNews: '牛证溢价从极值回归——过度看涨的情绪正在消化，更健康。',
    badNews: '牛证溢价持续飙升——"全民看涨"，这个时候市场非常脆弱。',
    metaphor: '⚖️ 天平：哪边沉(哪边溢价高)=哪边人多=哪边可能快要被"翻盘"了。',
    goodWhen: '判断市场情绪极端点——在港股，牛熊证溢价是散户情绪的精确测量仪。',
    badWhen: '单边趋势——趋势市中情绪可以持续极端很长时间，做反向操作等于"蚍蜉撼树"。',
  },
};

// ─── 15指标人话速判 ──────────────────────────────────────

/**
 * 指标的"一句话速判"——每个指标3种状态的人话翻译。
 * 与 src/lib/factor/humanize-metrics.ts 中的详细教育文案互补，
 * 这里提供更简洁的"绿/黄/红"三色速判文案。
 */
export interface MetricQuickJudge {
  metricId: string;
  metricNameCN: string;
  green: string;   // 好消息时的文案
  yellow: string;  // 注意时的文案
  red: string;     // 警告时的文案
}

export const METRIC_QUICK_JUDGE: Record<string, MetricQuickJudge> = {
  IC: {
    metricId: 'IC',
    metricNameCN: '信息系数',
    green: 'IC ≥ 0.03 → 因子预测能力 "靠谱"，信号值得参考 ✅',
    yellow: 'IC 0.01-0.03 → 因子预测能力 "勉强够用"，别全信 ⚠️',
    red: 'IC < 0.01 → 因子预测 "基本失效"，用了约等于扔硬币 🔴',
  },
  IR: {
    metricId: 'IR',
    metricNameCN: '信息比率',
    green: 'IR ≥ 0.5 → 因子稳定性 "相当不错"，不是靠运气赚钱 ✅',
    yellow: 'IR 0.3-0.5 → 因子稳定性 "一般般"，有时赚钱有时亏 ⚠️',
    red: 'IR < 0.3 → 因子收益 "随机漫步"，今天赚的明天可能吐回去 🔴',
  },
  SHARPE: {
    metricId: 'SHARPE',
    metricNameCN: '夏普比率',
    green: 'Sharpe ≥ 1.0 → 每承担1份风险赚1份以上回报，"挺会赚钱" ✅',
    yellow: 'Sharpe 0.5-1.0 → 赚的钱刚好cover风险，"打工仔水平" ⚠️',
    red: 'Sharpe < 0.5 → 冒的风险比赚的钱还多，"还不如存银行" 🔴',
  },
  MAX_DRAWDOWN: {
    metricId: 'MAX_DRAWDOWN',
    metricNameCN: '最大回撤',
    green: 'MaxDD < 15% → "跌得少睡得着"，心理压力可控 ✅',
    yellow: 'MaxDD 15-30% → 跌到肉疼但还扛得住，需要强心脏 ⚠️',
    red: 'MaxDD > 30% → "怀疑人生级别"的回撤，普通人很难坚持 🔴',
  },
  WIN_RATE: {
    metricId: 'WIN_RATE',
    metricNameCN: '胜率',
    green: '胜率 ≥ 55% → "大部分时候都赚钱"，心理感觉很好 ✅',
    yellow: '胜率 40-55% → 亏的天数和赚的天数差不多，做好心理准备 ⚠️',
    red: '胜率 < 40% → "经常亏但可能亏小赚大"——如果盈亏比够高也行 🔴',
  },
  ANNUAL_RETURN: {
    metricId: 'ANNUAL_RETURN',
    metricNameCN: '年化收益',
    green: '年化 ≥ 15% → 妥妥跑赢通胀和大多数理财产品 ✅',
    yellow: '年化 5-15% → 比银行好但不够惊艳，看跟谁比 ⚠️',
    red: '年化 < 5% → "辛辛苦苦一年不如存定期"，考虑换策略吧 🔴',
  },
  VOLATILITY: {
    metricId: 'VOLATILITY',
    metricNameCN: '波动率',
    green: '年化波动 < 20% → "稳稳的幸福"，不太惊心动魄 ✅',
    yellow: '年化波动 20-35% → 经常坐过山车，心脏不好的慎入 ⚠️',
    red: '年化波动 > 35% → "玩心跳"级别，一天盈亏顶一个月工资 🔴',
  },
  BETA: {
    metricId: 'BETA',
    metricNameCN: '贝塔',
    green: 'Beta 0.8-1.2 → 跟大盘差不多，不用担心"跑偏" ✅',
    yellow: 'Beta > 1.5 → 市场放大器——涨的时候爽，跌的时候更爽 ⚠️',
    red: 'Beta < 0.3 → 市场跟你没什么关系——可能是好事也是坏事 🔴',
  },
  ALPHA: {
    metricId: 'ALPHA',
    metricNameCN: '阿尔法',
    green: 'Alpha > 5% → 你在"靠能力赚钱"，不止是搭市场便车 ✅',
    yellow: 'Alpha 0-5% → 超额收益有但不多，可能只是运气好 ⚠️',
    red: 'Alpha < 0 → "选股选了个寂寞"，不如直接买指数基金 🔴',
  },
  R_SQUARED: {
    metricId: 'R_SQUARED',
    metricNameCN: '拟合度(R²)',
    green: 'R² 0.6-0.85 → 策略跟市场有关系但有自己的"个性" ✅',
    yellow: 'R² > 0.85 → 策略基本是市场的"跟屁虫"，没有独立价值 ⚠️',
    red: 'R² < 0.3 → 策略跟市场"各玩各的"——可能是好事(独特性)也可能是随机游走 🔴',
  },
  T_STAT: {
    metricId: 'T_STAT',
    metricNameCN: 't统计量',
    green: '|t| ≥ 2.0 → 结果是"统计显著"的——大概率不是运气 ✅',
    yellow: '|t| 1.65-2.0 → 处在显著边缘，"可能有那么回事" ⚠️',
    red: '|t| < 1.65 → "连统计显著都不到"，样本太少或效果太弱 🔴',
  },
  P_VALUE: {
    metricId: 'P_VALUE',
    metricNameCN: 'p值',
    green: 'p < 0.05 → "只有5%可能是碰运气"——有真货 ✅',
    yellow: 'p 0.05-0.10 → "边界上的信号"，需要更多数据验证 ⚠️',
    red: 'p > 0.10 → "可能是纯运气"，别当真，再观察观察 🔴',
  },
  FACTOR_EXPOSURE: {
    metricId: 'FACTOR_EXPOSURE',
    metricNameCN: '因子暴露',
    green: '暴露度适中 → 策略"吃到"了想吃的因子，方向对 ✅',
    yellow: '暴露度过高 → "ALL IN一个方向"，一荣俱荣一损俱损 ⚠️',
    red: '暴露度漂移 → 策略在"偷偷改变口味"，实际跟设计不一样 🔴',
  },
  CORRELATION: {
    metricId: 'CORRELATION',
    metricNameCN: '相关性',
    green: '因子间相关 < 0.3 → "各玩各的"，分散化效果真正好 ✅',
    yellow: '因子间相关 0.3-0.7 → 有一些重叠，分散化效果打折 ⚠️',
    red: '因子间相关 > 0.7 → "穿一条裤子的"，买3个因子≈买1个 🔴',
  },
  CALMAR: {
    metricId: 'CALMAR',
    metricNameCN: '卡尔玛比率',
    green: 'Calmar ≥ 1.0 → 年化收益盖得住最大回撤，"很会保护本金" ✅',
    yellow: 'Calmar 0.5-1.0 → 赚的钱勉强cover住最惨那段，及格线 ⚠️',
    red: 'Calmar < 0.5 → "最惨的一次能把你3年利润亏光"，性价比太低 🔴',
  },
};

// ─── 辅助函数 ──────────────────────────────────────────────

/**
 * 获取某个因子的完整人话文案
 */
export function getFactorCopy(factorId: string): FactorCopy | undefined {
  return FACTOR_COPY_LIBRARY[factorId];
}

/**
 * 获取某个指标的速判文案
 */
export function getMetricQuickJudge(metricId: string): MetricQuickJudge | undefined {
  return METRIC_QUICK_JUDGE[metricId];
}

/**
 * 根据类别获取所有因子
 */
export function getFactorsByCategory(category: string): FactorCopy[] {
  return Object.values(FACTOR_COPY_LIBRARY).filter(f => f.category === category);
}

/**
 * 获取所有因子副本数组
 */
export function getAllFactorCopies(): FactorCopy[] {
  return Object.values(FACTOR_COPY_LIBRARY);
}
