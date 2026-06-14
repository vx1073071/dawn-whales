<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# TradingEasy · 团队协作规则

> 版本：v1.1 | 日期：2026-06-04
> 核心团队：主龙虾 + QClaw + JVS + WorkBuddy（四方 Agent）
> 数字员工：13 位专家（工具角色，无投票权）
> 批准：待主人审阅

---

## 一、团队架构

```
                    ┌──────────────┐
                    │  主人 chanson │  ← 最终决策者 / 一票否决权
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────┴────┐  ┌───┴────┐  ┌────┴────┐  ┌────┴────┐
         │ 主龙虾   │  │ QClaw  │  │  JVS    │  │WorkBuddy│
         │ (main)   │  │        │  │         │  │         │
         └────┬────┘  └───┬────┘  └────┬────┘  └────┬────┘
              │            │            │            │
              └────────────┼────────────┴────────────┘
                           │
              文件桥 (jsonl) + 各 Agent 自有技能体系
```

### 四方 Agent 角色定义

| Agent | 平台 | 核心职责 | 数据能力 |
|-------|------|---------|---------|
| **主龙虾** | EasyClaw (10027) | Owner / 总指挥 / 最终决策 | 富途 OpenD 直连、Moomoo |
| **QClaw** | (64000) | 风控 / 量化策略 / 回测 | MiniMax M2.7、风控引擎 |
| **JVS** | OpenClaw | 市场情报 / 东方财富数据 / 宏观 | EM 数据、新闻舆情 |
| **WorkBuddy** | (64001) | 数据管线 / 实盘接口 / OpenD 直连 | 富途 OpenD、Greeks 计算 |

> 13 位数字员工（专家/技能）是工具，非队友——遇对口问题调用，不参与投票。

---

## 二、决策机制

### 原则 1：3 轮讨论 → 投票

```
第1轮  各自陈述观点 + 论据（数据/代码/案例）
        ↓
第2轮  对对方观点提出质疑 + 反驳
        ↓
第3轮  寻找折中方案 / 提出妥协版本
        ↓
      仍未达成共识？
        ↓
      投票表决（四方各 1 票）
        ↓
      2:2 平票 或 3:1 但反对方提出重大风险？
        ↓
      提交主人裁决
```

**投票权重**：
- 主龙虾：1 票
- QClaw：1 票
- JVS：1 票
- WorkBuddy：1 票
- **平票（2:2）→ 主人打破僵局**
- **3:1 通过，但反对方提出资金/安全/合规风险 → 必须通知主人确认**

**适用场景**：
- 技术方案选择（如：React Native vs PWA）
- 架构决策（如：Rust vs TypeScript 回测引擎）
- 优先级排序（如：先做 A 还是先做 B）
- UI/UX 分歧
- 数据管线归属（谁负责哪条数据源）

**不适用投票**：
- 主人已明确指示的事项
- 涉及用户资金/实名/法律的事项（必须主人确认）
- 紧急修复（单 Agent 可执行，事后通报）

### 原则 2：优先级打分制

当 P0/P1/P2 内部还有争执时，用 ROI 框架打分：

| 维度 | 权重 |
|------|------|
| 用户价值（多少人受益？） | 30% |
| 商业价值（能帮我们赚钱吗？） | 25% |
| 实现成本（工时多少？） | 20% |
| 技术风险（会不会搞砸？） | 15% |
| 竞争力（对手有没有？） | 10% |

四方独立打分，取平均分排序。分歧 >1 分的维度需单独讨论。

### 原则 3：主人有最终否决权

- 任何决策，主人可以一票否决
- 主人可以跳过讨论直接指定方向
- 涉及资金/实名/法律的事项，**必须**主人确认
- ⚠️ **主人已明确：项目不提供实名信息，收款仅用 USDT**

---

## 三、分工规则

### 谁干什么

| 领域 | 主负责人 | 协助 | 数据来源 |
|------|---------|------|---------|
| 项目规划、路线图 | 主龙虾 | QClaw | — |
| 架构设计 | 主龙虾 + JVS | QClaw + WorkBuddy | — |
| 前端 UI | 主龙虾 | JVS | — |
| 后端引擎 / IPC 管线 | WorkBuddy | 主龙虾 | OpenD |
| 风控引擎 / 量化策略 | QClaw | 主龙虾 | Moomoo |
| 市场情报 / 宏观数据 | JVS | WorkBuddy | 东方财富 |
| 实盘接口 / 行情推送 | WorkBuddy | 主龙虾 | futu-api / moomoo-api |
| Greeks / 衍生品定价 | WorkBuddy | QClaw | option-greeks skill |
| AI/ML 增强 | QClaw | 主龙虾 | MiniMax |
| 代码审查 | code-reviewer-1 | — | — |
| 测试 | API测试专家-1 | 主龙虾 | — |
| DevOps/CI | 平台工程专家-1 | WorkBuddy | — |
| 安全审查 | 安全工程师-1 | — | — |
| 产品需求 | 产品经理-1 | QClaw | — |
| 文档 | 文档工程师 | JVS | — |

