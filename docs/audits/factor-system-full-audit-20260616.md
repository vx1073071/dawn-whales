# DAWN WHALES 策略因子系统全面审计报告

> **审计日期**: 2026-06-16 | **版本**: v2.4.0 | **审计人**: 🦐 Claw (PM)  
> **范围**: `electron/engine/factors/` 全部101个文件 + 25个测试 + 上下游依赖

---

## 一、总览

| 指标 | 数值 | 评价 |
|------|------|------|
| 因子注册数 | 240 | ✅ 覆盖16大类 |
| 文件数 | 101 | ⚠️ 较多需整理 |
| 总代码量 | 36,714行 | ⚠️ 偏大 |
| @ts-nocheck | 0 | ✅ 清零 |
| i18n覆盖 | 108/240 (45%) | 🔴 不足 |
| Calculator覆盖 | ~197/240 (82%) | 🟡 良好 |
| 测试覆盖 | 25文件/4,360行 | 🟡 中等 |
| A股残留 | 0 | ✅ 已清理 |
| 市场适配器 | 7个(7市场) | ✅ 完整 |

---

## 二、因子分类体系 (3层)

### L1 大类 (16类/240因子)

| 排名 | L1分类 | 数量 | 代表因子 |
|------|--------|------|----------|
| 1 | 🪙 L1_CRYPTO | 36 | onchain_whale, dex_flow, btc_dominance |
| 2 | 🛢️ L1_COMMODITY | 26 | gold_premium, oil_contango, copper_basis |
| 3 | 📊 L1_FUNDAMENTAL | 24 | pe_ratio, roe_quality, earnings_surprise |
| 4 | 🇭🇰 L1_HK | 19 | hk_ah_premium, hk_south_flow, hk_turnover |
| 5 | 🇺🇸 L1_US | 18 | us_yc_slope, us_vix_term, us_earnings_mom |
| 6 | 🧠 L1_SENTIMENT | 17 | fear_greed, social_volume, reddit_buzz |
| 7 | 🌍 L1_MACRO | 17 | cpi_surprise, pmi_leading, fed_funds |
| 8 | ⚠️ L1_RISK | 15 | var_95, max_drawdown, tail_risk |
| 9 | 🔗 L1_CROSS_ASSET | 15 | bond_equity_corr, carry_trade, flight_quality |
| 10 | 📚 L1_CLASSIC | 15 | fama_french_mkt, smb, hml |
| 11 | 📈 L1_TECHNICAL | 11 | rsi_14, macd_signal, bollinger_width |
| 12 | 📰 L1_EVENT | 8 | earnings_calendar, fed_meeting, ipo_lockup |
| 13 | 🌿 L1_ESG | 6 | esg_score, carbon_intensity, governance |
| 14 | 👔 L1_ANALYST | 6 | analyst_revision, target_upside, consensus |
| 15 | 🔄 L1_REVERSAL | 5 | short_term_rev, seasonal_effect |
| 16 | 🏛️ L1_LEGACY | 2 | legacy_momentum, legacy_value |

### L2 中类 (55个)
每个L1下细分2-4个L2，如 L1_CRYPTO → L2_ONCHAIN / L2_DEX / L2_SENTIMENT_CRYPTO / L2_DEFI

### L3 因子ID (240个)
格式: `F_` 前缀 + 大写蛇形，如 `F_ONCHAIN_WHALE`, `F_HK_AH_PREMIUM`

---

## 三、关键发现与问题

### 🔴 P0 致命问题

#### 1. i18n覆盖严重不足 (45%)
- 注册表240因子中仅108个有i18n翻译
- **132个"幽灵因子"**: i18n-map中存在但注册表无对应(旧版遗留)
- **196个"裸因子"**: 注册表有但i18n-map无翻译

**影响**: 用户在非中文环境下看不到因子说明

**修复方案**: 
- 清理132个幽灵i18n条目(注册表已不存在的因子)
- 为196个裸因子补齐i18n翻译
- 工时估算: ~16h (196条×5min/条)

#### 2. Calculator覆盖率实际需要验证
- 6个Calculator文件声称覆盖197个因子ID
- 但`factorId`字段与注册表ID命名不一致(计算器用`'F_XXX'`，注册表用不同格式)
- 仅有5个因子ID确认在Calculator和注册表都存在

**影响**: 用户选因子后可能无法计算结果

**修复方案**:
- 写自动校验脚本，逐个验证240因子是否有对应Calculator
- 缺失的补stub(返回"该因子计算暂不可用")
- 工时估算: ~8h

### 🟡 P1 重要问题

#### 3. 因子文件数量过多 (101个)
- 大量单文件<100行(如nse-adapter.ts 77行, sgx-adapter.ts 79行)
- 建议合并小文件: 7个市场适配器(77-150行) → 1个market-adapters.ts
- commodity拆分3文件(523+495+482) → 可合并为1个

**修复方案**: 文件整理+重导出，工时~12h

#### 4. 注释过时
- factor-id-registry.ts 头部注释写"187 Factors"，实际240个
- 多处注释引用已删除的A股代码路径

**修复方案**: 全量注释扫描+更新，工时~4h

#### 5. factor-i18n-map.ts 过大 (3,598行)
- 包含132个幽灵因子翻译(注册表已不存在)
- 混合了因子名称+描述+市场+等级等多维度i18n

