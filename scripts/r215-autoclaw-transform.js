// R215 autoclaw transform — P10 (altData +15) + P11 (healthCheck +23)
const fs = require('fs');

const filePath = 'c:\\Users\\vx107\\.easyclaw\\workspace\\quant-moo\\electron\\engine\\strategies\\factor-strategy-templates.ts';
let src = fs.readFileSync(filePath, 'utf-8');
let changes = 0;

// ═══════════════════════════════════════════════════════════════════════════
// P10: ALT data unlock 27%→60% — add FACTOR_ALT_DATA_UNLOCK to 15 templates
// Target: 12→27 = 61% of 44
// ═══════════════════════════════════════════════════════════════════════════

const altDataAdditions = {
  'crypto-eth-btc-rotation':    'ETH链上Gas费+稳定币供应+DeFi TVL替代数据',
  'crypto-funding-arbitrage':   '交易所BTC储备+稳定币流入/流出替代数据',
  'crypto-futures-spot-arb':    '期货持仓量+多空比+清算热力图替代数据',
  'hk-southbound-tracker':      '港股通北向资金+港交所CCASS持仓替代数据',
  'hk-dividend-ladder':         '港股派息日历+大股东增减持替代数据',
  'jp-jpx-value-repair':        '东京证交所披露数据+外资持股变动替代数据',
  'au-asx-resource-franking':   '澳洲港口出货量+矿山生产报告替代数据',
  'in-nse-inflation-hedge':     '印度CPI成分价格+季风降雨替代数据',
  'ai-momentum-chaser':         '跨市场资金流+社交媒体情绪替代数据',
  'ai-value-hunter':            '13F机构持仓+内幕交易披露替代数据',
  'ai-timing-oracle':           '期权订单流+暗池交易量替代数据',
  'ai-stock-screener':          '招聘数据+APP下载量+信用卡消费替代数据',
  'xm-fx-hedge':                '央行利率预期+跨境资金流替代数据',
  'xm-rate-spread':             '各国CPI/PPI+贸易余额替代数据',
  'xm-commodity-pair':          '港口库存+航运指数+天气预测替代数据',
};

const altEntry = (desc) =>
  `    { id: 'alt-data', label: '替代数据', touchpointId: 'FACTOR_ALT_DATA_UNLOCK', costUSDT: 2, description: '${desc}' },`;

for (const [templateId, description] of Object.entries(altDataAdditions)) {
  // Insert alt-data entry as first item in aiTriggerPoints array
  const regex = new RegExp(`(id:\\s*'${templateId}'[\\s\\S]*?aiTriggerPoints:\\s*\\[)\\s*\\n`);
  const before = src;
  src = src.replace(regex, `$1\n${altEntry(description)}\n`);
  if (src !== before) changes++;
  else console.log(`WARNING: altData — no match for ${templateId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// P11: Health check 18%→70% — add AI_HEALTH_CHECK to 23 templates
// Target: 8→31 = 70% of 44
// ═══════════════════════════════════════════════════════════════════════════

const healthCheckAdditions = {
  'crypto-btc-trend':           'BTC趋势策略月度健康体检: IC>0.02? 因子相关性<0.7?',
  'crypto-eth-btc-rotation':    'ETH/BTC轮动策略健康检查: 轮动信号准确率>60%?',
  'crypto-funding-arbitrage':   '资金费率套利健康: 套利空间持续存在? 执行成功率>90%?',
  'crypto-futures-spot-arb':    '期现套利健康: 价差>交易成本? IC持续为正?',
  'hk-ah-premium':              'AH溢价策略健康: 价差仍在历史区间? 套利窗口>1%?',
  'hk-southbound-tracker':      '南向资金策略健康: 资金流向趋势延续? IC>0.03?',
  'hk-redchip-homecoming':      '红筹回A策略健康: 回A进度正常? 价差合理?',
  'jp-jpx-value-repair':        'JPX价值修复健康: 价值因子溢价持续? 公司治理改善?',
  'kr-krx-momentum':            'KRX动量策略健康: 动量因子IC>0? 换手率合理?',
  'kr-krx-export-cycle':        'KRX出口周期健康: 出口数据与股价相关性稳定?',
  'tw-twse-electronic-exdiv':   'TWSE除权息健康: 填息率>70%? 因子稳定性?',
  'au-asx-resource-franking':   'ASX资源策略健康: 大宗商品与股价相关性? Franking信用?',
  'in-nse-it-outsourcing':      'NSE IT外包健康: IT支出趋势延续? 汇率影响可控?',
  'in-nifty50-rotation':        'Nifty50轮动健康: 因子轮动超额>基准? IC>0?',
  'in-nse-inflation-hedge':     'NSE通胀对冲健康: 通胀敏感度稳定? 因子有效性?',
  'eu-stoxx-esg-premium':       'STOXX ESG健康: ESG评级变动趋势? 碳价影响?',
  'hk-ipo-flip':                'IPO打新健康: 首日涨幅分布正常? 市场热度?',
  'hk-short-squeeze':           '沽空挤压健康: 沽空比例正常? 挤压概率合理?',
  'ai-momentum-chaser':         'AI动量策略月度体检: 各因子IC衰减? 过拟合风险?',
  'ai-timing-oracle':           'AI择时策略健康: 信号准确率>55%? 各维度贡献?',
  'ai-stock-screener':          'AI选股策略健康: 月胜率>55%? 因子暴露漂移?',
  'xm-fx-hedge':                '外汇对冲健康: 对冲有效性>80%? 成本合理?',
  'xm-commodity-pair':          '商品配对健康: 价差均值回归速度? 季节性稳定?',
};

const hcEntry = (desc) =>
  `    { id: 'health-check', label: 'AI健康检查', touchpointId: 'AI_HEALTH_CHECK', costUSDT: 1, description: '${desc}' },`;

for (const [templateId, description] of Object.entries(healthCheckAdditions)) {
  const regex = new RegExp(`(id:\\s*'${templateId}'[\\s\\S]*?aiTriggerPoints:\\s*\\[)\\s*\\n`);
  const before = src;
  src = src.replace(regex, `$1\n${hcEntry(description)}\n`);
  if (src !== before) changes++;
  else console.log(`WARNING: healthCheck — no match for ${templateId}`);
}

// Write back
fs.writeFileSync(filePath, src, 'utf-8');
console.log(`Applied ${changes} transformations.`);
console.log(`ALT: target=27, got ${(src.match(/FACTOR_ALT_DATA_UNLOCK/g) || []).length}`);
console.log(`HEALTH: target=31, got ${(src.match(/AI_HEALTH_CHECK/g) || []).length}`);
console.log(`Lines: ${src.split('\n').length}`);
