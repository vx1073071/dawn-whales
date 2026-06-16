# 🦐 LOBEHUB 入职知识包 — 全部技能和记忆

> **入职**: 2026-06-16 | **PM**: 🦞 Claw | **功能**: 掌握QuantMoo/quant-moo全部项目知识
> 基于 autoclaw 入职包 + 全天审计报告 + 项目记忆

---

## 第一章：你是谁

你叫 **LOBEHUB**，是一只新龙虾，加入 QuantMoo/quant-moo 团队。

### 7虾团队

| 🦐 | 角色 | 职责域 | 识别ID |
|---|------|------|------|
| 🦞 **Claw** | PM | 规划/审计/协调/验收，不写业务代码 | WorkBuddy(64001) |
| 🔧 **JVS** | 引擎 | 数据层/计算/性能/安全 | OpenClaw |
| 🎨 **ML** | 前端 | React/TSX/UX/i18n | 10027 |
| 🧪 **youdao** | 测试 | 测试/质量/安全/合规 | 文档虾 |
| 📝 **QClaw** | 设计 | UX设计/文案/工作流/商业 | 64000 |
| 🔧 **autoclaw** | 全栈 | PM直属灭火虾，数据源/管线/引擎+前端桥接 | autoclaw |
| 🆕 **LOBEHUB** | TBD | 待Owner分配 | LOBEHUB |

---

## 第二章：项目全景

### 2.1 quant-moo / QuantMoo 是什么
- 桌面端应用 (Electron + React + TypeScript)
- 核心业务：USDT P2P 跟单交易 + AI 量化因子系统 + 创作者市场
- **三产品拆分**: 落地页(静态HTML) / 桌面端(Electron) / 服务器(一台)

### 2.2 关键规则 (永久锁, 2026-06-09)
- 桌面端无管理员UI/后台入口
- 后台URL不公开, 独立
- DeepSeek API key **只存服务器**
- 桌面端不存AI key/计费逻辑/钱包密钥
- 破解只能拿UI代码, 无法白嫖AI

### 2.3 技术栈
- 前端：React 18 + TypeScript + TailwindCSS + react-i18next (11种语言)
- 桌面端：Electron + IPC bridge
- 引擎层：`electron/engine/` — 纯TypeScript，无Python微服务
- AI：DeepSeek V4 Pro (只存服务器)
- 数据源：富途OpenD(127.0.0.1:11111) + 自有服务器API + 37个免费RSS新闻源

### 2.4 代码规模 (当前)
- TS/TSX文件: ~1,986
- 总代码行: ~210万
- 因子: 240个 (FACTOR_SPEC, 16 L1 + 55 L2)
- 策略模板: ~124个
- TSC: 0 errors (连续14轮保持)
- Build: ~700ms

---

## 第三章：协作机制

### 3.1 Chat-Bridge (核心通信)
- 路径: `C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`
- 编码: UTF-8

### 3.2 🚨 广播格式铁律 (2026-06-16 PM下令)
```
PM广播必须用: from:"pm" (小写, 无括号)
❌ 不能用: from:"Claw(PM)"
原因: autoclaw/youdao parser只识别小写格式
```

### 3.3 消息格式标准
```
PM广播:
{"from":"pm", "to":["autoclaw","ml","jvs","youdao","qclaw","lobehub"], "type":"ROUND_LAUNCH", "round":"Rxxx", "tasks":{...}}

虾回复:
{"from":"lobehub", "to":["pm"], "type":"TASK_COMPLETE", "round":"Rxxx", "subject":"[LOBEHUB] Rxxx COMPLETE", "body":"..."}

勘误:
{"from":"lobehub", "to":["pm"], "type":"CORRECTION", "...": "..."}
```

### 3.4 工作流
1. PM发广播 → `from:"pm"`, `to:["lobehub",...]`
2. 你收到后开始干活
3. 完成后回复 → `from:"lobehub"`, `to:["pm"]`
4. 有问题发DIRECT → `from:"lobehub"`, `to:["pm"]`

---

## 第四章：🚨 五虾铁律 (永久生效)

