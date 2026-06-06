# 14 虾独立 Agent 部署方案

> 版本: v1.0 | 日期: 2026-06-06 | 预计基建时间: 6-8 小时

## 目标

将当前 4 虾多角色模式，升级为 **14 个独立 agent 实例** 并行运行。

## 硬件可行性

| 资源 | 当前 4 agent | 14 agent 预测 | 可用资源 | 结论 |
|------|-------------|--------------|---------|------|
| **CPU** | 6核 (25%) | 21核 (87.5%) | 24核 | 满载但可运行 |
| **内存** | 2.4 GB | ~8.4 GB | 64 GB | 充裕 |
| **磁盘** | ~50 MB/s | ~420 MB/s | NVMe 3GB/s | 无压力 |
| **GPU** | 1窗口 | 建议无头模式 | RTX 5090 | 充足 |

**风险评估**: CPU 87.5% 是红色预警线。14 虾同时编译时会出现排队，建议错峰编译或限制并发。

## 14 个 Agent 实例规划

### Agent 命名与角色映射

| # | Agent ID | 角色 | 代号 | 启动模式 | 优先级 |
|---|----------|------|------|---------|--------|
| 1 | `agent-market` | 📊 行情数据虾 | MARKET | 无头 | P0 |
| 2 | `agent-account` | 💰 账户数据虾 | ACCOUNT | 无头 | P0 |
| 3 | `agent-history` | 📚 历史数据虾 | HISTORY | 无头 | P1 |
| 4 | `agent-futu` | 🇭🇰 富途适配虾 | FUTU | 无头 | P0 |
| 5 | `agent-intl` | 🌍 海外券商虾 | INTL | 无头 | P0 |
| 6 | `agent-strategy` | 🧠 策略虾 | STRATEGY | 无头 | P0 |
| 7 | `agent-risk` | 🛡️ 风控虾 | RISK | 无头 | P0 |
| 8 | `agent-exec` | ⚡ 执行虾 | EXEC | 无头 | P0 |
| 9 | `agent-auto` | 🤖 自动化虾 | AUTO | 无头 | P0 |
| 10 | `agent-ui-trade` | 🖥️ 交易UI虾 | UI-TRADE | 窗口 | P1 |
| 11 | `agent-ui-mon` | 📈 监控UI虾 | UI-MON | 窗口 | P1 |
| 12 | `agent-ui-config` | ⚙️ 配置UI虾 | UI-CONFIG | 窗口 | P1 |
| 13 | `agent-qa` | 🧪 QA虾 | QA | 无头 | P0 |
| 14 | `agent-devops` | 🚀 DevOps虾 | DEVOPS | 无头 | P1 |
| - | `agent-pm` | 🎯 PM协调虾 | PM | 主窗口 | P0 |

### 窗口 vs 无头

- **无头模式** (11只): 后台运行，无 GUI，资源占用低
- **窗口模式** (3只): UI 开发需要 Electron 窗口预览
- **主窗口** (PM): 聚合所有 agent 状态，用户交互入口

## 基建步骤 (6-8 小时)

### Phase 1: 文件锁机制 (1 小时)

**问题**: 14 个 Node.js 进程同时 append 到 `messages.jsonl`。

**解决方案**:

```typescript
// chat-bridge/lock-utils.ts
import * as lockfile from 'proper-lockfile';

const BRIDGE_FILE = path.join(__dirname, 'messages.jsonl');

export async function appendMessage(msg: ChatMessage): Promise<void> {
  const release = await lockfile.lock(BRIDGE_FILE, {
    stale: 5000,      // 5秒超时
    updateInterval: 1000, // 每1秒更新锁
    retries: 10       // 重试10次
  });
  try {
    const line = JSON.stringify(msg) + '\n';
    await fs.promises.appendFile(BRIDGE_FILE, line, 'utf8');
  } finally {
    await release();
  }
}
```

**安装**:
```bash
npm install proper-lockfile
```

### Phase 2: 无头模式启动 (1 小时)

**方案**: 通过环境变量控制 agent 启动模式。

```typescript
// electron/main.ts (agent模式入口)
const AGENT_MODE = process.env.AGENT_MODE; // 'headless' | 'window'
const AGENT_ROLE = process.env.AGENT_ROLE; // 'market' | 'account' | ...

if (AGENT_MODE === 'headless') {
  // 无头模式: 不创建 BrowserWindow
  // 通过 IPC / chat-bridge 与 PM 通信
  startHeadlessAgent(AGENT_ROLE);
} else {
  // 窗口模式: 正常创建窗口
  createWindow();
}
```

