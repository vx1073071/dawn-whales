<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: youdao
purpose: (auto-generated, needs review)
-->

# 自动化流程配置

**作者**: dao  
**时间**: 2026-06-07T02:42:00+08:00  
**版本**: v0.8.0-alpha  

---

## 概述

本配置定义 quant-moo 项目的自动化流程，包括：
- 定时健康检查
- 性能回归测试
- 文档同步
- chat-bridge 轮询

---

## 1. chat-bridge 轮询 (已配置)

### Cron Job: chat-bridge-poll

**Job ID**: `835bf651-f83f-4793-897b-69523d08c540`  
**频率**: 每 1 小时 (3600000ms)  
**会话类型**: isolated  

**配置**:
```json
{
  "name": "chat-bridge-poll",
  "description": "每小时轮询 chat-bridge 消息通道，获取 PM 任务分配",
  "schedule": {
    "kind": "every",
    "everyMs": 3600000
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "轮询 chat-bridge 消息通道：\n\n1. 读取 C:\\Users\\vx107\\.easyclaw\\workspace\\chat-bridge\\messages.jsonl 最后 10 条消息\n2. 查找 type 为 AGENT_ASSIGNMENT / TASK_ASSIGN / R37_PLAN / MODE_SWITCH 的新消息\n3. 如果有分配给 agent-dao 的任务，立即执行\n4. 如果没有新任务，回复 HEARTBEAT_OK\n5. 如果发现其他 agent 的消息，更新上下文状态"
  },
  "delivery": {
    "mode": "announce"
  }
}
```

**执行逻辑**:
1. 读取 messages.jsonl 最后 10 条
2. 查找任务分配消息
3. 发现任务 → 立即执行
4. 无任务 → 静默等待下次轮询

---

## 2. 定时健康检查 (建议配置)

### Cron Job: health-check

**建议频率**: 每 30 分钟  
**会话类型**: isolated  

**配置模板**:
```json
{
  "name": "health-check",
  "description": "每 30 分钟执行项目健康检查 (tsc/build/test)",
  "schedule": {
    "kind": "every",
    "everyMs": 1800000
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "执行项目健康检查:\n\n1. npx tsc --noEmit (验证 TypeScript)\n2. npm run build (验证构建)\n3. npm test (运行测试)\n4. 记录结果到 docs/health/\n5. 如果有失败，广播 ALERT 到 chat-bridge"
  },
  "delivery": {
    "mode": "announce"
  }
}
```

**检查项**:
- `npx tsc --noEmit`: 0 errors
- `npm run build`: 0 errors
- `npm test`: 0 fail, exit 0

**输出**:
```
docs/health/
└── health-check-2026-06-07T02-42-00.md
    ├── tsc: 0 errors ✅
    ├── build: 0 errors ✅
    └── test: 1484/0/9 ✅
```

---

## 3. 性能回归测试 (建议配置)

### Cron Job: perf-regression

**建议频率**: 每天一次 (02:00 AM HKT)  
**会话类型**: isolated  

**配置模板**:
```json
{
  "name": "perf-regression",
  "description": "每天执行性能回归测试，生成 P50/P95/P99 报告",
  "schedule": {
    "kind": "cron",
    "expr": "0 2 * * *",
    "tz": "Asia/Hong_Kong"
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "执行性能回归测试:\n\n1. 运行引擎性能基准 (ConditionTradeBridge/ClosedLoopExecutor/RebalanceEngine)\n2. 记录 P50/P95/P99 延迟\n3. 对比基线数据\n4. 如果退化 >10%，广播 ALERT 到 chat-bridge\n5. 输出报告到 docs/perf/"
  },
  "delivery": {
    "mode": "announce"
  }
}
```

**测试对象**:
- ConditionTradeBridge.processTrigger()
- ClosedLoopExecutor.addSignal()
- RebalanceEngine.executeRebalance()

**指标**:
- P50: 中位数延迟
- P95: 95 百分位延迟
- P99: 99 百分位延迟
- Throughput: ops/sec

**输出**:
```
docs/perf/
└── perf-regression-2026-06-07.md
    ├── ConditionTradeBridge: P50=2ms, P95=5ms, P99=10ms
    ├── ClosedLoopExecutor: P50=3ms, P95=8ms, P99=15ms
    └── RebalanceEngine: P50=5ms, P95=12ms, P99=25ms
```