**修复方案**: 
- 拆分: factor-i18n-names.ts + factor-i18n-descriptions.ts
- 清理幽灵条目
- 工时~6h

### 🟢 P2 改善建议

#### 6. 测试覆盖不均
- 25个测试文件，集中在green/yellow/red层
- 市场适配器(7个) 0测试
- 数据提供者(provider/v2/unified) 0测试
- 计费网关(billing-gateway) 0测试

**修复方案**: 补关键路径测试，工时~20h

#### 7. 信号管道与计费未端到端验证
- factor-signal-pipeline.ts(467行)定义了5种信号类型
- factor-billing-gateway.ts(648行)定义了22种AI计费服务
- 两者之间缺乏集成测试，无法确认"信号发出→扣费→UI展示"全链路

**修复方案**: 端到端集成测试，工时~8h

#### 8. 因子快照存储(factor-snapshot-store.ts, 317行)
- 持久化因子状态到SQLite
- 无数据迁移策略，schema变更可能破坏历史数据

---

## 四、市场适配器评估

| 市场 | 适配器 | 行数 | 数据源 | 评价 |
|------|--------|------|--------|------|
| 🇯🇵 JPX | jpx-adapter.ts | 150L | Yahoo Finance JP | 🟢 可用 |
| 🇰🇷 KRX | krx-adapter.ts | 89L | KRX API | 🟡 基础 |
| 🇹🇼 TWSE | twse-adapter.ts | 119L | TWSE OpenAPI | 🟢 可用 |
| 🇸🇬 SGX | sgx-adapter.ts | 79L | SGX API | 🟡 基础 |
| 🇦🇺 ASX | asx-adapter.ts | 92L | Yahoo AU | 🟡 基础 |
| 🇮🇳 NSE | nse-adapter.ts | 77L | NSE India | 🟡 基础 |
| 🇪🇺 STOXX | stoxx-adapter.ts | 80L | STOXX Ltd | 🟡 基础 |

> 总体: 7个市场适配器全部有实质代码(77-150行)，但部分API可能有频率限制或需Key

---

## 五、因子深度服务 (AI收费)

| 服务 | 费率 | 文件 | 行数 | 状态 |
|------|------|------|------|------|
| 多因子组合回测 | 1U | factor-backtest-engine.ts | 550L | ✅ |
| 因子深度诊断 | 1U | factor-portfolio-diagnosis.ts | 427L | ✅ |
| AI因子参数优化 | 1.5U | factor-optimizer.ts | 641L | ✅ |
| 替代数据因子解锁 | 2U | alt-data-adapter.ts | 331L | ✅ |
| AI策略匹配 | 1U | factor-billing-gateway.ts | 648L | ✅ |
| AI市场状态 | 1U | factor-billing-gateway.ts | - | ✅ |
| 批量优化 | 1.5U | factor-batch-optimizer.ts | 199L | ✅ |
| 敏感度分析 | 1.5U | sensitivity-analyzer.ts | 689L | ✅ |

> 22种AI计费服务全部定义在factor-billing-gateway.ts，覆盖v17.7-v17.9全部费率

---

## 六、A股清理验证

| 检查项 | 结果 |
|--------|------|
| 因子注册表A股条目 | ✅ 0个 |
| Calculator中A股因子 | ✅ 0个 |
| i18n-map中A股翻译 | ✅ 0个 |
| 适配器中A股数据源 | ✅ 0个 |
| factor-asset-registry.ts CN_STOCK | ✅ 不存在 |
| 文件名含A股/sh/sz | ✅ 0个 |

> **结论: A股零残留 ✅** (R86-R158清理完成)

---

## 七、与策略模板的联动

| 模板系统 | 因子引用方式 | 状态 |
|----------|-------------|------|
| 新系统(46模板) | `factorCombo: [{ factorId, weight }]` | ✅ 每模板3-5个因子 |
| Server模板(36) | 部分引用factorId | ⚠️ 未验证 |
| 旧系统(30) | `parameters[]` 纯数值参数 | ❌ 无因子 |

> 新系统46个模板全部通过`factorCombo`引用因子，每个模板3-5个因子权重(0-100)

---

## 八、优化建议优先级

### 🔴 立即修复 (P0, 24h)
1. **i18n补齐** — 196个裸因子+清理132幽灵条目 (16h)
2. **Calculator映射验证** — 自动脚本校验240→Calculator (8h)

### 🟡 本迭代修复 (P1, 22h)
3. **文件整理** — 合并小文件+拆分大文件 (12h)
4. **注释更新** — 头注释187→240+清理旧引用 (4h)
5. **i18n拆分** — factor-i18n-map.ts→3文件 (6h)

### 🟢 下迭代优化 (P2, 28h)
6. **测试补全** — 适配器+计费+集成测试 (20h)
7. **端到端验证** — 信号→计费→UI全链路 (8h)

**总工时: 74h**

---

## 九、结论

因子系统核心架构健康(3层分类+240因子+22 AI计费+7市场适配器+0 @ts-nocheck+0 A股残留)，但存在两个关键短板：

1. **i18n覆盖率仅45%** — 196个因子在非中文环境下无说明文字
2. **Calculator映射未验证** — 197个声称的Calculator覆盖实际与注册表对不上

这两个问题直接影响用户能否正常使用因子功能，必须优先修复。其余为代码质量和测试覆盖的持续优化。

---

*审计完成时间: 2026-06-16 06:10 | 🦐 Claw (PM)*
