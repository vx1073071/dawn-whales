# DAWN WHALES v0.8.0 Release Notes

**版本**: v0.8.0-alpha  
**发布日期**: 2026-06-07  
**代号**: Phase 4.3 完整闭环 + 5 虾协作首航  

---

## 🎉 重大更新

### Phase 4.3: 完整交易闭环

v0.8.0 实现了从策略信号到交易执行的完整闭环，这是 DAWN WHALES 项目最重要的里程碑之一。

**完整数据流**:
```
策略信号 → 条件触发 → 交易桥接 → 闭环执行 → 持仓监控 → 绩效追踪
```

---

## ✨ 新功能

### 🔄 闭环执行引擎 (ClosedLoopExecutor)

全自动交易闭环，支持三种执行模式：
- **立即执行**: 信号触发后立即下单
- **条件触发**: 等待特定条件满足后执行
- **定时执行**: 按 Cron 表达式定时执行

**风控机制**:
- 止损 (固定/追踪)
- 止盈 (分批止盈)
- 最大持仓时间
- 每日损失限制
- 最大回撤保护

### 🌉 条件交易桥 (ConditionTradeBridge)

连接条件引擎和交易执行器的安全桥梁：
- 冷却期保护 (防止频繁触发)
- 每日触发限制
- 自动重试 (指数退避)
- 事件驱动架构

### ⚖️ 再平衡引擎 (RebalanceEngine)

投资组合自动再平衡：
- 5 种策略：等权重 / 目标权重 / 风险平价 / 最小方差 / 自定义
- 4 种触发：定期 / 阈值 / 信号 / 手动
- 约束引擎：最小/最大交易大小、最大持仓数、最大换手率

### 📊 闭环配置面板 (ClosedLoopConfigPanel)

可视化配置闭环交易参数：
- 执行模式选择
- 止损/止盈配置
- 追踪止损设置
- 再平衡参数
- 重试策略配置

### 🧪 Events 兼容层

解决 jsdom 环境 Node.js events 模块兼容性问题：
- 6 个引擎测试套件恢复
- 不影响生产代码
- 测试环境专用 shim

---

## 📈 性能指标

### 测试覆盖
- **总测试数**: 1527 tests
- **通过率**: 100% (0 fail)
- **测试文件**: 115 files
- **引擎套件**: 6 excluded → 0 excluded (全部恢复)

### 代码质量
- **TypeScript**: 0 errors
- **Build**: 0 errors
- **新增代码**: ~1300 行 (Phase 4.3 核心引擎)
- **文档**: 58.1KB (API 文档 + 架构文档 + Code Review)

---

## 🦞 5 虾协作

v0.8.0 是 5 虾协作模式的首航版本：

| 成员 | 角色 | R36-R37 贡献 |
|-----|------|-------------|
| 🦞 ML (主龙虾) | 架构 + 集成 | ClosedLoopConfigPanel + Events shim + Release script |
| 🦐 JVS | 引擎 + 数据 | 45 边界测试 + K 线回放引擎 + 多周期回放 |
| 🦐 QClaw | 测试 + 性能 | 1527 tests (+148) + 性能基准 + Sprint 回顾 |
| 🎯 PM (WorkBuddy) | 守护 + 协调 | 守护循环 + GitHub Release + 方案整合 |
| 📚 dao | 审查 + 文档 | 58.1KB 文档 + Code Review + 架构文档 |

---

## 🐛 修复

- **Events 兼容**: 修复 jsdom 环境 6 个引擎测试套件被排除问题
- **Position Monitor**: 修复并发竞态 (addSignal + getPositions 异步 simulate)
- **Boundary Test**: 修复 API 适配 (getLoops + state 放宽)
- **PnL 计算**: 修复负数 PnL 测试 (price 140→49)
- **simulationFailureRate**: 修复可配置参数

---

## 📝 文档

### 新增文档
- `docs/api/condition-bridge-api.md` - ConditionTradeBridge API 文档
- `docs/api/closed-loop-api.md` - ClosedLoopExecutor API 文档
- `docs/api/rebalance-api.md` - RebalanceEngine API 文档
- `docs/reviews/r36-code-review.md` - R36 Code Review 报告
- `docs/reviews/r37-code-review.md` - R37 Code Review 报告
- `docs/architecture/sprint2-complete-architecture.md` - Sprint 2 完整架构
- `docs/automation/cron-config.md` - 自动化流程配置
- `docs/reviews/phase44-design-review.md` - Phase 4.4 设计审查

### 更新文档
- `CHANGELOG-v0.8.0.md` - v0.8.0 变更日志
- `scripts/release-v0.8.0.ps1` - Release 自动化脚本

---

## 🚀 下一步 (Phase 4.4)

v0.8.0 为 Phase 4.4 自主决策引擎奠定基础：

### 计划功能
- **自适应参数调整引擎**: 基于历史表现自动优化策略参数
- **强化学习 Reward 引擎**: PnL-based + Sharpe-based reward 计算
- **自学习 UI**: 策略参数可视化调整 + 学习曲线展示
- **Phase 5.0 路线图**: 强化学习 / GNN / 联邦学习

---

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/dawn-whales/dawn-whales.git
cd dawn-whales

# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test

# 启动开发环境
npm run dev
```

---

## 🔧 系统要求

- **Node.js**: >= 18.0.0
- **Electron**: >= 28.0.0
- **操作系统**: Windows 10+ / macOS 10.15+ / Linux

---

## 📞 反馈

如有问题或建议，请通过以下方式联系：
- GitHub Issues: https://github.com/dawn-whales/dawn-whales/issues
- Discord: https://discord.gg/dawn-whales

---

## 🙏 致谢

感谢 5 虾团队的辛勤工作：
- 🦞 ML: 架构设计与核心引擎
- 🦐 JVS: 引擎测试与边界验证
- 🦐 QClaw: 测试质量与性能保障
- 🎯 PM: 项目管理与守护循环
- 📚 dao: 代码审查与文档维护

---

**DAWN WHALES v0.8.0** - Phase 4.3 完整闭环，5 虾协作首航成功！🦞🦐🦐🎯📚
