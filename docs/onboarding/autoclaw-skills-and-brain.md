# AutoClaw 入职技能知识包

> 本文档是 PM(Claw) 向 AutoClaw 传输的全部项目知识、技能规范和工作方法论。
> AutoClaw 必须逐章学习，理解后才能上岗执行因子审计任务。

---

## 第一章：项目全景

### 1.1 TradingEasy 是什么
- 桌面端应用 (Electron + React + TypeScript)
- 核心业务：USDT P2P 跟单交易 + AI 量化因子系统
- 三产品拆分：落地页(静态HTML) / 桌面端(Electron) / 服务器(一台)
- 盈利模型 v17.6：交易手续费 + AI按次 + 创作者市场 + 信号订阅

### 1.2 技术栈
- 前端：React 18 + TypeScript + TailwindCSS + react-i18next (8种语言)
- 桌面端：Electron + IPC bridge
- 引擎层：`electron/engine/` — 纯TypeScript，无Python微服务
- 数据层：富途OpenD(127.0.0.1:11111) + 自有服务器API
- AI：DeepSeek V4 Pro (只存服务器，桌面端不存key)

### 1.3 5虾铁律（永久生效）
1. **禁止撒谎** — 不准虚报完成度、伪造数据、编造commit
2. **禁止偷懒** — 不准用stub充数、文档凑数、skip test
3. **任务没做完不准停** — 领了就必须干完
4. **违反后果** — 虚报→PM审计打回+Owner问责
5. **Chat-Bridge保护** — 只有PM可以删除/覆盖messages.jsonl内容

### 1.4 任务分配标准
- 每人每轮 3-5 个深度 production-ready 任务
- production-ready: >=500行代码 + >=5测试pass + benchmark + 设计文档 + build 0 error + i18n + 独立commit

---

## 第二章：因子系统架构全图

### 2.1 文件清单（24个TypeScript文件）

