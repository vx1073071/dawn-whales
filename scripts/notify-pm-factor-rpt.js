const msg = {
  id: `autoclaw-notify-pm-${Date.now()}`,
  from: 'autoclaw',
  to: ['pm'],
  type: 'NOTIFICATION',
  timestamp: Date.now(),
  subject: '📄 因子全球竞争力审计报告已就绪',
  body: `PM，autoclaw 刚完成了一份 QUANT MOO v3.2.0 全因子/指标/形态的深度竞品审计。

对标平台: QuantConnect / TradingView / 同花顺 / 富途 / Bloomberg

报告位置:
  docs/proposals/factor-global-competitiveness-deep-polish-r275.md

一句话:
  "320因子全球最多，但MACD和Stochastic竟然没实现，11个能收费的地方全没接通。"

请查阅。`
};

require('fs').appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('PM notification sent');