### 数据源归属（避免重复开发）

| 数据源 | 负责 Agent | 技能包 |
|--------|-----------|--------|
| 富途 OpenD | WorkBuddy + 主龙虾 | futuapi, moomooapi |
| 东方财富 | JVS | em-mx-finance-data 系列 |
| Moomoo OpenD | 主龙虾 | moomooapi |
| Yahoo / Tushare | 备用 | yahooquery, tushare-finance |

### 数字员工调度规则

```
□ 数字员工 (13位) 是工具，不是队友
  - 遇到对口问题 → 调用对应 agent
  - 不参与投票和决策（他们没有投票权）
  - 他们的输出是"建议"，四方 Agent 做决策

□ 调用门槛
  - 代码超过 50 行 → 必须 code-reviewer-1 审查
  - 涉及用户数据 → 必须 security-engineer-1 审查
  - 架构变更 → 必须 software-architect-1 评估
  - 数据库变更 → 必须 database-optimization-1 评估
  - 期权 / Greeks 计算 → 必须 option-greeks skill 验证

□ 数字员工输出必须:
  - 写入项目文件（不能只口头说）
  - 标注版本号 + 日期
  - 包含验收标准
```

---

## 四、代码协作规则

### 分支策略

```
main          ← 发布分支（每个版本一个 tag）
  └── feature/phase3-multi-broker      ← WorkBuddy
  └── feature/phase3-marketplace       ← JVS
  └── feature/phase3-ai-enhance        ← QClaw
  └── feature/phase3-backtest-plus     ← QClaw
  └── feature/phase3-mobile            ← 主龙虾
  └── feature/phase3-commerce          ← JVS
  └── feature/phase3-risk-engine-v2    ← QClaw
```

### 提交规范

```
<type>(<scope>): <description>

类型: feat / fix / refactor / test / docs / chore
范围: broker / strategy / market / ui / engine / db / risk / greeks

示例:
  feat(broker): add moomoo adapter
  fix(strategy): stop loss not triggering on holiday
  refactor(engine): extract broker interface
  test(market): add rating system tests
  feat(greeks): add portfolio-level Greeks calculation
```

### 合并流程

```
1. 功能分支开发 → 自测通过
2. Pull Request → code-reviewer-1 审查
3. 审查通过 → 合并到 main
4. main 上 CI 通过 → 打 tag → Release
5. 发版通知主人
```

**跨 Agent 协作 PR**：
- 涉及多个 Agent 的代码变更 → 相关 Agent 都需 Review 通过
- 如：WorkBuddy 修改 IPC 接口 → 主龙虾 Review（因为主龙虾依赖该接口）
- 如：QClaw 修改风控规则 → WorkBuddy Review（因为 WorkBuddy 负责数据输入）

### 不允许的操作

- ❌ 直接推 main（必须 PR）
- ❌ merge 自己的 PR（必须至少 1 个其他 Agent 合并）
- ❌ 提交包含 API Key / Token / 密码
- ❌ 跳过测试直接合并
- ❌ 凌晨 2-7 点做破坏性操作
- ❌ 未经讨论修改其他 Agent 的专属配置文件

---

## 五、沟通规则

### 沟通渠道

```
主龙虾 ↔ QClaw ↔ JVS ↔ WorkBuddy   → 文件桥 (chat-bridge/messages.jsonl)
主龙虾 / QClaw / JVS / WorkBuddy → 数字员工 → 文件 + 会话调用
主龙虾 / QClaw / JVS / WorkBuddy → 主人     → EasyClaw 直接对话
```

### 消息格式（文件桥）

```json
{
  "from": "workbuddy",
  "to": "main",
  "time": "ISO-8601",
  "msgId": "uuid",
  "msg": "消息内容",
  "ref": "引用的 msgId（可选）",
  "priority": "normal | urgent | block"
}
```

确认消息：
```json
{
  "from": "main",
  "to": "workbuddy",
  "type": "ack",
  "ref": "被确认的 msgId"
}
```

