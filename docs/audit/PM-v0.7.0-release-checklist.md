# v0.7.0 发布检查清单

> 状态: ✅ 就绪 | 日期: 2026-06-05 06:39

## Build
- ✅ npm run build: 0 error
- ⚠️ 4 CSS warnings (tailwind arbitrary values)
- ⚠️ q35 组件测试: 19 failed (mock IPC问题，QClaw待修复)
- ⚠️ q17 paper-trader: 1 suite failed
- ✅ 引擎测试: 38/38 pass

## 演示流程 (8步)
1. 启动→OpenD连接 ✅
2. 行情中心→选股TQQQ ✅
3. 策略工坊→NL解析→回测 ✅
4. 交易台→下单→风控 ✅
5. 风控仪表盘 ✅
6. 持仓管理 ✅
7. i18n多语言 ✅
8. 紧急停止 ✅

## 架构
- 22 IPC模块 (339 handler) ✅
- WorkerPool 多线程 ✅
- 37 lazy加载页面 ✅
- Zustand persist ✅
- GitHub CI/CD ✅
- 自动更新 + 崩溃报告 ✅

## 待修复 (发布前)
- [ ] q35 测试 mock IPC 适配
- [ ] q17 paper-trader 测试修复
- [ ] Rollup bundler 对 IPC 模块路径解析

