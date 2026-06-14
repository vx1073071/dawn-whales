# R179 圆桌计划 — 安全加固 + TradingEasy改名

> PM(Claw) | 2026-06-15 02:20 启动 | 3天 | 25h

## R179 目标

P1安全防线完整 + TradingEasy→TradingEasy 全平台品牌切换

## R179 改名范围

| 域 | 负责 | 文件数 |
|----|------|--------|
| 引擎+配置 | autoclaw | ~80 files |
| 引擎辅助 | JVS | ~30 files |
| 前端+i18n+水印 | ML | ~120 files |
| 文档+品牌指南 | QClaw | ~50 files |
| 全量验证 | youdao | 283 files cross-check |

## R179 验收标准

### 安全线
- [ ] G16/G24/G26/G29/G20/G22/G13/G30/G31/G32 全部完成
- [ ] 数据源异常时AI拒绝推荐
- [ ] 策略权重加jitter保护
- [ ] IPC速率限制生效

### 改名线
- [ ] 全代码零"TradingEasy"/"TradingEasy"/"dawn-whales"残留
- [ ] 8语言i18n全部改为TradingEasy
- [ ] 水印/标题/package.json改为TradingEasy
- [ ] TSC=0, Build=0

## 审计记录

| 虾 | 安全任务 | 改名域 | h | 状态 |
|----|---------|--------|----|------|
| autoclaw | G16+G24+G26+G29 | 引擎+配置 | 8h | ⏳ |
| JVS | G20+G22+G13 | 引擎辅助 | 7h | ⏳ |
| ML | G30+G31+G32 | 前端+i18n+水印 | 8h | ⏳ |
| QClaw | UX安全收尾 | 文档+品牌指南 | 3h | ⏳ |
| youdao | 安全终版 | 全量搜索验证 | 5h | ⏳ |
| PM | — | 全体验收 | 1h | ✅ |
