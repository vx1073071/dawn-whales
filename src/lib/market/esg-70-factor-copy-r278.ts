// ══ R278 QClaw Task 2: ESG 70因子文案 (4h) ══
// 交付: src/lib/market/esg-70-factor-copy-r278.ts
//
// 25 ESG + 20 Alternative Data + 15 Options + 10 Fixed Income = 70
// 数据源: MSCI ESG / CBOE / Alternative Data 整合

export const ESG_70_FACTOR_COPY = {

  // ══════════════════════════════════════════════════════
  // PART A: ESG 25因子 (环境+社会+治理)
  // ══════════════════════════════════════════════════════

  esg: {
    sectionTitle: "🌿 ESG因子",
    sectionSubtitle: "可持续投资的量化框架——从道德约束到阿尔法来源",

    // ── E: 环境 9项 ──
    environmental: {
      title: "环境 (Environmental)",
      titleEn: "Environmental",
      emoji: "🌍",
      factors: {
        ESG_E_CARBON_INTENSITY: {
          name: "碳排放强度",
          nameEn: "Carbon Intensity",
          emoji: "🏭",
          oneliner: "每百万美元收入的碳排放吨数——越高=碳税/监管风险越大",
          description: "Scope 1+2碳排放÷营收。重工业>100吨/$M，科技<5吨/$M。碳密集度高的公司面临欧盟CBAM(碳边境税)和未来碳价的实质成本冲击。",
          ranges: [
            { condition: "碳强度 行业<30分位", meaning: "绿色——行业领跑者。享受ESG资金流入溢价", color: "green" },
            { condition: "碳强度 行业30-70分位", meaning: "中性——随大流", color: "neutral" },
            { condition: "碳强度 行业>70分位", meaning: "碳风险高——碳价$100/吨时利润侵蚀可达15-30%", color: "red" },
          ],
          dontTrust: "Scope 3(供应链/产品使用)碳排放不在碳强度统计内——石油公司的Scope 3是Scope1+2的5-10倍。只看碳强度会严重低估气候风险。",
        },
        ESG_E_WATER_STRESS: {
          name: "水资源压力",
          nameEn: "Water Stress",
          emoji: "💧",
          oneliner: "运营在高水压地区比——缺水=运营中断+成本飙升",
          description: "在高/极高水资源压力地区的运营占比。半导体/饮料/农业高度暴露。水资源压力>50%的公司在干旱年份利润可下降20-40%。",
          ranges: [
            { condition: "高水压地区占比<10%", meaning: "低风险——水源充足地区", color: "green" },
            { condition: "占比 10-30%", meaning: "中等——需关注", color: "yellow" },
            { condition: "占比>50%", meaning: "高水压暴露——严重缺水时可能停产", color: "red" },
          ],
          dontTrust: "水压指数是静态快照——气候变化使水资源的空间分布快速演变，过去的低水压不代表未来。",
        },
        ESG_E_WASTE: {
          name: "废弃物管理",
          nameEn: "Waste Management",
          emoji: "♻️",
          oneliner: "有害废弃物量与回收率——有毒废料=有毒负债",
          description: "有害废弃物产生量+回收率。化工/采矿/电子制造是该指标重灾区。有害废弃物违规排放=天价罚款(大众排放门$300亿)。",
          ranges: [
            { condition: "回收率>80%+有害废降", meaning: "最佳实践——循环经济的标杆", color: "green" },
            { condition: "回收率 50-80%", meaning: "中等", color: "neutral" },
            { condition: "有害废增+回收率<30%", meaning: "环境负债累积——监管风险高", color: "red" },
          ],
        },
        ESG_E_RENEWABLE: {
          name: "可再生能源占比",
          nameEn: "Renewable Energy Ratio",
          emoji: "☀️",
          oneliner: "绿电使用比例——能源转型的速度条",
          description: "可再生能源在总用电量中的占比。>50%=领先。<20%=转型缓慢=未来成本劣势。欧盟要求到2030年可再生能源占42.5%。",
          ranges: [
            { condition: "绿电>50%+在增长", meaning: "能源转型领先——成本优势在扩大", color: "green" },
            { condition: "绿电 20-50%", meaning: "在转型中", color: "neutral" },
            { condition: "绿电<20%+无计划", meaning: "转型缓慢——未来碳税+能源成本上行压力", color: "red" },
          ],
        },
        ESG_E_BIODIVERSITY: {
          name: "生物多样性影响",
          nameEn: "Biodiversity Impact",
          emoji: "🦋",
          oneliner: "对保护区/濒危物种的影响——ESG的最新前沿",
          description: "在生物多样性热点地区的运营+土地用途变更。采矿/农业/房地产是最大暴露板块。TNFD(自然相关财务披露)正在成为新的TCFD。",
          ranges: [
            { condition: "零保护区运营", meaning: "无直接暴露", color: "green" },
            { condition: "在缓冲区运营", meaning: "中度——需监测TNFD合规进展", color: "yellow" },
            { condition: "在核心保护区运营", meaning: "高风险——未来运营许可可能被吊销", color: "red" },
          ],
        },
        ESG_E_CLIMATE_VAR: {
          name: "气候VaR",
          nameEn: "Climate Value at Risk",
          emoji: "🌡️",
          oneliner: "气候变化对公司价值的下行风险——物理+转型双维度",
          description: "MSCI的气候在险价值——物理风险(洪水/火灾/飓风损失)+转型风险(碳价/政策/技术替代)综合评估。2030年前5%/2050年前20%价值损失=高暴露。",
          ranges: [
            { condition: "气候VaR<5%企业价值", meaning: "气候韧性高——可承受2°C情景", color: "green" },
            { condition: "气候VaR 5-15%", meaning: "中度暴露——留意脱碳进展", color: "yellow" },
            { condition: "气候VaR>20%", meaning: "气候脆弱——资产可能成为搁浅资产", color: "red" },
          ],
        },
        ESG_E_GREEN_REVENUE: {
          name: "绿色收入占比",
          nameEn: "Green Revenue Share",
          emoji: "💰",
          oneliner: "来自绿色产品/服务的收入比例——真绿色vs漂绿",
          description: "符合EU分类法或MSCI绿色收入定义的营收占比。>50%=纯绿色。<5%=传统棕色。30-50%是转型公司的证据。",
          ranges: [
            { condition: "绿色收入>50%", meaning: "深绿——享有绿色溢价+ESG基金准入", color: "green" },
            { condition: "绿色收入 10-50%", meaning: "转型中——公司有转型意愿和路径", color: "neutral" },
            { condition: "绿色收入<5%", meaning: "棕色公司——面临撤资和绿色washing指控风险", color: "red" },
          ],
          dontTrust: "很多公司把轻微优化的产品标成「绿色」——壳牌的绿色收入统计包括天然气，而欧盟不认。绿色收入定义是漂绿主战场。",
        },
        ESG_E_EMISSION_TARGET: {
          name: "减排目标可信度",
          nameEn: "Emission Target Credibility",
          emoji: "🎯",
          oneliner: "公司承诺的净零目标靠谱吗——SBTi验证是最低门槛",
          description: "是否有科学碳目标(SBTi)认证+近期的减排轨迹是否达标。有SBTi+走在轨迹上=可靠的。只有承诺没有行动计划=绿色washing。",
          ranges: [
            { condition: "SBTi认证+达标", meaning: "可信的气候行动计划", color: "green" },
            { condition: "承诺但未认证", meaning: "意愿在但无约束——半信半疑", color: "yellow" },
            { condition: "无减排目标", meaning: "完全没有气候战略——ESG基金不能投", color: "red" },
          ],
        },
        ESG_E_ENVIRO_SCORE: {
          name: "MSCI环境总分",
          nameEn: "MSCI Environmental Score",
          emoji: "📊",
          oneliner: "MSCI对环境维度的综合评级——AAA=领袖,CCC=落后者",
          description: "0-10分制。>7.14=Leader(AAA/AA)。<2.86=Laggard(B/CCC)。综合了碳排放/水资源/废弃物/清洁科技等多个子项。",
          ranges: [
            { condition: "得分>7.14", meaning: "环境领袖——ESG基金可投", color: "green" },
            { condition: "得分 2.86-7.14", meaning: "平均——一般可投", color: "neutral" },
            { condition: "得分<2.86", meaning: "落后者——多数ESG基金剔除", color: "red" },
          ],
        },
      },
    },

    // ── S: 社会 8项 ──
    social: {
      title: "社会 (Social)",
      titleEn: "Social",
      emoji: "👥",
      factors: {
        ESG_S_LABOR: {
          name: "劳工实践",
          nameEn: "Labor Practices",
          emoji: "👷",
          oneliner: "劳资纠纷/强迫劳动/供应链劳工——最大的声誉风险",
          description: "罢工次数+劳资纠纷+供应商强迫劳动指控。服装/电子制造/采矿是重灾区。一起重大劳工丑闻可蒸发市值10-30%。",
          ranges: [
            { condition: "零争议+第三方审计", meaning: "劳工管理优秀", color: "green" },
            { condition: "轻微争议", meaning: "需关注——可能是冰山一角", color: "yellow" },
            { condition: "重大劳资争议/强迫劳动", meaning: "红色警报——供应链ESG风险最高的信号", color: "red" },
          ],
        },
        ESG_S_DIVERSITY: {
          name: "员工多样性",
          nameEn: "Workforce Diversity",
          emoji: "🌈",
          oneliner: "管理层/董事会/全员的性别与种族——多样性溢价存在吗",
          description: "女性在管理层/董事会的占比。学术证据：高层多样性高的公司财务表现更好(但相关≠因果)。30%女性董事在欧洲是一些交易所的上市要求。",
          ranges: [
            { condition: "管理层女性>30%", meaning: "多样性领先——符合欧盟新规", color: "green" },
            { condition: "女性 15-30%", meaning: "一般水平", color: "neutral" },
            { condition: "全部男性管理层", meaning: "多样性极度缺乏——不符合现代治理标准", color: "red" },
          ],
          dontTrust: "多样性指标容易变成「打钩游戏」——一个女性塞进董事会不代表真包容。看的是留任率和晋升通道，不是头数。",
        },
        ESG_S_SAFETY: {
          name: "安全生产",
          nameEn: "Workplace Safety",
          emoji: "🦺",
          oneliner: "工伤率/死亡率——血汗工厂的信号器",
          description: "每百万工时的工伤/死亡人数。采矿/建筑/重工>5=高危。<1=安全。化学品泄漏/爆炸=致命风险。",
          ranges: [
            { condition: "工伤率<1+零死亡", meaning: "安全标杆——最佳实践", color: "green" },
            { condition: "工伤率 1-3", meaning: "行业平均", color: "neutral" },
            { condition: "工伤率>5或有死亡", meaning: "严重安全缺陷——天价罚款+刑事责任", color: "red" },
          ],
        },
        ESG_S_HUMAN_CAPITAL: {
          name: "人才管理",
          nameEn: "Human Capital Management",
          emoji: "🎓",
          oneliner: "培训投入+员工流失率——知识密集行业的核心资产",
          description: "人均培训小时+自愿离职率。高培训投入+低离职率=人才护城河。高离职率(>20%)=公司文化有问题。",
          ranges: [
            { condition: "培训充足+离职<10%", meaning: "人才蓄水池——核心竞争力", color: "green" },
            { condition: "离职 10-20%", meaning: "正常", color: "neutral" },
            { condition: "离职>20%+培训少", meaning: "人才枯竭——内卷/管理糟糕", color: "red" },
          ],
        },
        ESG_S_PRODUCT_SAFETY: {
          name: "产品安全与质量",
          nameEn: "Product Safety & Quality",
          emoji: "🛡️",
          oneliner: "召回次数/投诉率——产品质量问题的直接证据",
          description: "产品召回+质量投诉+监管罚单。汽车/医药/食品行业最受影响。一次重大召回可永久丢失20%市场份额。",
          ranges: [
            { condition: "零召回+低投诉", meaning: "品质标杆", color: "green" },
            { condition: "少量投诉", meaning: "正常", color: "neutral" },
            { condition: "重大召回/集体诉讼", meaning: "品质危机——股价通常跌30%+", color: "red" },
          ],
        },
        ESG_S_DATA_PRIVACY: {
          name: "数据隐私与安全",
          nameEn: "Data Privacy & Security",
          emoji: "🔒",
          oneliner: "数据泄露次数+GDPR违规——数字化时代的致命风险",
          description: "重大数据泄露事件+监管罚单(GDPR最高罚款全球营收4%)。科技/金融/医疗公司是重灾区。",
          ranges: [
            { condition: "零重大泄露", meaning: "数据安全良好", color: "green" },
            { condition: "小规模泄露", meaning: "需改进", color: "yellow" },
            { condition: "大规模泄露+罚款", meaning: "信任破产——罚款+客户流失双重打击", color: "red" },
          ],
        },
        ESG_S_COMMUNITY: {
          name: "社区关系",
          nameEn: "Community Relations",
          emoji: "🏘️",
          oneliner: "与当地社区的关系——采矿/能源公司最容易引发冲突",
          description: "社区抗议+土地纠纷+运营许可挑战。社区强烈抵制可导致项目延期数年、成本翻倍。",
          ranges: [
            { condition: "零冲突+社区投资", meaning: "社会许可稳固", color: "green" },
            { condition: "轻微不满", meaning: "正常——保持沟通", color: "neutral" },
            { condition: "重大抗议/诉讼", meaning: "运营许可受威胁——暂停或取消风险", color: "red" },
          ],
        },
        ESG_S_SOCIAL_SCORE: {
          name: "MSCI社会总分",
          nameEn: "MSCI Social Score",
          emoji: "📊",
          oneliner: "MSCI对社会维度的综合评分——涵盖劳工/安全/产品/隐私",
          description: "0-10分制。人力资本+产品责任+利益相关者对立+社会机会四大维度加权。",
          ranges: [
            { condition: "得分>7.14", meaning: "社会领袖", color: "green" },
            { condition: "得分 2.86-7.14", meaning: "平均", color: "neutral" },
            { condition: "得分<2.86", meaning: "落后者", color: "red" },
          ],
        },
      },
    },

    // ── G: 治理 8项 ──
    governance: {
      title: "治理 (Governance)",
      titleEn: "Governance",
      emoji: "⚖️",
      factors: {
        ESG_G_BOARD: {
          name: "董事会独立性",
          nameEn: "Board Independence",
          emoji: "🏛️",
          oneliner: "独立董事比例——CEO+董事长同一人=权力过大",
          description: "独立董事占比。>2/3=独立主导。CEO同时任董事长=权力过于集中。独立董事<50%=家族企业/国企特征，代理成本高。",
          ranges: [
            { condition: "独立董事>2/3", meaning: "治理最佳实践——独立监督", color: "green" },
            { condition: "独立董事 50-67%", meaning: "一般", color: "neutral" },
            { condition: "独立董事<50%或CEO=董事长", meaning: "权力集中——掏空小股东风险高", color: "red" },
          ],
        },
        ESG_G_EXEC_PAY: {
          name: "高管薪酬合理性",
          nameEn: "Executive Compensation",
          emoji: "💵",
          oneliner: "CEO薪酬 vs 员工中位数——倍数太高=贪婪和士气问题",
          description: "CEO薪酬/员工中位数薪酬。美国>300:1。欧洲<100:1。极端的薪酬差距=治理红灯。薪酬与业绩挂钩>与股价挂钩（避免短期主义）。",
          ranges: [
            { condition: "薪酬比<100:1+业绩挂钩", meaning: "薪酬合理——激励结构健康", color: "green" },
            { condition: "薪酬比 100-300:1", meaning: "偏高但行业可接受", color: "yellow" },
            { condition: "薪酬比>300:1+股价挂钩", meaning: "贪婪——鼓励短期操纵股价行为", color: "red" },
          ],
        },
        ESG_G_ACCOUNTING: {
          name: "会计与审计质量",
          nameEn: "Accounting & Audit Quality",
          emoji: "📋",
          oneliner: "审计师声誉+审计意见+财务重述——造假的早期信号",
          description: "四大审计=最低保障线。持续经营警告/内部控制缺陷/频繁财务重述=重大红旗。审计费用异常变化(骤降/骤升)=审计质量的信号。",
          ranges: [
            { condition: "四大+无保留+无重述", meaning: "审计质量高——可信财报", color: "green" },
            { condition: "小所审计+轻微缺陷", meaning: "审计质量存疑", color: "yellow" },
            { condition: "保留意见/重大重述", meaning: "财务欺诈高风险——瑞幸/安然都有此信号", color: "red" },
          ],
        },
        ESG_G_SHAREHOLDER: {
          name: "股东权利",
          nameEn: "Shareholder Rights",
          emoji: "🗳️",
          oneliner: "同股同权还是AB股——你的投票真的有用吗？",
          description: "超级投票权(AB股)的存在+毒丸计划+超级多数条款。AB股在科技公司很常见但削弱外部股东话语权。一股一票=最理想。",
          ranges: [
            { condition: "一股一票+无毒丸", meaning: "股东友好——治理最佳", color: "green" },
            { condition: "AB股但有日落条款", meaning: "可接受——创始人控制有限期", color: "neutral" },
            { condition: "永久AB股+毒丸", meaning: "股东无权力——管理层/创始人独裁", color: "red" },
          ],
        },
        ESG_G_BUSINESS_ETHICS: {
          name: "商业道德",
          nameEn: "Business Ethics",
          emoji: "⚖️",
          oneliner: "腐败/贿赂/反垄断/洗钱——合规风险的总和",
          description: "FCPA/反贿赂违规+反垄断调查+制裁+洗钱指控。一次重大违规的罚金=数亿至数十亿美元+刑事追诉。",
          ranges: [
            { condition: "零违规+健全合规体系", meaning: "道德标杆", color: "green" },
            { condition: "轻微违规", meaning: "需警惕", color: "yellow" },
            { condition: "重大腐败/制裁调查", meaning: "合规爆炸——高盛1MDB、高通常务贿赂级别", color: "red" },
          ],
        },
        ESG_G_TAX_TRANSPARENCY: {
          name: "税务透明度",
          nameEn: "Tax Transparency",
          emoji: "🧾",
          oneliner: "全球各市场实际税率——避税天堂的利润是否合理",
          description: "有效税率+利润在地理上的分配。有效税率<10%+利润堆积在百慕大/开曼=激进避税=监管+声誉双重风险。",
          ranges: [
            { condition: "有效税率>20%+透明报告", meaning: "合规纳税——社会契约良好", color: "green" },
            { condition: "有效税率 10-20%", meaning: "适度税务规划", color: "neutral" },
            { condition: "有效税率<5%+避税天堂利润", meaning: "激进避税——调查+补税+罚款风险", color: "red" },
          ],
        },
        ESG_G_RISK_MGMT: {
          name: "风险管理体系",
          nameEn: "Risk Management Framework",
          emoji: "🛡️",
          oneliner: "董事会的风险委员会和内部控制系统——风险治理",
          description: "是否有独立风险委员会+首席风险官(CRO)+ERM系统。缺失风险管理=金融/能源公司的致命缺陷。",
          ranges: [
            { condition: "CRO+独立委员会+ERM", meaning: "全面风险管理——最佳实践", color: "green" },
            { condition: "基本框架", meaning: "合格但可改进", color: "neutral" },
            { condition: "无CRO/ERM", meaning: "风险管理缺失——危机时将不知所措", color: "red" },
          ],
        },
        ESG_G_GOV_SCORE: {
          name: "MSCI治理总分",
          nameEn: "MSCI Governance Score",
          emoji: "📊",
          oneliner: "MSCI对治理的综合评分——董事会/薪酬/控制权/商业道德",
          description: "0-10分制。公司治理（董事会+所有权+薪酬）+公司行为（商业道德+税务透明度）两大支柱。",
          ranges: [
            { condition: "得分>7.14", meaning: "治理领袖", color: "green" },
            { condition: "得分 2.86-7.14", meaning: "平均", color: "neutral" },
            { condition: "得分<2.86", meaning: "治理落后——撤资风险", color: "red" },
          ],
        },
      },
    },
  },

  // ══════════════════════════════════════════════════════
  // PART B: 另类数据 Alternative Data 20因子
  // ══════════════════════════════════════════════════════

  alternativeData: {
    sectionTitle: "🛰️ 另类数据因子",
    sectionSubtitle: "非传统数据驱动的投资信号——卫星/信用卡/社交媒体/供应链",

    // ── 卫星遥感 3项 ──
    satellite: [
      {
        id: "ALT_SATELLITE_PARKING",
        name: "卫星停车场密度",
        emoji: "🛰️",
        oneliner: "零售商的停车场车辆数——提前1-2周知道同店销售",
        description: "用卫星影像每日统计停车场车辆数。比月度财报提前2-6周。沃尔玛/Costco/星巴克停车场密度同比+10%=销售大概率超预期。",
        ranges: [
          { condition: "parking_density_yoy >10%", meaning: "high foot traffic", color: "green" },
          { condition: "密度 YoY 0-10%", meaning: "正常", color: "neutral" },
          { condition: "密度 YoY -10%", meaning: "客流下降——警惕财报miss", color: "red" },
        ],
        dontTrust: "天气/节假日会严重影响停车场数据——需要季节性调整。雨天停车场满≠生意好。要与历史同天气条件对比。",
      },
      {
        id: "ALT_SATELLITE_CROPS",
        name: "卫星作物健康",
        emoji: "🌾",
        oneliner: "NDVI植被指数——预判农业产量和大宗商品价格",
        description: "卫星NDVI(归一化植被指数)测量作物健康状况。NDVI<往年=减产=大豆/玉米/棉花期货上涨信号。提前期货报告1-2月的优势。",
        ranges: [
          { condition: "NDVI >往年均值10%", meaning: "丰收——农产品价格承压", color: "green" },
          { condition: "NDVI 往年均值±10%", meaning: "正常", color: "neutral" },
          { condition: "NDVI <往年均值15%", meaning: "减产——价格可能飙升", color: "red" },
        ],
      },
      {
        id: "ALT_SATELLITE_CONSTRUCTION",
        name: "卫星施工进度",
        emoji: "🏗️",
        oneliner: "大型基建设施/矿山的施工进度——项目能否如期投产",
        description: "定期对比工地卫星图像判断实际vs计划进度。进度滞后=投产延迟=收入确认推迟=潜在减值。",
        ranges: [
          { condition: "施工超前/按期", meaning: "项目执行力强", color: "green" },
          { condition: "轻微滞后", meaning: "常见——不必过度反应", color: "neutral" },
          { condition: "严重停工", meaning: "项目风险——可能超支和延期交付", color: "red" },
        ],
      },
    ],

    // ── 地理围栏/位置数据 3项 ──
    geolocation: [
      {
        id: "ALT_FOOT_TRAFFIC",
        name: "到店客流量",
        emoji: "🚶",
        oneliner: "手机位置数据估计到店人数——线下零售/餐饮的实时晴雨表",
        description: "通过SafeGraph/Foursquare等提供的手机位置数据统计到店人次。同比变化=最实时的零售KPI。比财报提前8-10周。",
        ranges: [
          { condition: "到店 YoY >15%", meaning: "人气爆棚——业绩大超预期", color: "green" },
          { condition: "到店 YoY 0-15%", meaning: "正常", color: "neutral" },
          { condition: "到店 YoY -5%", meaning: "门可罗雀——警告", color: "red" },
        ],
        dontTrust: "到店≠购买——逛街的多、买单的少。位置数据需要结合客单价(信用卡数据)才有意义。",
      },
      {
        id: "ALT_WEB_TRAFFIC",
        name: "网站/App流量",
        emoji: "💻",
        oneliner: "SimilarWeb/Data.ai估计的访客和DAU——互联网公司的第一手信号",
        description: "网站UV+App月活的第三方估计。电商/游戏/社交/流媒体公司的核心KPI。DAU下降=平台在失去用户=收入必然下降。",
        ranges: [
          { condition: "DAU YoY >15%", meaning: "用户激增——网络效应在加速", color: "green" },
          { condition: "DAU YoY 0-15%", meaning: "正常增长", color: "neutral" },
          { condition: "DAU YoY下降", meaning: "用户流失——增长故事破灭的第一信号", color: "red" },
        ],
      },
      {
        id: "ALT_APP_RATINGS",
        name: "App评分趋势",
        emoji: "⭐",
        oneliner: "App Store/Google Play评分和评论情感——消费者满意度的实时反馈",
        description: "每周App评分的趋势+评论情感分析。评分持续下降=产品问题=用户会流失。MAU/DAU比App评分滞后3-6个月。",
        ranges: [
          { condition: "评分上升+正面情感>80%", meaning: "用户喜爱——护城河在加强", color: "green" },
          { condition: "评分稳定", meaning: "正常", color: "neutral" },
          { condition: "评分连续3月下跌", meaning: "产品口碑恶化——MAU下降的前兆", color: "red" },
        ],
      },
    ],

    // ── 交易/消费数据 5项 ──
    transaction: [
      {
        id: "ALT_CREDIT_CARD",
        name: "信用卡交易数据",
        emoji: "💳",
        oneliner: "聚合匿名信用卡消费——比官方零售数据早2-4周",
        description: "从Yodlee/Envestnet等聚合的匿名信用卡消费面板。跟踪某公司的消费金额变化。注意：样本偏差大（偏重线上+高收入）。",
        ranges: [
          { condition: "消费金额 YoY >10%", meaning: "消费者支出旺盛", color: "green" },
          { condition: "金额 YoY 0-10%", meaning: "正常", color: "neutral" },
          { condition: "金额 YoY下降", meaning: "消费者缩减——零售减速的前兆", color: "red" },
        ],
      },
      {
        id: "ALT_RECEIPTS",
        name: "电子收据数据",
        emoji: "🧾",
        oneliner: "邮件收据扫描——更精确的单品级消费洞察",
        description: "从收据邮件提取品项价格和数量。比信用卡数据更细粒度(SKU级别)。补充信用卡数据缺失的品类详情。",
        ranges: [
          { condition: "ASP↑+单量↑", meaning: "量价齐升——最健康的增长", color: "green" },
          { condition: "ASP↑+单量↓", meaning: "涨价掩盖需求萎缩——警惕", color: "yellow" },
          { condition: "ASP↓+单量↓", meaning: "双降——需求崩盘", color: "red" },
        ],
      },
      {
        id: "ALT_SHIPPING",
        name: "海运/供应链数据",
        emoji: "🚢",
        oneliner: "提单+集装箱追踪——货物是否真的在流动",
        description: "提单/海关+集装箱追踪数据。某公司的进口量突然下降=销售预期调低。供应商出货提前+20%=订单大增。",
        ranges: [
          { condition: "订单量 YoY增", meaning: "需求充沛——公司在激进备货", color: "green" },
          { condition: "订单量 YoY降", meaning: "需求降温——公司在砍单", color: "red" },
        ],
        dontTrust: "供应链数据噪音大——长鞭效应使上游波动被放大。海关申报价≠实际成交价(存在转移定价)。",
      },
      {
        id: "ALT_JOB_POSTINGS",
        name: "招聘职位数据",
        emoji: "💼",
        oneliner: "公司发布的招聘职位数——扩张vs收缩的第一信号",
        description: "从LinkedIn/Indeed抓取的公司公开招聘职位数。招聘冻结或大幅裁减=管理层极度悲观。岗位增加=看好未来。",
        ranges: [
          { condition: "岗位数 YoY >20%", meaning: "积极扩张——管理层极乐观", color: "green" },
          { condition: "岗位数 YoY 0-20%", meaning: "正常", color: "neutral" },
          { condition: "岗位数 YoY下降", meaning: "收缩——裁员前兆", color: "red" },
        ],
      },
      {
        id: "ALT_PATENT_FILINGS",
        name: "专利申请趋势",
        emoji: "📜",
        oneliner: "专利申请数量和质量——技术创新能力的真实度量",
        description: "专利公开数量+专利被引用次数+专利授权率。R&D效率=专利数/R&D投入。被引专利=真正有影响力的创新。",
        ranges: [
          { condition: "专利增长+高引用", meaning: "创新引擎——未来收入来源", color: "green" },
          { condition: "专利稳定", meaning: "正常维持", color: "neutral" },
          { condition: "专利锐减", meaning: "创新枯竭——长期竞争力风险", color: "red" },
        ],
      },
    ],

    // ── 社交媒体/新闻 4项 ──
    socialMedia: [
      {
        id: "ALT_SOCIAL_SENTIMENT",
        name: "社交媒体情绪",
        emoji: "🐦",
        oneliner: "Reddit/X/TikTok的提及和情绪——散户注意力的实时雷达",
        description: "用NLP分析社交媒体讨论量+情感极性。讨论量突然爆增=散户注意力来了=短期波动率飙升。但情绪与后续回报的相关性衰减极快(1-5天)。",
        ranges: [
          { condition: "提及增>500%+积极", meaning: "病毒式传播——按动量交易(短周期)", color: "green" },
          { condition: "提及正常", meaning: "无特别信号", color: "neutral" },
          { condition: "提及增+极其负面", meaning: "声誉危机——通常是迅速反应的窗口", color: "red" },
        ],
        dontTrust: "社交情绪可以在几小时内反转——昨天全网夸今天全网骂。不要用社交情绪做中期（>1周）决策。它是催化剂不是基本面。",
      },
      {
        id: "ALT_NEWS_SENTIMENT",
        name: "新闻情感指数",
        emoji: "📰",
        oneliner: "主流财经新闻的情感得分——比社交媒体更稳定的情绪指标",
        description: "Reuters/Bloomberg/Wall Street Journal等主流新闻的情感NLP评分。新闻情绪与超额收益持续性约1-3个月（比社交媒体长）。",
        ranges: [
          { condition: "新闻情绪>0.5(积极)", meaning: "媒体叙事在改善——正面催化剂", color: "green" },
          { condition: "情绪 0-0.5", meaning: "中性", color: "neutral" },
          { condition: "新闻情绪<0(负面)", meaning: "负面叙事——中期表现很可能承压", color: "red" },
        ],
      },
      {
        id: "ALT_GOOGLE_TRENDS",
        name: "Google Trends热度",
        emoji: "🔍",
        oneliner: "搜索量变化=公众注意力流向——对consumer-facing公司尤其有效",
        description: "Google搜索量的标准化变化。搜索量激增通常领先销售1-2周。搜索量骤降=关注度消退=品牌弱化。注意区分品牌搜索和产品类别搜索。",
        ranges: [
          { condition: "搜索量 YoY >25%", meaning: "关注度膨胀——可能转化为销量", color: "green" },
          { condition: "搜索量稳定", meaning: "正常", color: "neutral" },
          { condition: "搜索量 YoY下降", meaning: "兴趣衰减——品牌/产品在退热", color: "red" },
        ],
      },
      {
        id: "ALT_EARNINGS_CALL",
        name: "财报电话会情绪",
        emoji: "🎙️",
        oneliner: "管理层在电话会中的语调/措辞——诚实度的NLP检测",
        description: "用NLP分析财报电话会的管理层语调(正面/负面词汇比例)+回避问题指数+措辞复杂性。语调突然转负=财报藏雷信号。",
        ranges: [
          { condition: "语调积极+直面问题", meaning: "管理层自信、透明——好信号", color: "green" },
          { condition: "语调中性", meaning: "正常", color: "neutral" },
          { condition: "语调突然转负+回避", meaning: "管理层可能在掩盖——强烈警惕", color: "red" },
        ],
        dontTrust: "管理层更擅长的就是口才——积极语调≠真乐观。真正有效的是语调的变化（管理层突然「不会说话了」）。",
      },
    ],

    // ── ESG另类数据 2项 ──
    esgAlt: [
      {
        id: "ALT_NEWS_CONTROVERSY",
        name: "ESG争议事件追踪",
        emoji: "🚨",
        oneliner: "实时监控ESG相关的负面新闻——比MSCI评级快几个月",
        description: "用NLP实时抓取ESG相关的争议新闻(环境事故/裁员/诉讼)。争议事件→MSCI降级通常有3-6个月延迟窗口=可交易。",
        ranges: [
          { condition: "零争议", meaning: "ESG状况良好", color: "green" },
          { condition: "轻量争议", meaning: "需跟踪是否恶化", color: "yellow" },
          { condition: "重大争议(环境灾害/腐败)", meaning: "可能被ESG基金清仓——3-6月窗口", color: "red" },
        ],
      },
      {
        id: "ALT_SUPPLY_CHAIN_ESG",
        name: "供应链ESG风险",
        emoji: "⛓️",
        oneliner: "供应商的ESG问题迟早会烧到你——苹果/耐克都踩过的坑",
        description: "追踪一级/二级供应商的ESG评级和争议事件。供应商被曝强迫劳动=品牌公司3-6月后必受冲击。",
        ranges: [
          { condition: "全供应链无重大争议", meaning: "供应链治理到位", color: "green" },
          { condition: "二级供应商小争议", meaning: "预警——深入审计", color: "yellow" },
          { condition: "核心供应商重大争议", meaning: "供应链断供+品牌受损风险", color: "red" },
        ],
      },
    ],

    // ── 宏观经济另类 3项 ──
    macroAlt: [
      {
        id: "ALT_ELECTRICITY",
        name: "工业用电量",
        emoji: "⚡",
        oneliner: "高耗能企业/工业园区的用电数据——经济活动的实时脉搏",
        description: "通过电力公司/卫星数据追踪工业园区实际用电。用电量下降=减产/停工=GDP增速放缓的前兆。比官方工业产出数据早4-8周。",
        ranges: [
          { condition: "用电 YoY >10%", meaning: "满负荷生产——经济热络", color: "green" },
          { condition: "用电 YoY 0-10%", meaning: "正常", color: "neutral" },
          { condition: "用电 YoY下降", meaning: "减产——实体经济减速。官方数据尚未反映", color: "red" },
        ],
      },
      {
        id: "ALT_FREIGHT_INDEX",
        name: "实时货运指数",
        emoji: "🚚",
        oneliner: "货车/铁路/航运的实时运量和运费——贸易的脉搏",
        description: "卡车货运量+铁路车厢装载数+Cass运费指数。上涨=贸易活跃=经济好。骤降=贸易停止。波罗的海干散货指数(BDI)是最著名的宏观另类数据。",
        ranges: [
          { condition: "货运指数 YoY >15%", meaning: "贸易繁荣——全球经济扩张", color: "green" },
          { condition: "指数 YoY 0-15%", meaning: "正常", color: "neutral" },
          { condition: "指数 YoY下降", meaning: "贸易萎缩——经济降速的强烈信号", color: "red" },
        ],
      },
      {
        id: "ALT_INFLATION_NOWCAST",
        name: "通胀实时预测",
        emoji: "📈",
        oneliner: "用数百万在线价格+信用卡数据每日估计CPI——比官方早1月",
        description: "State Street PriceStats/MIT Billion Prices Project等从在线价格做CPI的nowcasting。与官方CPI高度相关。提前30天预判通胀走势。",
        ranges: [
          { condition: "nowcast CPI↓+趋势向下", meaning: "通胀正在缓解——利好", color: "green" },
          { condition: "nowcast CPI = 官方", meaning: "一致", color: "neutral" },
          { condition: "nowcast CPI↑+官方尚未反映", meaning: "通胀加速——做空债券/成长股", color: "red" },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════
  // PART C: 期权因子 15 项
  // ══════════════════════════════════════════════════════

  options: {
    sectionTitle: "📊 期权因子",
    sectionSubtitle: "期权市场提供了价格里无法直接看到的——波动率、偏度、尾部风险的定价",
    factors: {
      OPT_IV_RANK: {
        name: "隐含波动率排位(IV Rank)",
        emoji: "📊",
        oneliner: "当前IV在历史中的位置——过去1年最低0最高100",
        description: "IV Rank = (当前IV-52周最低IV)/(52周最高-最低)。IV Rank>80=IV极高位=卖期权最有利。IV Rank<20=IV极低位=买期权便宜。",
        ranges: [
          { condition: "IV Rank<20", meaning: "IV极低——买期权便宜。但暗示市场过于乐观", color: "yellow" },
          { condition: "IV Rank 20-60", meaning: "正常区间", color: "neutral" },
          { condition: "IV Rank>80", meaning: "IV极高——恐慌/不确定性高。卖出期权最佳时机", color: "green" },
        ],
        dontTrust: "IV Rank只跟自己的历史比——一只永远高IV的股票(如GME)，IV Rank=50≠便宜。IV Percentile比IV Rank更准确。",
      },
      OPT_IV_PERCENTILE: {
        name: "IV分位数(IV Percentile)",
        emoji: "📉",
        oneliner: "当前IV超过历史多少天——比IV Rank更精确",
        description: "过去1年中IV比当前低的天数占比。IV Percentile>90=IV极度高昂。比IV Rank更精确（不受极值影响）。",
        ranges: [
          { condition: "IV Pct<20", meaning: "IV低——便宜。通常牛市特征", color: "yellow" },
          { condition: "IV Pct 20-70", meaning: "正常", color: "neutral" },
          { condition: "IV Pct>90", meaning: "IV极度高——强烈恐慌/不确定性。卖期权窗口", color: "green" },
        ],
      },
      OPT_PCR: {
        name: "看跌/看涨比(PCR)",
        emoji: "⚖️",
        oneliner: "Put成交量÷Call成交量——恐慌/贪婪的最纯粹指数",
        description: "PCR(成交量)>1=Put比Call多=市场在买保险=恐慌。PCR<0.5=Call远比Put多=贪婪。极端PCR是最可靠的反向指标之一。",
        ranges: [
          { condition: "PCR>1(恐慌)", meaning: "过度看空——市场极度恐惧。历史上常是买入机会", color: "green" },
          { condition: "PCR 0.5-1", meaning: "正常——多空均衡", color: "neutral" },
          { condition: "PCR<0.4(贪婪)", meaning: "过度乐观——Call泛滥。历史上常在顶部附近", color: "red" },
        ],
        dontTrust: "PCR是成交量加权而非持仓量加权——Call的交易量天然>Put(散户爱买Call)。用持仓PCR更有意义，但数据难获取。",
      },
      OPT_GAMMA_EXPOSURE: {
        name: "Gamma暴露(GEX)",
        emoji: "📐",
        oneliner: "做市商的Gamma头寸——他们在压制波动还是放大波动？",
        description: "做市商(卖方)的Gamma净头寸。正Gamma大=做市商高抛低吸→压制波动=股市稳定。负Gamma=做市商追涨杀跌→放大波动=可能崩盘。",
        ranges: [
          { condition: "GEX正且大", meaning: "做市商在稳定市场——波动率被压制", color: "green" },
          { condition: "GEX接近0", meaning: "中性", color: "neutral" },
          { condition: "GEX负且绝对值大", meaning: "加速器模式——突破关键位时波动会爆炸", color: "red" },
        ],
      },
      OPT_SKEW: {
        name: "波动率偏度(Skew)",
        emoji: "↗️",
        oneliner: "OTM Put比OTM Call贵多少——市场在赌向下还是向上",
        description: "偏度=(25 Delta Put IV - 25 Delta Call IV)/ATM IV。>0=Put溢价>Call=市场买更多下行保护=偏空。<0=Call溢价>Put=市场更担心错过上涨。",
        ranges: [
          { condition: "Skew趋平(下降)", meaning: "恐慌消退——风险偏好回归", color: "green" },
          { condition: "Skew正常", meaning: "正常尾部定价", color: "neutral" },
          { condition: "Skew飙升", meaning: "市场在狂买Put——恐慌/对冲需求飙升", color: "red" },
        ],
        dontTrust: "Skew受分红影响——除息日前Put IV被夸大，与市场恐慌无关。需要分红调整后再看。",
      },
      OPT_TERM_STRUCTURE: {
        name: "波动率期限结构",
        emoji: "📅",
        oneliner: "近期vs远期IV的价差——市场最怕的是现在还是未来",
        description: "近期IV-远期IV。>0=近期IV>远期=现货市场恐慌(in backwardation)。<0=近期IV<远期=正常(contango)。Backwardation是恐慌信号。",
        ranges: [
          { condition: "Contango(远期>近期)", meaning: "正常——未来不确定性>现在", color: "green" },
          { condition: "平", meaning: "中性", color: "neutral" },
          { condition: "Backwardation(近期>远期)", meaning: "恐慌——市场最担心的是现在", color: "red" },
        ],
      },
      OPT_VOL_RISK_PREMIUM: {
        name: "波动率风险溢价(VRP)",
        emoji: "🎯",
        oneliner: "IV比RV贵多少——为波动率不确定性支付的溢价",
        description: "VRP = ATM IV - 实现波动率。正值=IV>RV=卖出波动率有利可图。负值=IV<RV=实际波动比隐含大=买入波动率更好。",
        ranges: [
          { condition: "VRP>3%", meaning: "IV显著溢价——卖出波动率有利", color: "green" },
          { condition: "VRP 0-3%", meaning: "正常溢价", color: "neutral" },
          { condition: "VRP<0", meaning: "RV>IV——实际波动远超预期。Gamma squeeze条件", color: "red" },
        ],
      },
      OPT_PUT_WALL: {
        name: "Put墙",
        emoji: "🧱",
        oneliner: "哪个行权价Put持仓最重——市场的最大支撑位",
        description: "查找最大Put OI的行权价。该价位=做市商Gamma对冲的最高密度=天然支撑/阻力。接近时波动率异常低。",
        ranges: [
          { condition: "价格在上方+Put墙稳固", meaning: "有强力下行保护", color: "green" },
          { condition: "价格接近Put墙", meaning: "关键争夺——跌破则失去支撑", color: "yellow" },
          { condition: "价格跌破Put墙", meaning: "支撑失效——可能加速下跌", color: "red" },
        ],
      },
      OPT_CALL_WALL: {
        name: "Call墙",
        emoji: "🚧",
        oneliner: "最大Call持仓价位——市场的自然阻力",
        description: "最大Call OI的行权价。Call墙以上=做市商对冲需要卖股票=向上阻力。突破Call墙需要极端强力催化。",
        ranges: [
          { condition: "价格接近Call墙", meaning: "面临阻力——需强力催化才能突破", color: "yellow" },
          { condition: "突破Call墙", meaning: "轧空——做市商被迫追买=加速上涨", color: "green" },
        ],
      },
      OPT_MAX_PAIN: {
        name: "最大痛点(Max Pain)",
        emoji: "🎯",
        oneliner: "期权卖方总损失最小的价位——到期日前引力点",
        description: "使所有期权买方总损失最大的行权价=做市商最想看到的价格。到期日前最后几天，股价有向Max Pain收敛的趋势(不是必然)。",
        ranges: [
          { condition: "股价远离Max Pain", meaning: "到期前可能被拉回——但无保证", color: "yellow" },
          { condition: "股价=Max Pain", meaning: "做市商最舒服——市场在当前位置平衡", color: "neutral" },
        ],
        dontTrust: "Max Pain是相关性不是因果——股价向Max Pain收敛可能只是因为时间价值和delta对冲的自然结果，不是做市商在'操控'。",
      },
      OPT_VOLUME_SPIKE: {
        name: "期权量异常放大",
        emoji: "🔔",
        oneliner: "某股票的期权成交量突然异常放大——有人在赌大的",
        description: "期权成交量÷20日平均>5倍=异常。通常是重大事件(财报/并购/FDA决议)前的信息泄露或大资金布局。",
        ranges: [
          { condition: "成交量/均值=正常", meaning: "无特别信号", color: "neutral" },
          { condition: "成交量/均值>5倍+Call为主", meaning: "大资金赌上涨——跟随需谨慎", color: "green" },
          { condition: "成交量/均值>5倍+Put为主", meaning: "大资金赌下跌或对冲——警惕", color: "red" },
        ],
      },
      OPT_DARK_POOL: {
        name: "暗池期权活动",
        emoji: "🌑",
        oneliner: "不在公开交易所成交的大宗期权——机构的隐藏赌注",
        description: "暗池/大宗期权交易量占比。占比突然上升=机构在悄悄建立大仓位——不想让市场看到。",
        ranges: [
          { condition: "暗池正常", meaning: "无异常", color: "neutral" },
          { condition: "暗池占比突然>50%", meaning: "机构在悄悄布局——方向可能跟随大单", color: "green" },
        ],
      },
      OPT_VANNA: {
        name: "Vanna效应",
        emoji: "🌀",
        oneliner: "Delta对IV变化的敏感度——做市商被迫共振交易",
        description: "Vanna = dDelta/dVol。当股价移动+IV变化时，做市商的delta对冲需求会产生正反馈。高Vanna环境=市场自增强=波动率聚集。",
        ranges: [
          { condition: "Vanna接近0", meaning: "Gamma主导——正常对冲", color: "neutral" },
          { condition: "Vanna绝对值大", meaning: "正反馈启动——波动容易自我放大", color: "red" },
        ],
      },
      OPT_SWEEP: {
        name: "Sweep订单检测",
        emoji: "💨",
        oneliner: "大量按市价吃掉流动性的期权大单——急迫的聪明钱",
        description: "期权Sweep(按Ask成交的大单) vs 限价单的比例。Sweep占比>50%=有人非常急迫地建立仓位(不讨价还价)。通常是有信息优势。",
        ranges: [
          { condition: "Sweep=Call+大单", meaning: "机构在急买看涨——通常有催化剂", color: "green" },
          { condition: "Sweep=Put+大单", meaning: "机构在急买保护——可能的坏消息", color: "red" },
        ],
      },
      OPT_VEGA_EXPOSURE: {
        name: "全市场Vega暴露",
        emoji: "📏",
        oneliner: "所有期权头寸对IV变化的敏感度——市场波动预期",
        description: "S&P 500全部期权的Vega总暴露。Vega正=做市商卖了很多期权=希望IV下降。Vega负=做市商买了很多期权=IV上升他们在赚钱。",
        ranges: [
          { condition: "Vega暴露正常", meaning: "做市商头寸平衡", color: "neutral" },
          { condition: "做市商极负Vega", meaning: "做市商大量卖期权——IV上升他们巨亏=可能引发波动率事件", color: "red" },
        ],
      },
    },
  },

  // ══════════════════════════════════════════════════════
  // PART D: 固定收益因子 10项
  // ══════════════════════════════════════════════════════

  fixedIncome: {
    sectionTitle: "🏦 固定收益因子",
    sectionSubtitle: "债券市场比股市聪明——收益率曲线和利差是宏观的预言家",
    factors: {
      FI_YIELD_CURVE_2S10S: {
        name: "2-10年期利差",
        emoji: "📐",
        oneliner: "10年-2年国债利差——最著名的衰退预测器",
        description: "美国10Y-2Y国债利差。<0=收益率曲线倒挂=衰退信号(领先6-18个月)。重新转正(牛陡)=衰退即将到来(rally before the storm)。",
        ranges: [
          { condition: "利差>1%+在扩大", meaning: "牛陡——经济正常扩张", color: "green" },
          { condition: "利差 0-1%", meaning: "正常——但偏低", color: "yellow" },
          { condition: "利差<0(倒挂)", meaning: "强烈衰退信号——历史上领先6-18个月", color: "red" },
          { condition: "从倒挂回到正(重新陡峭化)", meaning: "衰退确认近在咫尺——降息已开始", color: "red" },
        ],
        dontTrust: "倒挂后不一定会衰退（2023-2024就是软着陆），但倒挂后必然降息。利差判断的是降息概率不是衰退概率。",
      },
      FI_YIELD_CURVE_3M10Y: {
        name: "3M-10年期利差",
        emoji: "📏",
        oneliner: "美联储最关注的利差——比2-10更精准的衰退预测",
        description: "10年期-3个月国库券利差。Powell明确表示这是美联储官方衰退预测模型的核心输入。倒挂时点与2s10s接近但噪声更低。",
        ranges: [
          { condition: "利差>0.5%", meaning: "正常", color: "green" },
          { condition: "利差 0-0.5%", meaning: "接近倒挂——警惕", color: "yellow" },
          { condition: "利差<0", meaning: "倒挂——Fed官方衰退模型触发", color: "red" },
        ],
      },
      FI_IG_SPREAD: {
        name: "投资级信用利差",
        emoji: "💼",
        oneliner: "IG公司债vs国债的利差——优质企业的融资压力",
        description: "Bloomberg US IG Corp OAS. <100bp=healthy. >200bp=tight. 300bp=crisis.",
        ranges: [
          { condition: "OAS<100bp", meaning: "信贷市场极度健康——企业融资容易", color: "green" },
          { condition: "OAS 100-150bp", meaning: "正常", color: "neutral" },
          { condition: "OAS>200bp", meaning: "信贷紧缩——企业融资成本大幅上升", color: "red" },
        ],
      },
      FI_HY_SPREAD: {
        name: "高收益信用利差",
        emoji: "🗑️",
        oneliner: "垃圾债的额外收益率——违约恐惧的温度计",
        description: "彭博美国高收益公司债OAS。300-400bp=正常。>600bp=恐慌。>1000bp=危机(2008年2200bp)。垃圾债利差是比VIX更准的恐慌指标。",
        ranges: [
          { condition: "OAS<350bp", meaning: "极度宽松——市场毫无恐惧(本身就是风险)", color: "yellow" },
          { condition: "OAS 350-500bp", meaning: "正常", color: "neutral" },
          { condition: "OAS>600bp", meaning: "恐惧——信贷紧缩。高杠杆企业危在旦夕", color: "red" },
        ],
        dontTrust: "HY利差低位(300bp)不是好事——极度宽松通常意味着投资者在追逐收益、忽略风险。HY利差最低的时候往往就是最大的风险累积期。",
      },
      FI_TIPS_BREAKEVEN: {
        name: "盈亏平衡通胀率",
        emoji: "🏷️",
        oneliner: "TIPS收益率vs国债——市场隐含的通胀预期",
        description: "10年期国债收益率 - TIPS收益率 = 市场对未来10年CPI的预期。2-2.5%=正常。>3%=通胀预期失控。<1%=通缩预期。",
        ranges: [
          { condition: "BE 2-2.5%", meaning: "稳定通胀预期——央行最满意", color: "green" },
          { condition: "BE>3%", meaning: "通胀预期漂移向上——央行可能更鹰派", color: "red" },
          { condition: "BE<1.5%", meaning: "通缩预期——经济非常差", color: "red" },
        ],
      },
      FI_DURATION_RISK: {
        name: "久期风险溢价",
        emoji: "⏱️",
        oneliner: "长期国债比短期多给你多少收益率——对利率风险的补偿",
        description: "ACM/Term Premia模型的10年期期限溢价。>0=市场要求正溢价持有长期债券。<0=市场在压平曲线(美联储硬着陆预期)。",
        ranges: [
          { condition: "期限溢价>0.5%", meaning: "市场看多长期利率——经济好+通胀粘性", color: "yellow" },
          { condition: "期限溢价 0-0.5%", meaning: "正常", color: "neutral" },
          { condition: "期限溢价<0", meaning: "市场预期Fed将大幅降息——强烈衰退预期", color: "red" },
        ],
      },
      FI_MBS_SPREAD: {
        name: "MBS利差",
        emoji: "🏠",
        oneliner: "机构MBS vs 国债——美国房贷市场的温度",
        description: "30年期机构MBS(房利美/房地美)OAS vs国债。<30bp=正常。>50bp=房贷市场承压(利率波动大或房市出问题)。2008年利差飚至200bp+。",
        ranges: [
          { condition: "OAS<30bp", meaning: "房贷市场健康——利率稳定", color: "green" },
          { condition: "OAS>50bp", meaning: "房贷市场压力——波动率/提前偿还/信用问题", color: "red" },
        ],
      },
      FI_EMBIG_SPREAD: {
        name: "新兴市场主权利差",
        emoji: "🌍",
        oneliner: "新兴国家借美元比美国贵多少——全球风险偏好",
        description: "EMBIG(新兴市场债券指数全球)利差。>400bp=新兴市场压力大。>700bp=系统性新兴市场危机(2020年3月=750bp)。<200bp=极度宽松。",
        ranges: [
          { condition: "EMBIG<250bp", meaning: "全球Risk-On——资金涌入新兴市场", color: "green" },
          { condition: "EMBIG 250-400bp", meaning: "正常", color: "neutral" },
          { condition: "EMBIG>500bp", meaning: "新兴市场抛售——撤资+货币贬值压力", color: "red" },
        ],
      },
      FI_SOV_CDS: {
        name: "主权CDS利差",
        emoji: "🛡️",
        oneliner: "为国债违约买保险的成本——主权信用的最纯粹定价",
        description: "5年期主权CDS利差(bp)。<50bp=极安全(美国/德国/日本)。>200bp=投资级下限。>500bp=困境(土耳其/阿根廷)。>1000bp=违约边缘。",
        ranges: [
          { condition: "CDS<100bp", meaning: "投资级——主权信用健康", color: "green" },
          { condition: "CDS 100-300bp", meaning: "高收益级——信用存疑", color: "yellow" },
          { condition: "CDS>300bp", meaning: "困境级——违约概率显著", color: "red" },
        ],
        dontTrust: "CDS市场流动性极差（做市商少）。大幅波动可能只是流动性问题而非信用恶化。2008年后银行退出了CDS做市，现在CDS信号质量不如危机前。",
      },
      FI_REAL_YIELD: {
        name: "实际利率",
        emoji: "💎",
        oneliner: "剔除通胀后的真实借贷成本——一切资产定价的真正锚",
        description: "经通胀调整的国债收益率(用TIPS收益率)。实际利率>0=货币真的在收紧(不只看名义)。实际利率从负转正=对成长/科技股最致命的打击。",
        ranges: [
          { condition: "实际利率<0", meaning: "刺激性——利好风险资产(成长股/黄金)", color: "green" },
          { condition: "实际利率 0-1%", meaning: "中性偏紧", color: "neutral" },
          { condition: "实际利率>1.5%", meaning: "紧缩——现金有正向价值=对一切风险资产不利", color: "red" },
        ],
      },
    },
  },

  // ── 工具方法 ──
  getEsgCategory(cat: 'environmental'|'social'|'governance') {
    return this.esg[cat];
  },
  getAllEsgFactors() {
    const all: Record<string,any> = {};
    for (const cat of ['environmental','social','governance'] as const) {
      Object.assign(all, this.esg[cat].factors);
    }
    return all;
  },
  getAllAlternativeFactors() {
    return [
      ...this.alternativeData.satellite,
      ...this.alternativeData.geolocation,
      ...this.alternativeData.transaction,
      ...this.alternativeData.socialMedia,
      ...this.alternativeData.esgAlt,
      ...this.alternativeData.macroAlt,
    ];
  },
  getOptionsFactor(id: string) {
    return this.options.factors?.[id as keyof typeof this.options.factors] ?? null;
  },
  getFixedIncomeFactor(id: string) {
    return this.fixedIncome.factors?.[id as keyof typeof this.fixedIncome.factors] ?? null;
  },
  getCount() {
    const esg = Object.keys(this.getAllEsgFactors()).length;
    const alt = this.getAllAlternativeFactors().length;
    const opt = Object.keys(this.options.factors).length;
    const fi = Object.keys(this.fixedIncome.factors).length;
    return { esg, alt, opt, fi, total: esg + alt + opt + fi };
  },
};

export default ESG_70_FACTOR_COPY;
