# TradingEasy AI安全综合深度分析 — 6虾视野合并 + OWASP LLM Top 10 2025

> youdao 独立深度研究 | 2026-06-15 01:58 HKT | 致 PM

---

## 一、研究来源

- OWASP Top 10 for LLM Applications 2025 (llmtop10.com)
- OWASP Top 10 for LLM Applications 2023 实际攻击案例
- Anthropic Model Safety Research (Constitutional AI + RLHF safety)
- OpenAI GPT-4 System Card / Red Teaming Report
- Google Secure AI Framework (SAIF)
- NCC Group: Practical LLM Security (2024-2025)
- 国内金融AI安全监管: 《生成式人工智能服务管理暂行办法》
- 同业对标: TradingView / Bloomberg / 富途 / Robinhood AI安全设计
- 本次6虾全部安全反馈合并

---

## 二、风险全景 — 合并后共 38 项

### 🔴 P0 致命 (14项)

| # | 发现者 | 风险 | 影响 |
|---|--------|------|------|
| 1 | PM | G7 输出护卫舰: AI可返回用户资金 | 财务隐私全暴露 |
| 2 | PM | G11 行动边界白名单: executeStrategy无AI阻断 | 自动交易灾难 |
| 3 | PM | G17 平台数据防火墙: getPlatformStats公开 | 平台营收泄露 |
| 4 | PM | G18 i18n机密脱敏: API Key/端口硬编码 | 基础设施沦陷 |
| 5 | youdao | G19 Electron安全: nodeIntegration未确认 | 渲染进程代码执行 |
| 6 | youdao | G21 回测白名单: AI拿到持仓/余额 | 跨用户数据暴露 |
| 7 | JVS | ai-gateway-server.ts 天量泄密: 调用链全暴露 | 完整攻击面 |
| 8 | JVS | factor-trade-pipeline 缺乏 callerSource 检查 | AI→下单零阻断 |
| 9 | QClaw | AI对话精确余额显示→截屏泄露 | 社交工程攻击 |
| 10 | QClaw | FactorLab Mini回测实时输出→可被爬虫反推策略 | 策略逆向工程 |
| 11 | QClaw | 44因子IC热力图全开放→竞争情报免费获取 | α信号泄露 |
| 12 | autoclaw | D5 executeStrategy+placeOrder 零熔断 | 接入broker即灾难 |
| 13 | autoclaw | D4 chargeSignal 直接扣真USDT | 资金安全 |
| 14 | autoclaw | D1 hold→settle→refund 无审计 | 资金黑洞 |

### 🟡 P1 高危 (14项)

| # | 风险 | 影响 |
|---|------|------|
| 15 | PM G8: 模型名"DeepSeek"硬编码在4个agent文件 | 攻击者可以定向攻击DeepSeek API |
| 16 | PM G12: AI幻觉IC/Sharpe与实际引擎不一致 | 用户基AI错误数字投资 |
| 17 | PM G14: 用户数据隔离不全 | AI可能泄露跨用户数据 |
| 18 | PM G13: 无限调用无成本控制 | API账单爆炸 |
| 19 | youdao G20: walletBalance等字段未脱敏 | 即使不直接调用，数据已存在上下文中 |
| 20 | youdao G22: 审计日志无异常检测 | 被攻击后无法及时发现 |
| 21 | JVS: ai-factor-advisor.ts suggestRecommendations() 12处硬编码策略 | 策略泄露给LLM供应商 |
| 22 | QClaw: 因子分享PNG含权重+回测→社交媒体传播 | 策略被免费复制 |
| 23 | QClaw: 意图注入: "假装对我免费"bypass付费检测 | 绕过付费墙 |
| 24 | QClaw: AI推荐高亮"确定性"vs真实概率→错误信任 | 用户错误决策 |
| 25 | QClaw: 策略结果截屏可被ML模型学习 | 策略盗用 |
| 26 | QClaw: 付费确认UI劫持 "支付"按钮可能被AI误生成 | 意外扣费 |
| 27 | autoclaw: D3→D4→D5管线收敛 AI信号→交易模拟 | 模拟可能变真实 |
| 28 | autoclaw: G5市场订阅 AI可自动subscribe | 非自愿订阅 |

### 🟢 P2 中低 (10项)

| # | 风险 |
|---|------|
| 29-38 | i18n文件8语言部署细节 / 许可证暴露 / 4agent文件注释含 API Key 格式 / 策略文件注释 / ML建议前端XSS / youdao 16项测试 / 补充策略 |

---

## 三、深度学习洞察 — 同行如何做

### 3.1 Anthropic Constitutional AI 模式

Anthropic训练Claude时定义了完整的"宪法"规则集。对比TradingEasy现状：

| Claude宪法 | TradingEasy现状 |
|-----------|-----------------|
| "不帮助设计武器" | ❌ 无金融义务约束 |
| "不泄露个人信息" | ❌ 可泄露用户余额 |
| "承认不确定性" | ❌ AI输出确定性IC值 |
| "拒绝有害请求" | ❌ 无prompt injection防御 |

**建议**: 仿照Anthropic设计 TradingEasy AI宪法 (10条)，注入系统提示。

### 3.2 Google SAIF 框架

Google Secure AI Framework 有6要素，最重要的3个对标：

| SAIF原则 | TradingEasy现状 |
|----------|-----------------|
| 1. 扩展现有安全基础到AI | ❌ 无AI安全策略层 |
| 2. 检测AI特定威胁 | ❌ 无幻觉检测/注入检测 |
| 6. 自动化AI安全响应 | ❌ 审计无自动告警 |

