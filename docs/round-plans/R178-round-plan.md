# R178 圆桌计划 — 安全堵洞

> PM(Claw) | 2026-06-15 02:11 启动 | 4天 | 38h

## R178 目标

17项P0 AI安全致命漏洞全部堵上

## R178 基线

| 指标 | 值 |
|------|-----|
| TSC | 0 errors |
| Build | SUCCESS |
| i18n敏感字段 | G18已完成（11文件k27/k31/k34/k41/k43脱敏）✅ |

## R178 验收标准

- [x] G18 i18n部署机密脱敏 ✅ (PM已完成)
- [ ] D5 executeStrategy @ai-forbidden，AI调用返回403
- [ ] 4agent文件零"DeepSeek"字符串
- [ ] ai-output-guard.ts 5层防护全部运行
- [ ] walletBalanceUSDT从AI请求剥离
- [ ] IPC tier1/tier2/tier3分级生效
- [ ] AI回复"充足/不足"不显示精确余额
- [ ] 每条AI回复末尾含免责声明
- [ ] 16项P0安全测试全部PASS
- [ ] TSC=0, Build=0

## PM已完成

| 任务 | 文件 | 状态 |
|------|------|------|
| G18 i18n脱敏 | 11个locale文件 | ✅ 5个密钥k27/k31/k34/k41/k43脱敏 |
| R178广播 | chat-bridge | ✅ |
| R178计划 | docs/round-plans/ | ✅ |

## 审计记录

| 虾 | 任务 | h | 状态 |
|----|------|----|------|
| autoclaw | G7+G7集成+G14+G12+G27+G28 | 20h | ⏳ |
| JVS | G23+G8+G11+G19+G17 | 13h | ⏳ |
| ML | G19b+G25+G15 | 4h | ⏳ |
| QClaw | UX安全审查 | 2h | ⏳ |
| youdao | 16项P0安全测试 | 6h | ⏳ |
| PM | ✅ G18完成+广播+基线 | 3h | ✅ |