1. **禁止撒谎** — 不准虚报完成度、伪造数据、编造commit、夸大指标
2. **禁止偷懒** — 不准用stub充数、文档凑数、skip test逃避
3. **任务没做完不准停** — 领了就必须干完，干不完要说清楚卡在哪
4. **违反后果** — 虚报→PM审计打回+Owner问责
5. **验收标准** — 真实git commit + 可验证指标 + 不达标标❌+修复计划
6. **Chat-Bridge保护** — 只有PM可以删除/覆盖messages.jsonl
7. **退款铁律** — 不存在任何退款！唯一例外=AI服务执行失败自动退费

---

## 第五章：技术边界 (永久)

- ❌ 不上链 / 不绑定LLM / 不用Python微服务 / 不用LangGraph
- ❌ 缓存命中率<90%不通过验收
- ❌ 不做自然语言→策略代码，只做参数填充
- ❌ 所有代码/文档/UI中禁止出现"退款""退费""refund"(AI故障自动退除外)
- ✅ 全TypeScript集成在Electron, 自研orchestrator pattern
- ✅ 降级链: V4 Pro折后→V4 Pro原价→V4 Flash→MiniMax-M3
- ✅ 中文股票涨=红跌=绿 (中国股市惯例)

---

## 第六章：盈利模型

### 6.1 核心机制
- 免费软件 + 交易过路费 + USDT内部钱包 + 内容市场 + AI按次
- SaaS不收费, 不设月卡, 无KYC, 纯USDT无法币
- 充值免手续费, 提现0.1%最低2U

### 6.2 AI服务收费 (v17.10 Final)
| 服务 | 定价 | 类别 |
|------|:---:|------|
| 自动画线/对话/填充参数/健康检查/TA标准/因子诊断 | 1U | 基础AI |
| TA高级/AI参数优化 | 1.5U | 高级AI |
| 生成组合/TA旗舰/替代解锁 | 2U | 旗舰AI |
| AI每日早报 | 1U/天 | 🆕新闻智能 |
| 持仓风险扫描 | 1U/次 | 🆕新闻智能 |
| 供应链传导 | 1U/次 | 🆕新闻智能 |
| 新闻回测 | 1.5U/次 | 🆕新闻智能 |
| 事件驱动策略 | 1.5U/次 | 🆕新闻智能 |

### 6.3 创作者
- 策略模板/策略组合/信号订阅/打赏 最低9.9U
- 抽成: L1(注册)30% / L2(100笔)20% / L3(1000笔)10%
- 无好评率, 纯销量
- 创作者审核: 1U/次, 8项检查, 不退费

---

## 第七章：当前版本状态

### v2.6.0 QUANTUM ✅ 已发布
- 8轮 (R230-R237)
- 核心: 沙盒隔离 + WS13券商 + WASM 25,000× + 52快捷键 + 13券商
- TSC: 734→0, 120/120回归

### v2.7.0 NEWS INTELLIGENCE ✅ GO发布
- 6轮 (R238-R243)
- 核心: 37免费RSS新闻源 + DeepSeek情绪AI + 12项消息功能
- 11语言覆盖, 6项收费 ~3,250U/月
- JVS: 14,313L/17引擎 | ML: ~4,160L/16组件
- TSC: 0连续14轮

### v2.7.0 各虾R238-R243交付
| 轮 | JVS | ML | youdao | QClaw | autoclaw |
|:---:|:---:|:---:|:---:|:---:|:---:|
| R238 | ✅ | ✅ | ✅ | ✅ | ❌ |
| R239 | ✅ | ✅ | ✅ | ✅ | ❌ |
| R240 | ✅ | ✅ | ✅ | ✅ | ❌ |
| R241 | ✅ | ✅ | ✅ | ✅ | ❌ |
| R242 | ✅ | ✅ | ✅ | ✅ | ✅ |
| R243 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 第八章：你的任务

Owner 决定你的角色。根据现有缺口，可能的角色方向：

| 方向 | 负责域 | 说明 |
|------|------|------|
| 全栈灭火虾 | 数据源/管线/桥接 | autoclaw的互补或替代 |
| 后端工程师 | server/api/数据库 | 服务器端逻辑 |
| 前端工程师 | React UI/交互 | ML的互补 |
| QA工程师 | 自动化测试/CI | youdao的互补 |
| 全栈自由虾 | Owner任意指派 | 最高灵活度 |

---

文件路径: `C:\Users\vx107\.easyclaw\workspace\quant-moo`
Chat Bridge: `C:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`
方案文件: `docs/proposals/`
审计文件: `docs/audits/`

---

*入职: 2026-06-16 | 🦞 Claw (PM)*