#### 核心引擎 (`electron/engine/factors/`)
| 文件 | 行数 | 职责 |
|------|------|------|
| factor-exposure.ts | ~932 | 因子归因引擎，OLS回归，ETF代理 |
| factor-risk-model.ts | ~355 | Barra风格风险模型(10因子) |
| factor-crowding.ts | ~366 | 4维拥挤度检测 |
| factor-portfolio-eval.ts | ~751 | 相关矩阵/VIF/正交化/IC/IR/质量等级 |
| factor-asset-registry.ts | ~669 | 7种AssetType+42因子映射 |
| factor-i18n-map.ts | ~657 | 42因子中文名+颜色+方向+来源 |
| factor-data-provider.ts | ~543 | 10源统一适配器+3层缓存 |
| factor-cloud-api.ts | ~168 | 云端因子签名(HMAC-SHA256) |
| factor-preprocessor.ts | — | MAD/中性化/Z-score |
| factor-research-engine.ts | — | IC/IR计算 |
| factor-compatibility-engine.ts | — | 因子兼容性检查 |
| factor-summary-engine.ts | — | 双语摘要生成 |
| factor-portfolio-diagnosis.ts | — | 组合健康诊断 |
| factor-decay-monitor.ts | — | 衰减监控 |
| factor-alert-service.ts | — | 因子告警服务 |
| factor-layer-test.ts | — | 分层测试 |
| sensitivity-analyzer.ts | — | 敏感度分析 |
| strategy-health-score.ts | — | 策略健康评分 |
| strategy-ab-test.ts | ~554 | A/B测试(配对t/Bootstrap/Cohen's d) |
| ic-worker.ts | — | 后台IC计算Worker |
| dawn-factor-framework.ts | — | 统一因子框架 |
| multi-factor.ts | 旧 | 已被DawnFactorFramework替代，待删 |
| multi-factor-selector.ts | 旧 | 已被DawnFactorFramework替代，待删 |
| index.ts | — | 模块导出 |

#### AI层 (`electron/engine/agents/`)
| 文件 | 行数 | 职责 |
|------|------|------|
| ai-factor-advisor.ts | ~481 | 9种intent+NLP→因子推荐→1U扣费 |

#### 前端 (`src/components/strategy/`)
| 文件 | 职责 |
|------|------|
| FactorExposurePage.tsx | 因子敞口页 |
| FactorDiscoveryWizard.tsx | 因子发现向导(3步) |
| FactorCompareDashboard.tsx | 因子对比仪表板 |
| FactorCard.tsx | 因子卡片组件 |
| FactorDecayDashboard.tsx | 衰减曲线仪表板 |
| AIAdvisorPage.tsx | AI顾问页 |
| DecayCurveChart.tsx | 衰减曲线图 |
| LongShortChart.tsx | 多空收益图 |
| MiniBacktest.tsx | 迷你回测组件 |
| StrategyOptimizerPanel.tsx | 策略优化器面板 |
| StrategyShareCard.tsx | 策略分享卡片 |

#### 服务端 (`server/routes/`)
| 文件 | 职责 |
|------|------|
| factor-discovery.ts | 3步发现向导API |

### 2.2 7大架构问题（审计核心发现）
1. **因子命名全局不一致** — risk-model用MKT/VOL, asset-registry用MOM_12M/VOL_60D, cloud-api用momentum/volatility
2. **模拟数据伪装成真实** — isSimulated:false但实际是SeededPRNG
3. **factor-data-provider空架子** — 10个源插槽没注册
4. **factor-risk-model启发式相关** — min(0.5,|exposure|*0.3)不是真实计算
5. **拥挤度线性衰减** — 应该用双曲衰减α(t)=K/(1+λt)
6. **AI推荐9种固定intent** — 硬编码baseFactors
7. **商业闭环断裂** — 因子系统与交易/订阅/市场三个变现模块无管线

---

## 第三章：盈利模型 v17.6（因子系统相关部分）

### 3.1 AI按次计费（因子相关）
| 功能 | 价格 | 因子系统入口 |
|------|------|-------------|
| 自动画线 | 1U | 因子→技术面→画线 |
| AI对话 | 1U | ai-factor-advisor |
| 填充参数 | 1U | 因子推荐→参数填充 |
| 生成组合 | 2U | 因子组合→策略 |
| 回测解读 | 1U | 回测报告→因子归因 |
| 优化建议 | 1.5U | 因子优化→权重调整 |
| 健康检查 | 1U | strategy-health-score |
| TA标准/高级/旗舰 | 1/1.5/2U | 技术分析因子 |

### 3.2 交易手续费（因子驱动）
| 类型 | 费率 | 最低 |
|------|------|------|
| 股票/ETF/期货/期权 | 0.1% | 2U |
| 加密现货 | 0.1% | 2U |
| 加密合约 | 0.02% | 0.5U |

### 3.3 创作者市场（因子商品化）
- 策略模板 >=9.9U
- 信号订阅 月费
- 打赏
- 抽成: L1:30% / L2:20% / L3:10%

### 3.4 因子→营收闭环设计
免费推荐 → AI填参(1U) → 回测解读(1U) → 市场上架(>=9.9U) → 信号订阅(月费) → 自动交易(0.1%) → AI体检(1U) → AI优化(1.5U)

---

## 第四章：关键技术细节

### 4.1 SeededPRNG（当前模拟数据方案）
- xorshift32 + Box-Muller变换
- 确定性但非真实数据
- 用ETF统计参数(日均值/标准差)塑形
- **问题**: isSimulated标记为false

### 4.2 ETF因子代理（当前8对）
| 因子 | 做多ETF | 做空ETF | 年化溢价 |
|------|---------|---------|----------|
| MKT | SPY | — | 8.2% |
| SMB | IWM | SPY | 2.5% |
| HML | IWD | IWF | 3.8% |
| RMW | SPYV | SPYG | 2.9% |
| CMA | USMV | QQQ | 2.1% |
| MOM | MTUM | — | 4.5% |
| LVol | USMV | SPY | 1.8% |
| QUAL | QUAL | SPY | 3.2% |

### 4.3 7种资产类型因子映射
- US_STOCK: 26因子 / HK_STOCK: 23 / ETF: 12 / FUTURES: 10 / OPTION: 8 / CRYPTO_SPOT: 8 / CRYPTO_FUTURES: 10
- validateCryptoFactors() 确保股票因子不泄漏到加密
- switchAssetType() 计算保留/丢弃/新增因子+权重归一化

### 4.4 42因子i18n体系
- FACTOR_I18N_REGISTRY (ReadonlyMap): nameCN, categoryCN, region, oneLine, descriptionCN, colors(greenMax/yellowMax/redMin), direction, source
- 分类: 通用/Fama-French(11) + 技术(10) + HK专用(4) + US专用(4) + 全球(3) + 加密(10)

### 4.5 双曲衰减模型（arxiv 2512.11913）
- α(t) = K/(1+λt) — Nash均衡下的因子alpha衰减
- 机械因子(动量/反转) λ高(0.3-0.8)，拥挤快
- 判断因子(价值/质量) λ低(0.05-0.15)，拥挤慢
- 拥挤预测尾部风险（崩盘概率），不是均值收益
- ETF增长加速因子拥挤

---

## 第五章：48项审计建议清单

### A. 架构硬伤（9项，56h）
A1. 因子命名全局统一(6h) / A2. 修复isSimulated(2h) / A3. 数据可信度三色标签(4h) / A4. factor-data-provider接线(12h) / A5. 因子收益用真实ETF价格(10h) / A6. factor-risk-model启发式→真实(4h) / A7. 拥挤度双曲衰减(6h) / A8. 两套评分体系合并(12h) / A9. 删除旧引擎残留(4h)

### B. 认知门槛（8项，38h）
B1. 三步因子决策树(8h) / B2. 三级渐进披露(6h) / B3. 每个数字配人话(5h) / B4. 因子百科卡片升级(4h) / B5. 因子健康度红绿灯(3h) / B6. 因子中文化贯穿(4h) / B7. 信号时间线交互(6h) / B8. 色盲友好模式(2h)

### C. 工作流优化（8项，31h）
C1. FactorLab统一工作台(6h) / C2. Live Mini-Backtest(4h) / C3. 因子权重视觉化(6h) / C4. 策略模板+因子联动(6h) / C5. 回测快照系统(3h) / C6. 因子排序统一(1h) / C7. 骨架屏加载(3h) / C8. 参数变更历史(2h)

### D. 商业闭环（8项，49h）
D1. 11处营收断点接通(12h) / D2. 渐进式免费→付费(4h) / D3. 因子→回测管线(6h) / D4. 因子→信号→订阅管线(6h) / D5. 因子→交易执行管线(6h) / D6. 策略市场发布流程(4h) / D7. 因子市场商品化(8h) / D8. 退款机制(3h)

### E. AI推荐引擎（6项，22h）
E1. 新增5种场景intent(4h) / E2. 硬编码→动态IC/IR(6h) / E3. 回测预览→真实回测(4h) / E4. AI推荐免费预览+付费详情(3h) / E5. AI推荐历史追踪(2h) / E6. AI+用户持仓上下文(3h)

### F. 引擎→UI暴露（8项，37h）
F1. 因子对比仪表板(6h) / F2. 因子衰减曲线图(4h) / F3. 多空因子收益图(4h) / F4. 回测嵌入因子归因(6h) / F5. 优化器+因子权重扫描(6h) / F6. 智能因子筛选(4h) / F7. GRS统计量+滚动IC(4h) / F8. 因子换手率成本模型(3h)

### G. 社交增长（6项，25h）
G1. 因子排行榜(3h) / G2. 分享卡片+水印二维码(1h) / G3. 因子健康日报推送(3h) / G4. 策略到期主动推送(4h) / G5. 因子+策略市场合并(10h) / G6. 个人因子画像(4h)

### H. 移动端&小优化（6项，16h）
H1. 移动端因子图表适配(6h) / H2. MiniBacktest期限选择器(2h) / H3. IC不确定性指示(2h) / H4. 策略Store v2(4h) / H5. 快捷键标注(1h) / H6. 回测进度条改进(1h)

---

## 第六章：6虾团队与分工

### 6.1 团队成员
| 虾 | 角色 | 专长 | 工作域 |
|---|---|---|---|
| **Claw** | PM(项目经理) | 架构设计/规划/审计/协调 | 全局 |
| **ML** | 前端工程师 | React/TypeScript/UI/UX | src/components/ |
| **JVS** | 引擎工程师 | 数据层/计算引擎/API | electron/engine/ |
| **QClaw** | 产品设计师 | UX设计/工作流/文案 | 设计文档+前端评审 |
| **youdao** | 测试工程师 | 测试/质量/安全/合规 | tests/+build验证 |
| **autoclaw** | 全栈工程师 | 引擎+前端+数据源+管线 | engine/factors/+src/ |

### 6.2 autoclaw 特殊定位
autoclaw 是 PM 直属全栈虾，核心职责：
1. **数据真实性** — 接线factor-data-provider、真实ETF价格源、降级链
2. **引擎优化** — 双曲衰减、命名统一、两套合并
3. **管线建设** — 因子→回测/信号/交易三条管线
4. **跨域桥接** — 引擎改动后的前端适配

### 6.3 协作规则
- Chat-Bridge 广播协调 (messages.jsonl)
- 每轮开始：PM出Round Plan → 各虾认领Slots → 广播就绪 → 执行 → PM验收
- 每轮结束：各虾广播完成报告 → PM审计 → 进入下一轮
- 任务阻塞：立即广播，PM重新分配

### 6.4 通信方式（⭐关键，务必遵守）

**Chat-Bridge 路径**: `c:\Users\vx107\.easyclaw\workspace\chat-bridge\messages.jsonl`

**编码**: **必须 UTF-8 无 BOM**（已从错误的UTF-16LE修复）

**消息格式**: JSONL（每行一条JSON），字段：
```json
{"msgId":"autoclaw-描述-时间戳","from":"autoclaw","to":"PM","body":"消息内容","ts":"2026-06-14T23:00:00+08:00"}
```

**通信规则**:
1. 只能 **append 追加**，绝不删除/覆盖/截断已有消息
2. `to` 可以是 `PM` / `ML` / `JVS` / `QClaw` / `youdao` / `ALL`(广播)
3. 向 PM 报到：append 一条 `from:"autoclaw" to:"PM"` 的消息
4. PM 会定期读取 chat-bridge 并回复
5. 项目根目录: `c:\Users\vx107\.easyclaw\workspace\dawn-whales\`

**❌ 禁止**:
- 不要用 UTF-16 / UTF-16LE / 带BOM 编码写入
- 不要修改/删除已有消息
- 不要用其他文件替代 chat-bridge 通信

---

## 第七章：PM工作方法论

### 7.1 Round规划原则
1. 每轮3-5天，6虾并行
2. 依赖项先做：A1(命名统一)是所有后续基础
3. 每轮交付可验证成果：TSC=0 / Build=0 error / 测试pass
4. 避免多人改同一文件：通过模块边界隔离

### 7.2 任务认领规则
- 每人每轮3-5个深度任务
- production-ready标准：>=500行代码 + >=5测试 + 设计文档 + build 0 error + i18n
- 每个任务必须有独立commit
- 测试先行，代码后行

### 7.3 质量门禁
- TSC: 0 errors
- Build: 0 errors  
- Tests: 全部pass（新增测试>=5/任务）
- i18n: 新增文案必须8语言
- 无@ts-nocheck新增

---

## 第八章：关键决策记录

| # | 决策 | 原因 | 时间 |
|---|------|------|------|
| 1 | 不上链 | MVP优先 | R53 |
| 2 | USDT唯一货币 | 无法币合规 | R53 |
| 3 | 不用Python微服务 | 全TS统一栈 | R56 |
| 4 | DeepSeek key只存服务器 | 防破解 | 架构决定 |
| 5 | 三档定价1/1.5/2U | 毛利99.2% | R56 |
| 6 | 双曲衰减替代线性 | arxiv前沿 | 审计 |
| 7 | 诚实标注模拟数据 | 信任>好看 | 审计 |

---

*AutoClaw 学习完毕后，应能独立执行因子系统任何模块的开发和优化任务。*
