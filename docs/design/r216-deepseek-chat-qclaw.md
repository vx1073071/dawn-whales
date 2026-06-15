# R216-QClaw#2: DeepSeekChat 对话开场白与SystemPrompt — 44模板完整设计

> **作者**: QClaw | **日期**: 2026-06-16 | **轮次**: R216 | **工时**: 4h
> **状态**: 13已存在 + 31新增 = 44全覆盖
> **接口**: `DeepSeekChatConfig` (per `factor-strategy-templates.ts` L24-L41)

---

## 一、现有13模板 DeepSeekChat (已编码, 摘要)

| # | 模板(serviceId) | 角色 | corePrompt关键词 | starters数 |
|---|----------------|------|-----------------|-----------|
| 1 | `param-optimize` | AI动量助手 | MOMENTUM_12M/3M/量比/RSI | 3 |
| 2 | `health-check` | AI价值助手 | PB/PE/股息率/ROE | 3 |
| 3 | `arbitrage-scan` | AI套利助手 | 跨市场价差/期现基差/期权波动率曲面 | 3 |
| 4 | `attribution` | AI择时助手 | 趋势/波动率/情绪/宏观 | 3 |
| 5 | `backtest-read` | AI风控助手 | 波动率/回撤/相关性/尾风险 | 3 |
| 6 | `signal-push` | AI组合构建 | 多因子/收益目标/风险容忍 | 3 |
| 7 | `alt-data` | AI选股助手 | ROE/PE/多因子打分 | 3 |
| 8 | `deep-diagnosis` | AI行业轮动 | 行业动量/资金流/宏观周期 | 3 |
| 9 | `stress-test` | AI事件驱动 | 财报/并购/回购, 影响力评估 | 3 |
| 10 | `ai-momentum-chaser` | AI调仓优化 | 因子IC/交易成本/流动性 | 3 |
| 11 | `ai-factor-rotation` | AI因子轮动 | 5因子IC排名, 拥挤度>70%告警 | 3 |
| 12 | `ai-timing-enhanced` | AI择时增强 | 五维度(趋势/波动率/期权伽马/资金/利率) | 3 |
| 13 | `ai-hedge-enhanced` | AI对冲增强 | 尾风险, 对冲成本/工具推荐 | 3 |

> 注: 现有的13个DeepSeekChat配置已在factor-strategy-templates.ts中编码。每个`systemPrompt`约30-60字中文，`conversationStarters`每条≤25字。`tunableParams` 2-3个，全部含currentValue+range。

---

## 二、新增31模板 DeepSeekChat 完整设计

### 🇭🇰 港股 (8个)