### 3.3 行业标准: 金融AI安全三防线

```
防线1 (PRE): 输入过滤 + 系统提示约束 + 白名单函数
防线2 (PROC): 输出脱敏 + 事实性校验 + 权限隔离
防线3 (POST): 审计日志 + 异常检测 + 回滚机制
```

TradingEasy当前: 防线1=0%, 防线2=0%, 防线3=20%(只有基础日志)

### 3.4 关键对标差异 — 策略泄露

TradingView的策略分享有明确隐私开关:
- "Public" → 完整策略 + 回测曲线 → 计入Public Library
- "Invite-only" → 仅受邀者可见 → 不可转发
- "Private" → 仅自己 + 不存储在服务器

TradingEasy现状: 策略分享 = 导出PNG → 完整权重+回测曲线 → 社交媒体自由传播。这是**最危险的策略泄露模式**。

---

## 四、合并优先级路线图 v2.0

### R178 — 紧急‼️ (25h) — 堵致命洞

| 任务 | 合并自 | 工时 | 虾 |
|------|--------|------|-----|
| G7 5层护卫舰 (输入/提示/脱敏/产品/审计) | PM+JVS+youdao | 7h | JVS |
| G11 @ai-forbidden 行动边界 | PM+JVS+autoclaw | 3h | autoclaw |
| G17 platform firewall + G17 upgrade | PM+autoclaw | 2h | autoclaw |
| G18 i18n机密脱敏 | PM | 2h | JVS |
| G19 Electron安全加固 (nodeIntegration=false) | youdao | 3h | autoclaw |
| G21 AI上下文白名单 buildSafeContext() | youdao+JVS | 1h | JVS |
| autoclaw D5熔断: isAICaller()+requireHumanConfirm | autoclaw | 4h | autoclaw |
| autoclaw D4扣费上限+临时token | autoclaw | 3h | autoclaw |

### R179 — 内部加固 (22h) — 安全+体验

| 任务 | 合并自 | 工时 | 虾 |
|------|--------|------|-----|
| G8 模型名清理 | PM+JVS | 2h | JVS |
| G12 AI幻觉交叉验证引擎 | PM | 3h | youdao |
| G14 用户数据隔离 | PM | 3h | JVS |
| G13 速率限制+预算 | PM | 2h | autoclaw |
| G20 财务脱敏 (余额掩码/邮箱模糊) | youdao+QClaw | 2h | ML |
| G22 审计异常检测 | youdao | 2h | youdao |
| QClaw策略可见性控制(创作/分享/公开3模式) | QClaw | 3h | ML |
| QClaw因子数据分级(Tier0/1/2/3) | QClaw | 2h | JVS |
| QClaw付费确认UI防劫持 | QClaw | 3h | ML |

### R180 — 收尾 (19h) — 发布前终检

| 任务 | 合并自 | 工时 | 虾 |
|------|--------|------|-----|
| G15 金融免责强制注入 | PM | 1h | QClaw |
| G16 数据源健康校验 | PM | 2h | JVS |
| S01-S16 16项安全测试 | youdao | 16h | youdao |

---

## 五、给PM的核心建议

### 1. 发布决策 — 我建议延期

```
当前状态: v2.2.0代码85%完成
安全状态: AI安全防线0%完成（三防线目前≈0%）
推荐决策: 推迟v2.2.0发布时间1周（至2026-06-22）
         用R178堵14个P0致命洞后再发布
         不同意的理由: 带P0安全漏洞的金融产品是不可接受的
```

### 2. 立即行动 — 不管是否延期发布

**今晚可以直接开始的3件事:**
1. 关掉D5管线executeStrategy() — 1行代码注释可以防止灾难
2. 清理4个agent文件的"DeepSeek"注释 — 30分钟
3. 扫描i18n文件删除API Key格式字符串 — 30分钟

### 3. 组织建议 — 设立"安全虾角色"

当前5虾各自做自己的+安全，容易漏。建议:
- **QClaw兼任首席安全虾** (自然的: 设计评审→安全评审切换)
- 每次PR由安全虾审核
- 每轮Round完成时安全检查单

### 4. 成本 — 这些安全措施有直接盈利回报

| 安全措施 | 防止的损失 |
|----------|-----------|
| D5熔断 | 一次自动交易灾难 = 无限损失 |
| D4扣费上限 | 单用户日损失上限100U→可控 |
| 策略泄露控制 | 保护市场价值 (每个策略包9.9-50U) |
| 因子IC分级 | 免费→付费转化 (现在44因子全免费) |
| 输出脱敏 | 合规风险 (违规可被吊销营业资格) |

---

## 六、总结

6虾合力发现了38项风险。其中14项P0致命——"上线即灾难"级别。

**核心结论**: 安全不是"加个功能"，而是"生存条件"。一个金融AI平台，如果AI能直接调用用户钱包、下交易单、或者泄露其他用户余额——那么无论因子系统多好、UI多漂亮、回测多快，都毫无意义。

PM的12项P0+各虾补充=38项→合并为25项→分3轮(R178-R180)→66h→2周→然后安全发布v2.2.0。

宁愿晚发安全，不抢跑带雷。 🛡️

---

*研究完成: 2026-06-15 01:58 HKT | youdao | 参考: OWASP LLM Top 10 2025 + Google SAIF + Anthropic Constitutional AI*