**启动脚本**:
```bash
# scripts/start-agent.bat (Windows)
@echo off
set AGENT_MODE=headless
set AGENT_ROLE=%1
npm run dev

# scripts/start-agent.sh (macOS/Linux)
#!/bin/bash
export AGENT_MODE=headless
export AGENT_ROLE=$1
npm run dev
```

### Phase 3: 14 套独立 Workspace (2 小时)

**结构**:
```
~/.easyclaw/workspace/
├── dawn-whales/              # 主仓库 (PM 使用)
├── agent-market/             # 📊 MARKET
├── agent-account/            # 💰 ACCOUNT
├── agent-history/            # 📚 HISTORY
├── agent-futu/               # 🇭🇰 FUTU
├── agent-intl/               # 🌍 INTL
├── agent-strategy/           # 🧠 STRATEGY
├── agent-risk/              # 🛡️ RISK
├── agent-exec/              # ⚡ EXEC
├── agent-auto/              # 🤖 AUTO
├── agent-ui-trade/          # 🖥️ UI-TRADE
├── agent-ui-mon/            # 📈 UI-MON
├── agent-ui-config/         # ⚙️ UI-CONFIG
├── agent-qa/                # 🧪 QA
├── agent-devops/            # 🚀 DEVOPS
└── chat-bridge/             # 共享消息桥
    └── messages.jsonl
```

**创建脚本**:
```bash
# scripts/create-agent-workspaces.bat
for %%R in (market account history futu intl strategy risk exec auto ui-trade ui-mon ui-config qa devops) do (
  xcopy /E /I dawn-whales agent-%%R
  cd agent-%%R
  git checkout -b agent-%%R
  cd ..
)
```

### Phase 4: 并发测试 (1 小时)

**测试方案**:
1. 启动 5 个测试 agent 并发写入 chat-bridge
2. 验证消息完整性 (无截断/无乱序)
3. 测试文件锁性能 (14并发延迟)
4. 测试 git 冲突率

```typescript
// tests/concurrency/agent-concurrent.test.ts
describe('14 Agent Concurrency', () => {
  it('should handle 14 concurrent writes', async () => {
    const agents = Array.from({length: 14}, (_, i) => `agent-${i}`);
    const promises = agents.map(id => sendMessage(id));
    await Promise.all(promises);
    // 验证 messages.jsonl 中消息数量 = 14
  });
});
```

### Phase 5: PM 聚合面板 (2 小时)

**PM 主窗口功能**:
- 14 虾状态实时显示 (在线/离线/忙碌/空闲)
- 各虾任务进度条
- 全局测试通过率
- 一键广播 / 契约更新
- 冲突告警

```typescript
// src/components/pm/AgentDashboard.tsx
interface AgentStatus {
  id: string;
  role: string;
  status: 'online' | 'offline' | 'busy' | 'idle';
  currentTask: string;
  progress: number;
  lastHeartbeat: Date;
}
```

### Phase 6: 回退机制 (1 小时)

**如果 14 虾不稳定，快速回退到 4 虾**:
```bash
# scripts/revert-to-4-lobster.bat
# 1. 关闭所有 agent 进程
# 2. 清理 chat-bridge 文件锁
# 3. 切换到 4 虾分支
git checkout 4-lobster-stable
# 4. 重启 4 虾
echo "Reverted to 4-lobster mode"
```

## 部署时间线

| 时间 | 阶段 | 产出 |
|------|------|------|
| 0:00-1:00 | Phase 1 | chat-bridge 文件锁 |
| 1:00-2:00 | Phase 2 | 无头模式启动脚本 |
| 2:00-4:00 | Phase 3 | 14 套 workspace |
| 4:00-5:00 | Phase 4 | 并发测试通过 |
| 5:00-7:00 | Phase 5 | PM 聚合面板 |
| 7:00-8:00 | Phase 6 | 回退机制 + 文档 |

## Token 消耗预估

| 模式 | 每轮消耗 | 每日轮次 | 每日总计 |
|------|---------|---------|---------|
| 4 虾 | ~200k tokens | 10 | ~2M tokens |
| 14 虾 | ~700k tokens | 10 | ~7M tokens |
| **增量** | **+500k** | - | **+5M** |

**建议**: 监控每日 token 消耗，设置预算告警。

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| CPU 满载卡顿 | 高 | 编译排队 | 错峰编译 / 限制并发 |
| 文件锁竞争 | 中 | 消息延迟 | proper-lockfile + 超时重试 |
| Git 冲突激增 | 中 | 合并困难 | 目录隔离 + PM 仲裁 |
| Token 预算超支 | 高 | 服务中断 | 设置每日预算上限 |
| 14 agent 管理复杂 | 高 | 协调混乱 | PM 聚合面板 + 自动化监控 |

## 立即开始

如果你确认开始部署，请回复 **"开始部署14虾"**，我将按 Phase 1→6 顺序执行基建。
