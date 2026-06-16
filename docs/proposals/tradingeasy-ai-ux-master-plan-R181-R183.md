# quant-moo AI完美产品级方案 — R181-R183

> PM(Claw) | 2026-06-15 | 6虾 | 31项 | 80h | 3轮8天

---

## 一、总览

| Round | 主题 | 天数 | 项数 | 工时 |
|-------|------|------|------|------|
| **R181** | 死代码激活+致命UX | 3天 | 14项 | 38h |
| **R182** | 体验打磨+防护增强 | 3天 | 10项 | 24h |
| **R183** | 锦上添花+发布 | 2天 | 7项 | 18h |

---

## 二、6虾分工

| 🦐 | 角色 | R181 | R182 | R183 | 总计 |
|----|------|------|------|------|------|
| **autoclaw** | 全栈 | 12h | 8h | 4h | 24h |
| **JVS** | 引擎 | 12h | 5h | — | 17h |
| **ML** | 前端 | 6h | 8h | 6h | 20h |
| **QClaw** | 设计 | 4h | 3h | 5h | 12h |
| **youdao** | 测试 | 6h | 4h | 5h | 15h |
| **Claw(PM)** | — | 3h | 1h | 2h | 6h |

---

## 三、R181 — 死代码激活+致命UX (3天/38h)

> 目标：4块死代码全部复活 + 幻觉检测 + 5项UX致命伤

### 各虾分工

| 🦐 | 任务 | 工时 | 交付物 |
|----|------|------|--------|
| **autoclaw** | P0-05幻觉检测(4h)+P0-06建议下个问题(2h)+P0-08分轮次对话(4h)+P0-09数字人话翻译(3h)减半(2h) | 12h | ai-factor-advisor.ts 改造: hallucinationCheck()+suggestNext()/multiTurnDialog()+humanizeMetric() |
| **JVS** | P0-01激活prompt-injection-guard(4h)+P0-02激活rate-limiter(2h)+P0-03激活audit-anomaly(2h)+P0-04激活ipc-permission(2h)+P0-11接AI链(2h) | 12h | 4个安全模块接入AI调用链 + 1个新接入点 |
| **ML** | P0-07 AI按钮价格透明(2h)+P0-09数字人话翻译前端(1h) | 3h | AIAdvisorPage价格标签 + FactorCard人话翻译组件 |
| **QClaw** | P0-09人话翻译文案库(2h)+P0-06建议问题话术设计(2h) | 4h | 42因子人话比喻库 + 14种intent后续问题模板 |
| **youdao** | P0测试: 4安全模块接入回归 + 幻觉检测测试 | 6h | 20+ security integration tests |
| **PM** | 广播+基线+R181计划 | 3h | R181 round plan + 验收标准 |

### R181验收
- [ ] 4块死代码全部接入AI调用链(非自引用)
- [ ] 幻觉检测: 假IC值被拦截
- [ ] AI回复末尾出现2-3个推荐后续问题
- [ ] AI按钮显示价格标签
- [ ] 因子卡片显示人话翻译
- [ ] TSC=0, Build=0

---

## 四、R182 — 体验打磨+防护增强 (3天/24h)

> 目标：10项P1全部完成

| 🦐 | 任务 | 工时 | 交付物 |
|----|------|------|--------|
| **autoclaw** | P1-06来源可信度标注(2h)+P1-07 Guard解释性(2h)+P1-08语义理解层(3h)+P0-10统安入口(1h) | 8h | ai-security-gateway.ts + credibilityBadge() + guardExplain() + semanticSimilarity() |
| **JVS** | P0-12 rate-limiter接AI(2h)+P1-09表述泄露修复(2h)+P0-12补充(1h) | 5h | rate-limiter AI路径 + balanceBinaryInference防二分推断 |
| **ML** | P1-01进度条(2h)+P1-02置信度可视化(2h)+P1-03免费梯度(2h)+P1-04上下文预填(2h) | 8h | AIProgressBar + ConfidenceBadge + FreemiumUnlockCard + ContextPreFill |
| **QClaw** | P1-05免责交互化设计(2h)+P1-10色盲语义修复规范(1h) | 3h | disclaimer-interaction-design.md + colorblind-semantic-fix.md |
| **youdao** | P1全部10项集成测试 | 4h | 30+ integration tests |
| **PM** | R182广播+基线 | 1h | R182 round plan |

---

## 五、R183 — 锦上添花+发布 (2天/18h)

> 目标：P2收尾 + v2.4.0发布

| 🦐 | 任务 | 工时 |
|----|------|------|
| **ML** | P2-01搜索历史(4h)+P2-02对话记忆(3h)+P2-03反馈闭环(2h) → 减半(4h) | 4h |
| **autoclaw** | P2-04行为异常(3h)+P2-05回放审计(2h)+P2-06多语注入(2h) → 减半(4h) | 4h |
| **QClaw** | P2-07对抗样本(3h)+P2-08 A/B测试(2h)+P2-09信任分(2h) → (5h) | 5h |
| **youdao** | P2全部测试 + 全量回归 | 5h |
| **ML** | CHANGELOG + version bump | 1h |
| **PM** | 全量验收 + v2.4.0发布 | 2h |

### R183验收
- [ ] 全量回归全部pass
- [ ] v2.4.0 tag 已打
- [ ] CHANGELOG完整

---

## 六、依赖关系

```
R181 死代码激活 ──→ R182 体验打磨 (依赖安全模块已接入)
      │                  │
      └──→ R182 防护增强 ←┘
                │
                └──→ R183 锦上添花+发布
```

---

## 七、全项目终局

| 阶段 | Round | 天数 | 核心 |
|------|-------|------|------|
| 因子审计 | R170-R177 | 29天 | 48项因子系统 |
| AI安全 | R178-R180 | 9天 | 28项防线+改名 |
| AI体验 | R181-R183 | 8天 | 31项UX+死代码 |
| **总计** | **14轮** | **46天** | **107项** |

---

## 八、决策确认

| 决策 | 值 |
|------|-----|
| 品牌 | quant-moo |
| 目标版本 | v2.4.0 |
| 轮数 | 3轮(R181-R183) |
| 总工时 | 80h |
| 启动信号 | 等Owner确认后广播R181 |