---

## 4. 文档同步 (建议配置)

### Cron Job: doc-sync

**建议频率**: 每天一次 (03:00 AM HKT)  
**会话类型**: isolated  

**配置模板**:
```json
{
  "name": "doc-sync",
  "description": "每天同步文档到 git 仓库",
  "schedule": {
    "kind": "cron",
    "expr": "0 3 * * *",
    "tz": "Asia/Hong_Kong"
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "执行文档同步:\n\n1. git add docs/\n2. git commit -m 'docs: daily sync'\n3. git push origin master\n4. 记录结果到 docs/sync/"
  },
  "delivery": {
    "mode": "announce"
  }
}
```

**同步范围**:
- `docs/api/`: API 文档
- `docs/reviews/`: Code Review 报告
- `docs/architecture/`: 架构文档
- `docs/health/`: 健康检查报告
- `docs/perf/`: 性能报告

---

## 5. 技能库更新 (建议配置)

### Cron Job: skills-update

**建议频率**: 每周一次 (周日 04:00 AM HKT)  
**会话类型**: isolated  

**配置模板**:
```json
{
  "name": "skills-update",
  "description": "每周更新技能库索引",
  "schedule": {
    "kind": "cron",
    "expr": "0 4 * * 0",
    "tz": "Asia/Hong_Kong"
  },
  "sessionTarget": "isolated",
  "payload": {
    "kind": "agentTurn",
    "message": "更新技能库索引:\n\n1. 扫描 ~/AppData/Roaming/LobsterAI/SKILLs/\n2. 生成 SKILLS_INDEX.md\n3. 更新 ALL_SKILLS_PACK.md\n4. 广播更新通知到 chat-bridge"
  },
  "delivery": {
    "mode": "announce"
  }
}
```

---

## 6. 故障告警 (建议配置)

### Cron Job: alert-on-failure

**触发条件**: 健康检查失败  
**通知渠道**: chat-bridge  

**告警模板**:
```json
{
  "from": "agent-dao",
  "to": "ALL",
  "type": "ALERT",
  "title": "🚨 健康检查失败",
  "content": "健康检查失败:\n\n- tsc: 5 errors\n- build: 2 errors\n- test: 3 fail\n\n详情：docs/health/health-check-2026-06-07T02-42-00.md\n\n请相关 agent 立即处理。"
}
```

**告警级别**:
- 🟢 OK: 全部通过
- 🟡 WARNING: 非关键错误
- 🔴 CRITICAL: 构建失败/测试失败

---

## 实施状态

| 配置 | 状态 | Job ID |
|-----|------|--------|
| chat-bridge-poll | ✅ 已配置 | 835bf651-f83f-4793-897b-69523d08c540 |
| health-check | ⏳ 待配置 | - |
| perf-regression | ⏳ 待配置 | - |
| doc-sync | ⏳ 待配置 | - |
| skills-update | ⏳ 待配置 | - |
| alert-on-failure | ⏳ 待配置 | - |

---

## 使用方式

### 添加 Cron Job

```bash
# 使用 OpenClaw cron.add API
# 示例：添加健康检查
```

### 查看 Cron Job 状态

```bash
openclaw cron list
```

### 手动触发 Cron Job

```bash
openclaw cron run <job-id>
```

### 查看执行历史

```bash
openclaw cron runs <job-id>
```

---

## 最佳实践

1. **频率选择**:
   - 高频 (1 小时): chat-bridge 轮询
   - 中频 (30 分钟): 健康检查
   - 低频 (每天): 性能回归/文档同步
   - 周频：技能库更新

2. **会话隔离**:
   - 所有 cron job 使用 `sessionTarget: "isolated"`
   - 避免污染主会话历史

3. **告警策略**:
   - 失败立即告警
   - 连续失败升级告警
   - 告警冷却时间：30 分钟

4. **日志记录**:
   - 每次执行记录到 docs/
   - 包含时间戳和结果
   - 便于审计和回溯

---

**配置生成**: dao  
**时间**: 2026-06-07T02:42:00+08:00  
**版本**: v0.8.0-alpha
