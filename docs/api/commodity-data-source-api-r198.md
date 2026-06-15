# 📡 Commodity Data Source API Reference — v3.2.0

> autoclaw R198 · CFTC / EIA / LME / GLD integration docs

## Overview

Commodity factors consume 4 external data sources:

| Source | Frequency | Access | Coverage |
|--------|-----------|--------|----------|
| **CFTC COT** | Weekly (Fri 15:30 ET) | Public | All US futures |
| **EIA** | Weekly (Wed 10:30 ET) | Public | Crude + NatGas |
| **LME** | Daily (09:00 GMT) | Registration | Base metals |
| **GLD/IAU** | Daily | Public | Gold ETF holdings |

---

## 1. CFTC Commitments of Traders (COT)

### Endpoint
```
GET https://www.cftc.gov/dea/futures/deacbtfut.txt  (Legacy format)
GET https://www.cftc.gov/dea/futures/deacitf.txt     (Disaggregated)
```

### Key Fields
| Field | Description | Used By |
|-------|-------------|---------|
| `Producer/Merchant/Processor/User Long/Short` | Commercial hedgers | CMD_BALANCE_SHEET |
| `Managed Money Long/Short` | Hedge funds / CTAs | CMD_MOMENTUM_* |
| `Other Reportables Long/Short` | Large speculators | CMD_ROLL_YIELD |
| `Nonreportable Long/Short` | Small speculators (retail) | Sentiment proxy |

### Normalization
- Each position = `(net_long - net_short) / total_open_interest`
- Z-score across 3-year rolling window
- Extremes: `abs(z) > 2` → signal

---

## 2. EIA Petroleum Status Report

### Endpoint (API key required)
```
GET https://api.eia.gov/v2/petroleum/stock/weekly/?api_key=XXX
```

### Key Fields
| Field | Description | Model Field |
|-------|-------------|-------------|
| `WCRSTUS1` | Crude excl SPR (千桶) | CMD_EIA_CRUDE |
| `WGTSTUS1` | Total Gasoline | Crack spread calc |
| `WDISTUS1` | Distillate Fuel Oil | Crack spread calc |
| `W_NAEPP_S0P_R10_SA_NUS_MBBL` | NatGas working gas | CMD_NATGAS_STORAGE |

### Signal Construction
1. `actual_change = current_week - previous_week`
2. `surprise = (actual_change - analyst_consensus) / consensus_stddev`
3. `surprise < -2` → strong bullish (inventory draw > expected)
4. `surprise > +2` → strong bearish

---

## 3. LME Inventory Data

### Endpoint
```
GET https://www.lme.com/api/stock-reports/lme-warehouse-and-off-warrant-stocks
```

### Key Fields
| Field | Description |
|-------|-------------|
| `on_warrant` | Registered (available for delivery) |
| `cancelled_warrant` | Booked for outbound (real demand signal) |
| `total` | on_warrant + cancelled_warrant |

### Signal Construction
- `cancelled_ratio = cancelled_warrant / total`
- `inventory_z = (total - 5yr_avg) / 5yr_stddev`
- Joint score: `cancelled_ratio > 0.4 AND inventory_z < -1` → strong buy

---

## 4. Gold ETF (GLD/IAU)

### Endpoint
```
GET https://www.spdrgoldshares.com/assets/dynamic/holdings/SPDRGoldShares_Holdings.csv  (GLD)
GET https://www.ishares.com/us/products/239561/ishares-gold-trust  (IAU, scrape or API)
```

### Signal Construction
- `weekly_flow = holdings_t - holdings_t-7`
- `z_score = (weekly_flow - 52wk_avg) / 52wk_stddev`
- `z > 2` → strong ETF inflow → bullish gold

---

## 5. Usage Notes

- **Time alignment**: EIA Wednesday, CFTC Friday, LME daily, GLD daily
- **Holiday gaps**: US/EU/CN holidays affect all sources — skip signal on missing data
- **Revision handling**: EIA data is FINAL after 1 week; CFTC revised after 2 weeks
- **Caching**: 1h TTL for LME/GLD, 1-week TTL for CFTC/EIA

---

_autoclaw · R198 · 2026-06-15_