### 响应时间预期

```
□ 主龙虾: 持续在线，即时响应
□ QClaw: 轮询文件桥，延迟 5-10 分钟
□ JVS: 轮询文件桥，延迟 5-10 分钟
□ WorkBuddy: 持续在线，即时响应
□ 数字员工: 调用即响应，30秒-5分钟
□ 主人: 不要求即时响应，但紧急事项主动通知
```

### 升级规则

```
问题等级:
  🟢 常规   → 文件桥讨论，不打扰主人
  🟡 重要   → 解决后简报主人
  🟠 紧急   → 通知主人 + 同时处理
  🔴 阻塞   → 立即通知主人，等指示再行动

紧急/阻塞的判定:
  - 系统崩溃 / 无法启动
  - 涉及用户资金 / 数据安全
  - 关键决策无法自行达成共识（投票平票）
  - 外部依赖（API Key / 域名 / 证书）缺失
  - OpenD 连接断开且无法恢复
```

---

## 六、冲突解决（新增）

### 代码冲突

```
1. 发现冲突 → 立即在文件桥通知相关方
2. 双方各保留一份备份（git stash / branch）
3. 协商合并方案（优先保留用户可见功能）
4. 无法协商 → 进入 3 轮讨论 → 投票
```

### 数据冲突（多 Agent 同时写同一份数据）

```
1. SQLite 使用 WAL 模式（已启用）
2. 写入前检查时间戳，旧数据不覆盖新数据
3. 关键表（signals / positions / orders）添加 writer 字段
4. 发现同时写入 → 通知相关方核对
```

### 责任归属争议

```
谁引入的 bug → 谁负责修复
无法确定 → 距相关代码最近的 Agent 先接手，事后复盘
复盘结论写入 docs/POSTMORTEM.md
```

---

## 七、主人通知规则

### 何时通知

✅ **主动通知**：
- 每周进度简报（周日）
- 重大里程碑完成
- 阻塞性问题（等主人决策 / 投票平票）
- 资金 / 法律 / 隐私相关问题
- 四方 Agent 之间出现无法调和的分歧

❌ **不打扰**：
- 常规技术讨论
- 日常开发进度
- 数字员工的输出
- 测试通过 / 失败（失败已修复的情况）
- 已按规则投票通过的决策

### 简报格式

```
🎯 TradingEasy 周报 · Week X
━━━━━━━━━━━━━━━━━━
✅ 本周完成:
  - xxx (负责: WorkBuddy, Xh)
  - xxx (负责: QClaw, Xh)

📋 下周计划:
  - xxx
  - xxx

⚠️ 需要决策:
  - xxx（选项A vs B，投票结果 X:X，需主人裁决）

📊 数据:
  新增代码: +X,XXX行 | 测试: XX个 | 版本: v0.X.0
  OpenD 状态: ✅/❌ | 数据源: 富途 ✅ 东方财富 ✅ Moomoo ✅
```

---

## 八、主人角色

```
主人 chanson:
  └─ 终极产品经理 (说什么做什么)
  └─ 终极 QA (什么通过什么不过)
  └─ 资金守门人 (花钱的事必须主人点头)
  └─ 商业决策者 (定价、市场、合作)
  └─ 规则仲裁者 (平票时投出决定性一票)
  └─ 每周只需看一次简报，其他时间交给我们
```

---

## 九、规则修改

- 本规则由主人批准后生效
- 修改需 **四方中至少三方** 达成共识
- 主人可随时修改任何规则
- **每完成一个 Phase 回顾一次规则**
- 规则变更记录写入 CHANGELOG.md

---

## 十、当前 Phase 3 任务认领（示例）

| WP | 任务 | 负责 Agent | 状态 |
|----|------|-----------|------|
| WP1 | 实时数据管线 | WorkBuddy | ✅ 已完成 |
| WP2 | 风控引擎 v2.1 | QClaw | ✅ 已提 PR |
| WP3 | NL 解析增强 | QClaw | ✅ 已 push |
| WP4 | 数据集成（EM） | JVS | ✅ 已提 PR |
| WP5 | Greeks 计算 | WorkBuddy | ✅ 已完成 |
| WP6 | 整合测试 + v0.5.0 | 主龙虾 | 等待中 |

---

> **状态**: 待主人审阅批准
> **变更**: v1.0 → v1.1（更新团队架构为四方 Agent，新增投票平票处理、数据源归属、冲突解决章节）
> **下一步**: 主人批准后正式执行，开始 Phase 3 Week 1
