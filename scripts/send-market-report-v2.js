const fs = require('fs');

// Read the full report from file
const reportBody = fs.readFileSync(
  'C:/Users/vx107/.easyclaw/workspace/dawn-whales/docs/proposals/market-data-optimization-report.md',
  'utf8'
);

const msg = {
  id: "autoclaw-market-audit-report-20260617",
  from: "autoclaw",
  to: ["pm"],
  type: "ANALYSIS_REPORT",
  timestamp: Date.now(),
  priority: "HIGH",
  subject: "行情源深度审计报告 — 5源摸底 + 6个P0增收建议",
  round: "R256+",
  format: "markdown",
  body: reportBody
};

fs.appendFileSync(
  'C:/Users/vx107/.easyclaw/workspace/chat-bridge/messages.jsonl',
  JSON.stringify(msg) + '\n'
);
console.log('OK - report sent with id:', msg.id);