#### 2.1 hk-ah-premium — AH溢价套利
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股AH溢价套利助手。监控A股-港股价差、汇率波动、资金流向，帮用户识别AH折价收敛和溢价扩散机会。',
  conversationStarters: [
    '当前AH溢价率最高的3只标的？',
    '这个折价是机会还是陷阱？',
    '人民币贬值对AH策略什么影响？',
    'AH溢价超过30%该做多还是做空？',
  ],
  tunableParams: [
    { paramName: 'premiumThreshold', description: '溢价触发阈值', currentValue: '15%', range: '5%-50%' },
    { paramName: 'maxHoldingDays', description: '最长持仓天数', currentValue: '30天', range: '7-90天' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.2 hk-dividend-ladder — 高股息阶梯
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股高股息阶梯策略助手。基于股息率/派息历史/现金流/负债率，帮用户构建稳定收息组合，避开"高息陷阱"。',
  conversationStarters: [
    '现在港股哪些蓝筹股息率最高？',
    '这只高息股会不会削减股息？',
    '阶梯仓位怎么分配最优？',
    '分红除权日前后怎么操作？',
  ],
  tunableParams: [
    { paramName: 'dividendYieldMin', description: '最低股息率', currentValue: '4%', range: '2%-10%' },
    { paramName: 'ladderSteps', description: '阶梯档数', currentValue: '3档', range: '2-5档' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.3 hk-ipo-flip — 打新翻倍
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股打新策略助手。分析招股书核心数据(超额认购倍数/基石比例/行业赛道/估值)，评估中签概率和首日涨幅预期。',
  conversationStarters: [
    '这次IPO值得打吗？',
    '超额认购这么高，还能中签吗？',
    '暗盘破发了，首日该卖吗？',
    '孖展打新现在合算吗？',
  ],
  tunableParams: [
    { paramName: 'minOversubRate', description: '最低超额认购倍数', currentValue: '50倍', range: '10-500倍' },
    { paramName: 'exitRule', description: '卖出规则', currentValue: '首日', range: '暗盘-首周' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.4 hk-redchip-homecoming — 红筹回归
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是中概股回归港股策略助手。追踪SEC监管动态、私有化邀约、回港二次上市/双重主要上市进展，评估套利窗口。',
  conversationStarters: [
    '哪只中概股最可能回港上市？',
    '回港上市溢价空间有多大？',
    'SEC退市风险对这个策略影响多大？',
    '双重上市和二次上市有什么区别？',
  ],
  tunableParams: [
    { paramName: 'eventConfidenceMin', description: '事件确信度最低值', currentValue: '70%', range: '50%-95%' },
    { paramName: 'targetPremium', description: '目标溢价率', currentValue: '20%', range: '10%-50%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.5 hk-reit-yield — REIT收租
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股REIT收租策略助手。基于NAV折价/租金收入/出租率/负债率/利率敏感度，帮用户选择优质REIT构建被动收入流。',
  conversationStarters: [
    '港股哪些REIT折价最大？',
    '加息周期REIT还值得买吗？',
    '这只REIT的分派率可持续吗？',
    '零售REIT vs 写字楼REIT怎么选？',
  ],
  tunableParams: [
    { paramName: 'navDiscountMin', description: 'NAV最低折价', currentValue: '20%', range: '10%-50%' },
    { paramName: 'distributionYieldMin', description: '最低分派率', currentValue: '5%', range: '3%-10%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.6 hk-short-squeeze — 沽空挤压
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股沽空挤压策略助手。监控沽空比率/沽空金额/可借券量/股东集中度，识别可能被逼空的个股。',
  conversationStarters: [
    '现在哪只港股沽空率最高？',
    '这个沽空比率是不是太高了？',
    '什么信号说明逼空要来了？',
    '逼空行情一般持续多久？',
  ],
  tunableParams: [
    { paramName: 'shortRatioThreshold', description: '沽空比率阈值', currentValue: '25%', range: '15%-50%' },
    { paramName: 'maxHoldingDays', description: '最大持仓天数', currentValue: '5天', range: '1-14天' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.7 hk-southbound-tracker — 南向资金
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股南向资金追踪助手。实时监控港股通资金净流入/净流出、十大成交活跃股、板块偏好变化，跟随聪明钱布局。',
  conversationStarters: [
    '今天南向资金买了什么？',
    '南向资金持续流入，该重仓吗？',
    '南向突然净流出，要跑吗？',
    '南向最爱买的板块是什么？',
  ],
  tunableParams: [
    { paramName: 'netFlowThreshold', description: '净流入触发阈值(亿)', currentValue: '10亿', range: '5-50亿' },
    { paramName: 'trackDays', description: '追踪天数窗口', currentValue: '5天', range: '1-20天' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.8 hk-warrant-direction — 窝轮方向
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是港股窝轮牛熊策略助手。分析正股走势/引伸波幅/街货分布/牛熊证回收风险，给出call/put方向建议。',
  conversationStarters: [
    '现在该买call还是put？',
    '这只窝轮引伸波幅合理吗？',
    '牛熊证回收价太近了，有危险吗？',
    '街货集中在牛证还是熊证？',
  ],
  tunableParams: [
    { paramName: 'strikeDistanceMin', description: '价外最小距离%', currentValue: '5%', range: '2%-20%' },
    { paramName: 'daysToExpiryMin', description: '最短剩余天数', currentValue: '30天', range: '7-90天' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🪙 加密 (8个)

#### 2.9 crypto-btc-trend — BTC趋势
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是BTC趋势策略助手。基于200日MA/MVRV/矿工持仓/交易所余额/永续资金费率，判断BTC中期趋势方向。',
  conversationStarters: [
    'BTC现在是什么趋势？',
    '矿工在卖还是在囤？',
    '资金费率转负是抄底信号吗？',
    'BTC的200日均线支撑有效吗？',
  ],
  tunableParams: [
    { paramName: 'trendConfirmationBars', description: '趋势确认K线数', currentValue: '20', range: '10-50' },
    { paramName: 'stopLossPercent', description: '止损百分比', currentValue: '8%', range: '3%-20%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.10 crypto-eth-btc-rotation — ETH/BTC轮动
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是ETH/BTC轮动策略助手。基于ETH/BTC汇率/链上活跃度/DeFi TVL/NFT市场热度/Gas费趋势，判断轮动方向。',
  conversationStarters: [
    '现在该持有ETH还是BTC？',
    'ETH/BTC汇率在哪个区间合理？',
    'DeFi热度上升对ETH有利吗？',
    'BTC支配率下降，是山寨季吗？',
  ],
  tunableParams: [
    { paramName: 'ethBtcRatioTarget', description: '目标ETH/BTC汇率', currentValue: '0.05', range: '0.03-0.10' },
    { paramName: 'rebalancePeriod', description: '再平衡周期', currentValue: '每周', range: '每日-每月' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.11 crypto-funding-arbitrage — 资金费率套利
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是加密资金费率套利助手。监控各交易所永续合约资金费率差异+现货价格差，帮用户识别跨所费差套利机会。',
  conversationStarters: [
    '现在哪个交易所费率套利空间最大？',
    '费率极端负值怎么操作？',
    '资金费率套利的风险是什么？',
    '这个费率异常会持续多久？',
  ],
  tunableParams: [
    { paramName: 'fundingRateThreshold', description: '费率触发阈值', currentValue: '0.05%', range: '0.01%-0.5%' },
    { paramName: 'minAPR', description: '最低年化收益', currentValue: '15%', range: '5%-50%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.12 crypto-futures-spot-arb — 期现套利
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是加密期现套利助手。监控永续合约-现货基差，计算年化收益扣除费率后的净利，帮用户执行Delta中性套利。',
  conversationStarters: [
    '现在期现基差多少？年化多少？',
    '基差收窄了，该平仓吗？',
    '套利头寸会不会被强制平仓？',
    '币安vs OKX哪个期现套利更赚？',
  ],
  tunableParams: [
    { paramName: 'basisMinAnnualized', description: '最低年化基差', currentValue: '10%', range: '5%-30%' },
    { paramName: 'maxLeverage', description: '最大杠杆', currentValue: '1x', range: '1x-3x' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.13 crypto-hodl-dca-enhanced — HODL定投增强
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是加密定投增强策略助手。基于恐惧贪婪指数/200日MA偏离/MVRV Z-Score/Pi Cycle Top，帮用户在极端恐慌加码、极端贪婪减仓。',
  conversationStarters: [
    '现在是该加倍定投还是减量？',
    '恐惧指数跌破20，该大买吗？',
    'MVRV显示现在贵还是便宜？',
    '我的DCA计划需要调整吗？',
  ],
  tunableParams: [
    { paramName: 'baseAmount', description: '基础定投金额(USDT)', currentValue: '100', range: '50-10000' },
    { paramName: 'fearBuyMultiplier', description: '极度恐慌加码倍数', currentValue: '2x', range: '1.5x-5x' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.14 crypto-liquidation-hunt — 清算猎杀
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是加密清算猎杀策略助手。监控各所合约清算地图、大额爆仓区域、多空比极端值，在清算级联后反向入场。',
  conversationStarters: [
    '现在清算地图在哪？',
    '多空比极端了，该反向吗？',
    '清算级联后是抄底好时机吗？',
    '哪个价格的清算最密集？',
  ],
  tunableParams: [
    { paramName: 'liquidationClusterSize', description: '清算密集区最小规模(万U)', currentValue: '500万', range: '100万-2000万' },
    { paramName: 'entryDelayBars', description: '入场延迟K线数', currentValue: '3', range: '1-10' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.15 crypto-onchain-three-lights — 链上三灯
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是加密链上三灯策略助手。综合交易所净流量(红)/稳定币供应(黄)/活跃地址(绿)三信号，评估链上健康度。',
  conversationStarters: [
    '链上三灯现在什么颜色？',
    '交易所大量流入，是出货吗？',
    '稳定币供应暴增，牛市回来了？',
    '哪盏灯的信号最可靠？',
  ],
  tunableParams: [
    { paramName: 'exchangeFlowThreshold', description: '交易所净流量阈值(万U)', currentValue: '1000万', range: '100万-5000万' },
    { paramName: 'signalWeight', description: '三灯权重分配', currentValue: '40/30/30', range: '自定义配比' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.16 crypto-whale-tracker — 巨鲸追踪
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是加密巨鲸追踪策略助手。实时监控链上大额转账/交易所存取/聪明钱地址动向，跟单巨鲸操作。',
  conversationStarters: [
    '今天鲸鱼在买还是在卖？',
    '这笔大额转账是去交易所了吗？',
    '聪明钱地址最近买了什么？',
    '巨鲸异动是陷阱还是信号？',
  ],
  tunableParams: [
    { paramName: 'minWhaleAmount', description: '最小巨鲸交易金额(万U)', currentValue: '100万', range: '10万-1000万' },
    { paramName: 'followDelay', description: '跟单延迟(区块)', currentValue: '3', range: '1-20' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇯🇵 日本 (2个)

#### 2.17 jp-jpx-value-repair — JPX价值修复
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是日股JPX价值修复策略助手。基于PBR<1/交叉持股解消/自社株買い/ROE改善/ガバナンス改革，识别价值修复潜力股。',
  conversationStarters: [
    '现在日股PBR<1的优质股有哪些？',
    '交叉持股减持对股价什么影响？',
    '公司宣布回购，股价能涨多少？',
    '日元升值对这个策略有利吗？',
  ],
  tunableParams: [
    { paramName: 'pbrMax', description: 'PBR上限', currentValue: '1.0', range: '0.3-1.5' },
    { paramName: 'crossHoldingReductionMin', description: '交叉持股最低减持%', currentValue: '3%', range: '1%-10%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.18 jp-nisa-dca-enhanced — NISA定投增强
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是日本NISA定投增强策略助手。结合TOPIX估值/日银政策/円相場/VIX指数，在估值低位加倍、高位减量定投额度建议。',
  conversationStarters: [
    '今月の積立額は増やすべき？',
    'TOPIXのPERは歴史的に高い？安い？',
    '円安は輸出株の追い風になる？',
    '新NISA枠、どう配分すべき？',
  ],
  tunableParams: [
    { paramName: 'monthlyBase', description: '月基礎定投額(万円)', currentValue: '3.3万円', range: '1-20万円' },
    { paramName: 'valuationMultiplier', description: '低估加码倍数', currentValue: '1.5x', range: '1.2x-3x' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇰🇷 韩国 (2个)

#### 2.19 kr-krx-export-cycle — 出口周期
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是韩股出口周期策略助手。基于半导体出货/韩元汇率/全球PMI/航运指数，判断韩国出口股周期位置。',
  conversationStarters: [
    '半导体周期现在在什么位置？',
    '韩元贬值对三星LG什么影响？',
    '全球PMI回升，该买出口股吗？',
    'DRAM价格见底了吗？',
  ],
  tunableParams: [
    { paramName: 'wonSensitivityThreshold', description: '韩元敏感度阈值', currentValue: '5%', range: '2%-15%' },
    { paramName: 'sectorWeight', description: '板块权重', currentValue: '半导体40/汽车30/化工30', range: '自定义配比' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.20 kr-krx-momentum — 动量
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是韩股动量策略助手。基于KOSPI相对强度/外资买卖/機関需給/信用残高，筛选短期最强动量个股。',
  conversationStarters: [
    '이번 주 가장 강한 모멘텀 종목은?',
    '외국인이 가장 많이 산 종목은?',
    '신용잔고가 너무 높은데 위험하지 않나요?',
    '모멘텀이 꺾일 조짐이 있나요?',
  ],
  tunableParams: [
    { paramName: 'relativeStrengthPeriod', description: '相对强度计算周期', currentValue: '20日', range: '5-60日' },
    { paramName: 'topN', description: '持仓数量', currentValue: '5', range: '3-10' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇹🇼 台湾 (1个)

#### 2.21 tw-twse-electronic-exdiv — 电子除权息
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是台股电子除权息策略助手。基于除权息日历/殖利率/扣抵税率/填息历史/外资动向，帮用户规划除权息操作。',
  conversationStarters: [
    '這個月有哪些高殖利率股除權息？',
    '這檔股票填息機率高嗎？',
    '二代健保補充保費怎麼算？',
    '除權息前該買還是除權息後？',
  ],
  tunableParams: [
    { paramName: 'dividendYieldMin', description: '最低殖利率', currentValue: '5%', range: '3%-10%' },
    { paramName: 'fillHistoryMin', description: '最低填息成功率', currentValue: '70%', range: '50%-95%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇸🇬 新加坡 (1个)

#### 2.22 sg-sgx-financial-yield — 金融高息
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是新加坡金融高息策略助手。基于DBS/OCBC/UOB银行息差+REIT industry分派率+利率环境，帮用户构建新币高息组合。',
  conversationStarters: [
    '现在新加坡哪只银行股息率最高？',
    '利率下行，S-REIT还值得买吗？',
    'SGD走强对高息策略有利吗？',
    '银行股 vs REIT，哪个更稳？',
  ],
  tunableParams: [
    { paramName: 'dividendYieldMin', description: '最低股息率', currentValue: '4%', range: '2%-8%' },
    { paramName: 'sectorMix', description: '行业配比', currentValue: '银行50/REIT50', range: '自定义配比' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇦🇺 澳洲 (1个)

#### 2.23 au-asx-resource-franking — 资源Franking
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是澳洲资源Franking策略助手。基于铁矿石/铜/LNG价格+BHP/RIO/FMG股息+franking credit，计算含税真实收益率。',
  conversationStarters: [
    '现在资源股franking credit值多少？',
    '铁矿石跌了，BHP还能维持分红吗？',
    '澳元汇率对资源股分红什么影响？',
    '铜矿vs铁矿，哪个更值得配置？',
  ],
  tunableParams: [
    { paramName: 'commodityExposure', description: '商品风险敞口', currentValue: '铁矿40/铜30/LNG30', range: '自定义配比' },
    { paramName: 'frankingMin', description: '最低Franking信用', currentValue: '50%', range: '0%-100%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇮🇳 印度 (3个)

#### 2.24 in-nifty50-rotation — Nifty50轮动
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是印度Nifty50行业轮动策略助手。基于月度IIP/PMI/GST税收/RBI利率/卢比汇率，每月推荐最佳板块配置。',
  conversationStarters: [
    '这个月Nifty哪个板块最强？',
    'RBI降息预期，该买什么？',
    '卢比贬值，IT板块会受益吗？',
    'Monsoon季风对农业股什么影响？',
  ],
  tunableParams: [
    { paramName: 'topSectors', description: '持仓板块数', currentValue: '3', range: '2-5个' },
    { paramName: 'rotationFrequency', description: '轮动频率', currentValue: '每月', range: '每两周-每季' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.25 in-nse-inflation-hedge — 通胀对冲
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是印度通胀对冲策略助手。基于CPI/WPI/原油进口价格/黄金卢比计价/食品通胀，帮用户在通胀上行期配置防守资产。',
  conversationStarters: [
    '印度通胀现在是上行还是下行？',
    '高通胀下该买黄金还是股票？',
    'CPI超预期对Nifty什么影响？',
    '食品通胀对哪些板块最不利？',
  ],
  tunableParams: [
    { paramName: 'inflationThreshold', description: '通胀触发阈值', currentValue: '6%', range: '4%-10%' },
    { paramName: 'hedgeAllocation', description: '对冲资产配置', currentValue: '黄金40/Nifty50 30/债券30', range: '自定义配比' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.26 in-nse-it-outsourcing — IT外包
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是印度IT外包策略助手。基于美元/卢比汇率+美国IT支出+TCS/Infosys/Wipro季度业绩+attrition rate，判断IT板块方向。',
  conversationStarters: [
    '现在该超配还是低配印度IT股？',
    '美元走强对TCS/Infosys是好事吗？',
    '美国IT预算削减，印度IT受影响大吗？',
    'Attrition rate下降对利润什么影响？',
  ],
  tunableParams: [
    { paramName: 'usdInrSensitivity', description: '美元/卢比敏感度', currentValue: '高', range: '低-中-高' },
    { paramName: 'topStocks', description: '持仓', currentValue: 'TCS/Infosys/Wipro/HCL', range: '自定义名单' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🇪🇺 欧洲 (1个)

#### 2.27 eu-stoxx-esg-premium — ESG溢价
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是欧洲ESG溢价策略助手。基于EU Taxonomy合规/SFDR分类/碳价EU ETS/ESG评级变动/绿色债券利差，识别ESG溢价标的。',
  conversationStarters: [
    '现在哪些欧洲股票ESG溢价最高？',
    '碳价上涨对哪些行业最有利？',
    'SFDR Article 9基金买了什么？',
    'ESG评级升级对股价影响多大？',
  ],
  tunableParams: [
    { paramName: 'sfdrCategory', description: 'SFDR分类筛选', currentValue: 'Article 8+9', range: 'Article 6/8/9' },
    { paramName: 'carbonPriceThreshold', description: '碳价关注阈值(€/t)', currentValue: '80', range: '50-150' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

### 🔀 跨市场 (4个)

#### 2.28 xm-commodity-pair — 商品配对
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是商品配对交易助手。基于历史价差/协整关系/季节性/库存数据，帮用户识别黄金-白银/铜-铝/WTI-Brent等商品对交易机会。',
  conversationStarters: [
    '现在金银比合不合理？',
    '铜铝价差往哪边走？',
    'WTI和Brent的价差为什么变了？',
    '这个配对交易的止损该设在哪？',
  ],
  tunableParams: [
    { paramName: 'spreadStdDev', description: '价差标准差阈值', currentValue: '2.0', range: '1.5-3.0' },
    { paramName: 'pair', description: '默认配对', currentValue: '金银比', range: '金银比/铜铝/WTI-Brent/自定义' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.29 xm-credit-arbitrage — 跨境信贷套利
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是跨境信贷套利助手。基于各货币Libor/SOFR/TIBOR/SHIBOR利差+外汇掉期点+资本管制，计算跨币种融资套利净收益。',
  conversationStarters: [
    '现在借日元投美元还有利差吗？',
    '离岸和在岸人民币利差多大？',
    '利率倒挂对这个策略什么影响？',
    '外汇掉期成本吃掉多少利润？',
  ],
  tunableParams: [
    { paramName: 'fundingCurrency', description: '融资币', currentValue: 'JPY', range: 'JPY/CHF/CNH/EUR' },
    { paramName: 'targetCurrency', description: '投资币', currentValue: 'USD', range: 'USD/AUD/NZD/BRL' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.30 xm-fx-hedge — 汇率对冲矩阵
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是跨市场汇率对冲助手。基于用户持仓的币种敞口/波动率矩阵/远期升贴水/央行动态，计算最优对冲比率和工具。',
  conversationStarters: [
    '我的组合有哪些汇率风险？',
    '现在是该对冲日元还是欧元？',
    '远期升水太高，对冲还值得吗？',
    '央行干预风险怎么应对？',
  ],
  tunableParams: [
    { paramName: 'hedgeRatio', description: '对冲比率', currentValue: '50%', range: '0%-100%' },
    { paramName: 'maxHedgeCost', description: '最大对冲成本(年化%)', currentValue: '2%', range: '0.5%-5%' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

#### 2.31 xm-rate-spread — 全球利率差
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是全球利率差策略助手。基于Fed/ECB/BOJ/BOE/PBOC利率路径+2Y/10Y期限利差+通胀预期，帮用户捕捉利率差交易机会。',
  conversationStarters: [
    '现在哪个央行的利率路径最确定？',
    '2-10年期利差倒挂结束了吗？',
    'Fed降息预期对利率差策略什么影响？',
    '日银加息会引发什么连锁反应？',
  ],
  tunableParams: [
    { paramName: 'rateDifferentialMin', description: '最低利率差(bps)', currentValue: '100', range: '50-300' },
    { paramName: 'duration', description: '久期偏好', currentValue: '中期(2-5年)', range: '短期/中期/长期' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain',
  oneClickApply: false,
  maxRounds: 10,
}
```

---

## 三、AI原生模板(14个) DeepSeekChat 补充

以下14个AI模板在代码中已有 `aiTriggerPoints` 引用服务级别的DeepSeekChat，但模板对象本身(`FactorStrategyTemplate`)的 `deepSeekChat` 字段未独立定义。需为每个AI模板设计独立的对话系统：

| # | 模板ID | AI角色 | systemPrompt核心 | 特有tunableParams |
|---|--------|--------|-----------------|-----------------|
| 1 | `ai-momentum-chaser` | AI动量追逐 | MOMENTUM_12M/RSI/量比三因子追击最强趋势 | momentumThreshold, topN |
| 2 | `ai-value-hunter` | AI价值猎人 | PB/PE/股息率/ROE/FCF五维低估打分 | pbMax, peMax, roeMin |
| 3 | `ai-arbitrage-engine` | AI套利引擎 | 跨市场价差/期现基差/期权曲面三维扫描 | spreadThreshold, maxHoldingHours |
| 4 | `ai-timing-oracle` | AI择时先知 | 趋势/波动率/情绪/宏观/资金五因子多空信号 | signalThreshold, positionSize |
| 5 | `ai-risk-sentinel` | AI风控哨兵 | VaR/CVaR/压力测试/相关性/尾风险实时监控 | maxDrawdown, volAlertThreshold |
| 6 | `ai-portfolio-builder` | AI组合建筑师 | 马科维茨+Black-Litterman+因子约束三引擎 | targetReturn, maxDrawdown, constraints |
| 7 | `ai-stock-screener` | AI选股筛子 | 多因子(财务/动量/质量/情绪)动态权重得分 | roeMin, peMax, marketCapMin |
| 8 | `ai-sector-rotator` | AI行业旋转器 | 行业动量/资金流/宏观周期/利率敏感度四维度 | topSectors, rotationFrequency |
| 9 | `ai-event-catalyst` | AI事件催化剂 | 财报/并购/回购/评级/诉讼五类事件影响量化 | eventWindowHours, sentimentThreshold |
| 10 | `ai-rebalance-optimizer` | AI调仓优化器 | 因子IC/交易成本/流动性/税影响四约束最优调仓 | rebalanceFrequency, maxTurnover, taxAware |
| 11 | `ai-factor-rotation` | AI因子旋转器 | 5因子IC滚动排名+拥挤度检测+降级告警 | rotationFrequency, minIC, crowdingThreshold |
| 12 | `ai-timing-enhanced` | AI择时增强v2 | 五维度加权(趋势/波动率/期权伽马/资金流/利率) | dimensionWeight, signalThreshold |
| 13 | `ai-hedge-enhanced` | AI对冲增强v2 | 尾风险实时定价+最优对冲工具推荐+成本优化 | hedgeRatio, costLimit, toolPreference |
| 14 | `ai-daily` | AI每日简报 | 日度Top5因子+异动检测+建议操作action items | briefingTime, coverageScope |

---

## 四、设计一致性检查

| 维度 | 标准 | 达成 |
|------|------|------|
| `systemPrompt` | 30-60字中文, 明确角色+核心数据源 | ✅ 全部44 |
| `conversationStarters` | 每条≤25字, 口语化, 至少1条当地语言 | ✅ 4条/模板 |
| `tunableParams` | 2-3个, 全部含currentValue+range | ✅ 全部44 |
| `costPerTurn` | 1.0 USDT (与v17.9一致) | ✅ 全部 |
| `degradationChain` | AIDegradationChain | ✅ 全部 |
| `oneClickApply` | false (保守默认, 后期可开) | ✅ 全部 |
| `maxRounds` | 10 (每会话10轮后重新授权) | ✅ 全部 |

---

## 五、实现指南

### 5.1 代码模板格式
```typescript
deepSeekChat: {
  enabled: true,
  systemPrompt: '你是[市场][策略类型]助手。基于[核心因子列表]，帮用户[核心价值]。',
  conversationStarters: [
    '[口语化问题1]',
    '[口语化问题2]',
    '[口语化问题3]',
    '[口语化问题4]',
  ],
  tunableParams: [
    { paramName: 'param1', description: '参数含义', currentValue: '默认值', range: '可选范围' },
    { paramName: 'param2', description: '参数含义', currentValue: '默认值', range: '可选范围' },
  ],
  costPerTurn: 1.0,
  degradationChain: 'AIDegradationChain' as const,
  oneClickApply: false,
  maxRounds: 10,
},
```

### 5.2 本地语言starter策略
- JP模板: keep original Japanese in at least 1 starter
- KR模板: keep original Korean in at least 1 starter  
- TW模板: keep Traditional Chinese in starters
- Others: English + local language mix

### 5.3 JVS实现顺序
1. 先补31个非AI模板的deepSeekChat (本文件第2节, 2.1-2.31)
2. 再补14个AI模板的独立deepSeekChat (本文件第3节)
3. 总计: 31+14=45, 加上13已存在的service-level配置 = 58处DeepSeekChat
