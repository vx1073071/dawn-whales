# R244 Factor Calculator 映射分析报告

> P0-11 | LOBEHUB | 2026-06-16

---

## 总览

| 指标 | 值 |
|------|:--:|
| 因子注册总数 | **240** |
| Calculator匹配 | **53** (22.1%) |
| 缺失 Calculator | **187** (77.9%) |

## 状态分布

| 状态 | 数量 | 占比 |
|------|:--:|:--:|
| ✅ 匹配 | 53 | 22.1% |
| ❌ 缺失 | 187 | 77.9% |

## Calculator文件覆盖

| 文件 | 引用因子数 | 行数 |
|------|:--:|:--:|
| green-factor-calculators.ts | 72 | 99L |
| yellow-factor-calculators.ts | 58 | 63L |
| market-yellow-calculators.ts | 51 | 56L |
| pro-factor-calculators.ts | 47 | 313L |
| WasmFactorCalculator.ts | 22 | 612L |
| factor-calculator.ts | 8 | 796L |
| factor-calculator-stubs.ts | 0 | 22L |

> ⚠️ 注意：多数Calculator文件行数异常偏少（22-99行），疑似mock/占位。

## 按L1大类覆盖率

| L1大类 | 总数 | 匹配 | 缺失 | 覆盖率 |
|------|:--:|:--:|:--:|:--:|
| L1_FUNDAMENTAL | 24 | 12 | 12 | 50% |
| L1_TECHNICAL | 11 | 4 | 7 | 36% |
| L1_SENTIMENT | 17 | 6 | 11 | 35% |
| L1_CLASSIC | 15 | 5 | 10 | 33% |
| L1_HK | 19 | 5 | 14 | 26% |
| L1_US | 18 | 5 | 13 | 28% |
| L1_CROSS_ASSET | 15 | 4 | 11 | 27% |
| L1_MACRO | 17 | 4 | 13 | 24% |
| L1_CRYPTO | 36 | 6 | 30 | 17% |
| L1_EVENT | 8 | 1 | 7 | 13% |
| L1_RISK | 15 | 1 | 14 | 7% |
| **L1_COMMODITY** | **26** | **0** | **26** | **0%** 🔴 |
| **L1_ANALYST** | **6** | **0** | **6** | **0%** 🔴 |
| **L1_ESG** | **6** | **0** | **6** | **0%** 🔴 |
| **L1_REVERSAL** | **5** | **0** | **5** | **0%** 🔴 |
| **L1_LEGACY** | **2** | **0** | **2** | **0%** 🔴 |

## 全部缺失因子 (187个)

详见JSON: `docs/audits/R244-calculator-mapping.json`

## 修复建议

### P0 — 立即修复
1. **COMMODITY (26个)**: 商品因子完全无Calculator → 建议JVS在factor-calculator.ts补充
2. **CRYPTO (30个)**: 加密因子仅6个匹配 → market-yellow-calculators.ts扩展
3. **RISK (14个/15中仅1个)**: WasmFactorCalculator.ts兜底但无JS fallback

### P1 — 本周
- **ANALYST + ESG + REVERSAL + LEGACY** (19个): 4大类完全空白
- Calculator文件行数存疑 (22-99行 → production代码应在300L+)

### 数据真实性
- factor-calculator-stubs.ts: 22行，0个因子引用 → 可能为空占位文件
- yellow-factor-calculators.ts: 63行，"computeAllYellowFactors" → 可能为单函数mock

---

> 生成: 2026-06-16 | 分析工具: R244 P0-11 Calculator Mapping Analyzer (LOBEHUB)
