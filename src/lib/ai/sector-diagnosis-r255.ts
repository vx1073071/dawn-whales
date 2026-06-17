// ══ R255 QClaw AI-04: 板块诊断文案 — 10大板块 ══
// Each sector has its own "personality" — not all measured with one ruler

export interface SectorDiagnosis {
  sectorId: string; sectorName: string; sectorEmoji: string;
  oneLiner: string; whatItIs: string; whatDrivesIt: string;
  keyIndicators: string[]; redFlags: string[]; greenFlags: string[];
  diagnosisTemplate: string; whaleAdvice: string;
}

export const SECTOR_DIAGNOSES: SectorDiagnosis[] = [
  // 1. TECHNOLOGY
  {
    sectorId: 'TECHNOLOGY', sectorName: '科技', sectorEmoji: '💻',
    oneLiner: '增长的故事——但利率说了算',
    whatItIs: `标普500最大板块(~28%)。不靠现在利润定价，靠"未来利润的预期"定价。
利率对科技影响最大：利率上升→未来利润折现变少→科技承压。利率下降→科技起飞。`,
    whatDrivesIt: `1. 利率预期：科技股的"重力"。低=飞；高=难。
2. 盈利增长：看"增速是否超预期"——不是有没有利润。
3. 创新周期：AI/云计算/芯片→新增长故事。
4. 估值水位：PE贵是常态——关键是增速能否撑起价格。
5. 机构仓位：对冲基金+被动资金调仓造成巨大波动。`,
    keyIndicators: ['纳指100走势', '10年期美债收益率', '半导体SOX指数(领先指标)',
      'AI/云计算季度指引(比当期业绩更重要)', '板块广度(普涨vs龙头独涨)'],
    redFlags: ['10年期收益快速升+科技不跌(滞后效应)', '板块分化(龙头涨后排跌)',
      '多家下调下季度指引', '散户极度狂热(十倍股刷屏)', '比特币+科技股同步暴跌'],
    greenFlags: ['利率下行+放量突破前高', 'AI业绩真正兑现(财报有增量利润)',
      '板块内普涨而非龙头独涨', '散户情绪中性(越安静越健康)', '企业IT支出回暖'],
    diagnosisTemplate: `## 💻 科技板块诊断\n\n### 当前关键看什么\n1. 10年期收益率？——{rateStatus}\n2. 板块内分化还是普涨？——{breadthStatus}\n3. 财报季指引好坏？——{guidanceStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的科技股持仓\n{positionAdvice}`,
    whaleAdvice: '科技板块波动性是其他板块的1.5-2倍。波动是常态不是异常。真正要警惕的是：利率环境变了你还留在科技里。',
  },
  // 2. FINANCIAL
  {
    sectorId: 'FINANCIAL', sectorName: '金融', sectorEmoji: '🏦',
    oneLiner: '经济的血管——利率是它的脉搏',
    whatItIs: `银行/保险/券商/资管(~13%)。与科技跷跷板：利率升→息差大→金融涨；利率降→息差小→金融跌。`,
    whatDrivesIt: `1. 利率曲线：长短期利差=银行利润模型。利差大=赚。
2. 信贷质量：坏账率上升=金融暴跌。经济差→坏账多。
3. 监管环境：紧=利润压缩；松=释放。
4. 经济周期：好=贷款需求旺；差=坏账多。
5. 资本市场活跃度：IPO多/并购多=投行收入涨。`,
    keyIndicators: ['2年vs10年美债利差', '信贷违约率', '美联储压力测试结果',
      'KBW银行指数', 'M&A并购活动量'],
    redFlags: ['收益率倒挂超6个月', '信贷违约连续两季上升',
      '商业地产贷款恶化(暗雷)', '多家银行同时增贷款损失准备金', '某银行流动性问题(一损俱损)'],
    greenFlags: ['利率曲线重新陡峭化', '贷款需求强劲', '监管松动',
      '信贷质量稳定', '资本市场活跃(IPO窗口打开)'],
    diagnosisTemplate: `## 🏦 金融板块诊断\n\n### 当前关键看什么\n1. 收益率曲线形状？——{curveStatus}\n2. 信贷质量趋势？——{creditStatus}\n3. 资本市场活跃度？——{capitalMarketStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的金融股持仓\n{positionAdvice}`,
    whaleAdvice: '金融PE低≠值得买——可能是因为市场在定价"潜在坏账"。金融的便宜有时是陷阱。',
  },
  // 3. HEALTHCARE
  {
    sectorId: 'HEALTHCARE', sectorName: '医疗', sectorEmoji: '🏥',
    oneLiner: '和利率不熟——它是"防御"的堡垒',
    whatItIs: `制药/生物科技/医疗器械/医疗服务(~13%)。人们生病不关心美联储。
大盘制药=稳定+分红(像债券);小生物科技=高风险高回报(像彩票)。`,
    whatDrivesIt: `1. FDA审批：通过=翻倍；拒绝=腰斩。
2. 专利到期：畅销药专利到=仿制药入场=收入断崖。
3. 医保政策：政府谈药价=利润压缩。
4. 老龄化：长期趋势(慢变量)。
5. 研发管线：管线越深越值钱——制药的"未来存货"。`,
    keyIndicators: ['FDA审批日历', '大制药专利到期时间', '医保政策动向',
      '生物科技ETF走势', '并购活动(大药企收购小生物科技)'],
    redFlags: ['核心药专利到期+管线没替代品', '关键临床数据不及预期(盘前暴跌30-50%)',
      '政府宣布新一轮药价谈判', 'FDA审批严格度上升', '生物科技小盘批量暴跌(融资寒冬)'],
    greenFlags: ['重磅新药获批', '多只生物突破关键临床',
      '大药企"收购季"开始', '政策友好(无新药价压制)', '老龄化趋势不变'],
    diagnosisTemplate: `## 🏥 医疗板块诊断\n\n### 当前关键看什么\n1. FDA关键审批？——{fdaStatus}\n2. 政策面松紧？——{policyStatus}\n3. 大盘制药vs小生物谁领跑？——{segmentStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的医疗股持仓\n{positionAdvice}`,
    whaleAdvice: '医疗是"防御+爆发"的矛盾体。大盘制药防御强，小生物科技一天能涨50%也能亏50%。当两个不同板块看。',
  },
  // 4. ENERGY
  {
    sectorId: 'ENERGY', sectorName: '能源', sectorEmoji: '🛢️',
    oneLiner: '油价的"奴隶"——但正在被新能源改写',
    whatItIs: `石油天然气勘探/生产/管道/炼化(~4-5%)。最"大宗商品驱动"的板块——油价涨=能源涨。
传统化石vs新能源对立但同在一个板块。`,
    whatDrivesIt: `1. 原油价格：油价>80=躺赚；油价<50=保命。
2. 供需平衡：OPEC+减产=涨；需求下滑=跌。
3. 地缘政治：中东/俄罗斯=供应中断=油价飙升。
4. 能源转型政策：减碳=传统承压、新能源利好。
5. 季节性：冬天取暖+夏天出行=消费旺季。`,
    keyIndicators: ['WTI原油期货(心跳)', 'OPEC+会议结果', '美国战略石油储备变化',
      '钻井数量(供应先行指标)', '全球PMI(制造业扩张=需求增)'],
    redFlags: ['全球衰退预期升', 'OPEC+内部背叛(价格战前兆)',
      '新能源政策加速(禁内燃机)', 'contango深度加剧', '能源公司增资本开支(供应增=未来价压)'],
    greenFlags: ['供应收缩+需求正常(最佳组合)', '地缘紧张但可控(不确定性溢价)',
      '全球经济活动回暖', '能源公司分红回购增', '原油库存持续降'],
    diagnosisTemplate: `## 🛢️ 能源板块诊断\n\n### 当前关键看什么\n1. 原油价格区间+驱动？——{oilStatus}\n2. 供应端收缩还是扩张？——{supplyStatus}\n3. 结构性还是周期性行情？——{structureStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的能源股持仓\n{positionAdvice}`,
    whaleAdvice: '能源是"周期之王"——赚的时候觉得"这次不一样"，亏的时候觉得"永远回不去"。历史说：每次都一样。',
  },
  // 5. CONSUMER
  {
    sectorId: 'CONSUMER', sectorName: '消费', sectorEmoji: '🛒',
    oneLiner: '穿越周期的常青树——必需品抗跌，可选品冲锋',
    whatItIs: `必需品消费：食品饮料日用品(~7%)——经济好坏都要买，防御性强。
可选消费：汽车奢侈品旅游餐饮(~11%)——"有钱才买"，周期性极强。
必需品=防御。可选品=进攻。不同经济周期表现相反。`,
    whatDrivesIt: `必需品：1. 通胀传导(能不能涨价转给消费者) 2. 品牌力(定价权) 3. 人口结构
可选品：1. 消费者信心(最直接的消费意愿) 2. 就业&工资增长(有钱才花)
3. 房价&股市(财富效应——资产涨=消费意愿涨) 4. 利率(贷款买车/房=利率敏感)`,
    keyIndicators: ['消费者信心指数', '零售销售数据', '个人储蓄率(高=可选不花)',
      '信用卡逾期率(升=必需也开始受影响了)', '豪宅/汽车/航空行业数据(可选的风向标)'],
    redFlags: ['消费信心暴跌(消费板块的行业地震)', '储蓄率飙升+可选消费销售骤降',
      '信用卡违约率急升(消费信贷出了问题)', '多家消费品公司"库存积压"(供给过剩=降价)',
      '必需品和可选品同时暴跌(系统性危机——所有消费都在萎缩)'],
    greenFlags: ['消费信心稳步回暖', '工资增长跑赢通胀(实际购买力提升)',
      '可选消费销售额反弹(人们不只是"必须花"而是"想花")', '航空出行+酒店预订强劲',
      '消费品牌在涨价但消费者不离开(强品牌力的证明)'],
    diagnosisTemplate: `## 🛒 消费板块诊断\n\n### 当前关键看什么\n1. 消费者信心趋势？——{confidenceStatus}\n2. 必需品vs可选品谁在领跑？——{segmentStatus}\n3. 购买力在改善还是恶化？——{purchasingStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的消费股持仓\n{positionAdvice}`,
    whaleAdvice: '必需消费是最"无聊"的板块——但它在大跌市中往往亏得最少。可选消费在经济复苏时往往是表现最好的板块。不要同时做多必需和可选——它们在不同时间表现好。',
  },
  // 6. INDUSTRIALS
  {
    sectorId: 'INDUSTRIALS', sectorName: '工业', sectorEmoji: '🏭',
    oneLiner: '全球经济的"体温计"——制造业好坏，它最先知道',
    whatItIs: `航空航天/国防/物流/机械/建筑(~8%)。最"经济敏感"的板块——全球供应链的晴雨表。
国防子板块独立于经济周期(政府预算驱动)，但航空航天/物流随经济波动。`,
    whatDrivesIt: `1. 全球PMI(最核心)：制造业扩张=工业好；收缩=工业差。
2. 基建投资：政府花钱建桥修路=工业订单来。
3. 贸易政策：关税/贸易战=供应链成本上升。
4. 航空出行恢复：飞机订单+维修服务=航天航空子板块。
5. 国防预算：地缘紧张=军费增=国防股涨。`,
    keyIndicators: ['全球制造业PMI', 'ISM制造业指数', '新订单指数(订单多=未来业绩好)',
      '交货时间(延长=供应链紧张=涨价)', '波音/空客订单积压(航空航天的未来业绩)'],
    redFlags: ['全球PMI跌破50并持续(制造业衰退)', '贸易摩擦升级(关税=成本涨)',
      '新订单连续三个月下滑(未来业绩危险)', '航空事故/停飞(航天航空子板块的行业地震)',
      '关键原材料成本飙升(钢铁/铜——侵蚀利润)'],
    greenFlags: ['全球PMI回升(制造业复苏)', '基建法案落地(政府订单来)',
      '贸易缓和(供应链成本降)', '新订单>在手订单=增长加速', '自动化/AI工业应用加速(长期升级)'],
    diagnosisTemplate: `## 🏭 工业板块诊断\n\n### 当前关键看什么\n1. 全球PMI趋势？——{pmiStatus}\n2. 新订单在增还是减？——{orderStatus}\n3. 贸易环境+供应链状态？——{tradeStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的工业股持仓\n{positionAdvice}`,
    whaleAdvice: '工业是"经济敏感型"而非"市场敏感型"——关注PMI比关注大盘指数更有意义。',
  },
  // 7. MATERIALS
  {
    sectorId: 'MATERIALS', sectorName: '原材料', sectorEmoji: '⛏️',
    oneLiner: '被"中国"和"美元"牵着走的板块',
    whatItIs: `矿业/化工/金属/建材(~2-3%)。最小的板块但最"全球化"——高度依赖全球需求和美元走势。
矿业公司=商品价格×产量——商品涨10%，矿企可能涨20-30%(杠杆效应)。`,
    whatDrivesIt: `1. 商品价格(最直接)：铜/铁矿石/铝/金——每个金属有自己的"小经济"
2. 中国需求：过去20年全球原材料需求的第一引擎(建设=金属需求)
3. 美元走势：美元强=商品贵(非美元买家买不起)→原材料跌；美元弱→原材料涨
4. 绿色转型：新能源=需要大量铜/锂/镍(新需求源)
5. 供应中断：矿难/罢工/政策限制=供给收缩=价格涨`,
    keyIndicators: ['铜价(最"经济敏感"的金属——"铜博士")', '铁矿石价格(中国建筑需求的代理)',
      '美元指数(反向关系)', '中国PMI(中国工厂开动=矿需求)', '锂/镍/稀土价格(新能源转型需求)'],
    redFlags: ['铜价跌破关键支撑(全球衰退信号)', '美元持续强势',
      '中国房地产持续下滑(铁矿石+铜需求暴跌)', '绿色转型补贴退坡(新能源金属需求降)',
      '矿业公司激进扩张(大量增产→未来价格崩盘)'],
    greenFlags: ['铜价企稳反弹(经济回暖的经典信号)', '美元走弱周期',
      '中国刺激政策(基建+地产=金属需求)', '绿色基础设施加速建设',
      '矿业公司保守经营(不扩产——供应紧=价格有支撑)'],
    diagnosisTemplate: `## ⛏️ 原材料板块诊断\n\n### 当前关键看什么\n1. "铜博士"在说什么？——{copperStatus}\n2. 美元走势？——{dollarStatus}\n3. 中国需求的信号？——{chinaStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的原材料持仓\n{positionAdvice}`,
    whaleAdvice: '原材料是最"宏观"的板块——你不需要懂矿业，你需要懂美元、懂中国、懂全球需求。铜价是全世界最诚实的经济预测。',
  },
  // 8. UTILITIES
  {
    sectorId: 'UTILITIES', sectorName: '公用事业', sectorEmoji: '⚡',
    oneLiner: '"债券的替身"——拿股息的地方',
    whatItIs: `电力/天然气/水务(~2-3%)。最"无聊"但最"稳"的板块。不受经济周期影响（人们不会因为失业少用电）。
高股息+稳定现金流=像债券但又像股票。在利率上升时承压(因为债券更有吸引力了)。`,
    whatDrivesIt: `1. 利率(最关键)：公用事业的"主要竞争者"是债券。利率升=债券收益高=公用事业没人买。
2. 监管环境：政府定的电价/水价=利润天花板。
3. 绿色转型：传统电力→可再生能源(投入大但未来成本低)。
4. 天气：酷热/严寒=用电量飙升(短期)。
5. 股息率：大家买公用事业主要为了股息——不是看涨多少。`,
    keyIndicators: ['10年期国债收益率(公用事业的"对手盘")', '公用事业板块平均股息率vs国债收益率',
      '电力需求数据', '监管审批节奏', '可再生能源装机进度'],
    redFlags: ['利率快速上升(直接从公用事业抽走资金——去债券了)',
      '监管削减定价(利润直接压缩)', '极端气候导致的电网故障(天灾——不可预测但影响大)',
      '绿色转型成本超预期(投入比预期大=现金流紧张)', '股息削减(最致命的信号——大家买它就是为股息)'],
    greenFlags: ['利率下行(债券吸引力降=公用事业涨)', '监管环境友好(允许合理提价)',
      '电力需求增长(制造业+AI数据中心=新用电大户)', '可再生能源成本持续下降(投入越来越少)',
      '股息稳定增长(不是一次性的——是"连续第X年增长")'],
    diagnosisTemplate: `## ⚡ 公用事业板块诊断\n\n### 当前关键看什么\n1. 利率环境？——{rateStatus}\n2. 股息率vs国债收益率？——{yieldStatus}\n3. 监管+能源转型进度？——{transitionStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的公用事业持仓\n{positionAdvice}`,
    whaleAdvice: '公用事业不是让你变富的——是让你的钱有地方安放的。如果你在追逐增长，找科技；如果你想安稳收息，找公用事业。它的竞争对手是银行定存，不是科技股。',
  },
  // 9. REAL_ESTATE
  {
    sectorId: 'REAL_ESTATE', sectorName: '房地产', sectorEmoji: '🏘️',
    oneLiner: '利率的"第一受害者"——也是最受益者',
    whatItIs: `REITs和房地产服务公司(~3%)。REITs=不直接买房子，买"收房租的公司"。
房地产是利率最敏感的板块——因为几乎所有房地产都靠贷款。利率升=贷款成本升=利润降。`,
    whatDrivesIt: `1. 利率(最核心)：利率=REITs的"杀手"或"推手"。杀手(高成本)或推手(低成本杠杆)
2. 租金和入住率：办公室/商场/公寓——入住率高+租金涨=REIT赚钱
3. 远程办公趋势：写字楼需求降→办公楼REIT承压；住宅+数据中心需求升
4. 电商vs实体：电商增长=仓库物流REIT受益；百货商场=可能需要转型
5. 通胀：硬资产(房产)是对冲通胀的传统手段——通胀高=持有房产比持有现金好`,
    keyIndicators: ['联邦基金利率/10年美债收益率', '商业地产贷款质量(银行视角=金融板块也关注)',
      '各类REIT的平均入住率', '住宅租金增长率', '电商销售额(物流REIT的代理指标)'],
    redFlags: ['利率快速上升(直接的负面冲击)', '入住率持续下降',
      '租金开始下降(房东松动的信号)', '商业地产估值下跌(价格先于租金反应)',
      '大量租户违约(经济差到租户还不起租金了)'],
    greenFlags: ['利率下行(REIT股息相对债券变更有吸引力)', '入住率攀升',
      '租金强劲增长(房东强势——供不应求)', '地产估值企稳回升',
      '特定子类REIT受益于趋势变化(数据中心/AI算力需求=新型"房地产"需求)'],
    diagnosisTemplate: `## 🏘️ 房地产板块诊断\n\n### 当前关键看什么\n1. 利率走向？——{rateStatus}\n2. 入住率+租金趋势？——{occupancyStatus}\n3. 哪类REIT在跑赢？——{subsectorStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的REIT持仓\n{positionAdvice}`,
    whaleAdvice: '房地产和科技一样受利率影响——但它们受影响的路径不同。科技是"未来利润折现"，REIT是"贷款成本"和"债券竞争"。但两者的结果一样：利率降=两者都涨。',
  },
  // 10. COMMUNICATION
  {
    sectorId: 'COMMUNICATION', sectorName: '通信服务', sectorEmoji: '📡',
    oneLiner: '两个世界：被监管的管道 vs 被追捧的平台',
    whatItIs: `电信（管道的生意：AT&T/Verizon）(~9%含Meta/Google)——最奇怪的板块。
一方面有高股息、稳如债的电信公司；另一方面有FAANG级别的科技平台（Meta/Google/Netflix）。
电信=防御（定月租，不愁没客户）；平台=进攻（广告和订阅驱动，周期性更强）。`,
    whatDrivesIt: `电信：1. 定价能力——能不能提月租而客户不流失。
      2. 频谱拍卖——买频谱=巨额支出（每几年一次大出血）。
      3. 5G/光纤投资周期——投入期利润降，回报期利润升。
平台：1. 广告市场——广告预算=经济的风向标。经济好=广告多=平台赚。
      2. 用户增长——增长放缓=不再是"成长股"了。
      3. 监管反垄断——最实质的风险（拆分/罚款）。
      4. AI落地——Meta的AI推荐、Google的AI搜索——变成"AI平台"的赌注。`,
    keyIndicators: ['全球广告支出预测(平台的"上游"——广告缩减=平台直接出血)',
      '电信ARPU(每用户平均收入——提价能力的标尺)', '5G频谱拍卖日程',
      '平台MAU/DAU增长率(用户天花板)', '监管动态(反垄断/隐私/内容审查)'],
    redFlags: ['全球广告支出预期下调(平台营收的直接打击)', '用户增长持续放缓(不再是"成长"了)',
      '重大反垄断拆分威胁(最不可量化的风险)', '电信巨额频谱支出(短期利润暴跌)',
      '平台之间出现"替代"（TikTok抢Meta的广告/用户时间——平台竞争加剧）'],
    greenFlags: ['广告市场回暖(经济复苏=企业重新开始投广告)', '用户增长重新加速',
      'AI落地后广告效果显著提升(每个广告赚更多钱——即使用户量不涨)', '电信成功提价(ARPU升)',
      '监管风险消退(反垄断案赢了/妥协)'],
    diagnosisTemplate: `## 📡 通信板块诊断\n\n### 当前关键看什么\n1. 电信vs平台——谁在领跑？——{segmentStatus}\n2. 广告市场冷暖？——{adStatus}\n3. 监管在靠近还是远离？——{regulatoryStatus}\n\n### 诊断结论\n{diagnosisConclusion}\n\n### 你的通信股持仓\n{positionAdvice}`,
    whaleAdvice: '通信板块内部的两个世界——电信和平台——相关性很低。不要把"重仓AT&T+重仓Meta"当成"分散投资"——它们本来就是两个完全不同的东西。',
  },
];

// ═══ 诊断生成器 ═══

export function getSectorDiagnosis(sectorId: string): SectorDiagnosis | undefined {
  return SECTOR_DIAGNOSES.find(s => s.sectorId === sectorId);
}

export function formatDiagnosis(sector: SectorDiagnosis, values: Record<string, string>): string {
  let tmpl = sector.diagnosisTemplate;
  for (const [key, val] of Object.entries(values)) {
    tmpl = tmpl.replace(`{${key}}`, val);
  }
  return tmpl;
}

export function getSectorOverview(): string {
  return SECTOR_DIAGNOSES.map(s => `${s.sectorEmoji} **${s.sectorName}** — ${s.oneLiner}`).join('\n');
}

export default SECTOR_DIAGNOSES;
