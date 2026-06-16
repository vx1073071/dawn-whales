---
title: Interactive Brokers 接入
description: 通过 IB Gateway/TWS 连接 Interactive Brokers
---

# Interactive Brokers 接入指南

## 前置条件

1. 拥有 [Interactive Brokers](https://www.interactivebrokers.com/) 账户
2. 下载并安装 [TWS (Trader Workstation)](https://www.interactivebrokers.com/en/trading/tws.php) 或 [IB Gateway](https://www.interactivebrokers.com/en/trading/ib-api.php)
3. 在 [IB Account Management](https://www.interactivebrokers.com/account/) → Settings → API → Enable API Connections

## 配置步骤

### 1. TWS/Gateway 设置

**File → Global Configuration → API → Settings**:

- ✅ Enable ActiveX and Socket Clients
- 端口: `7496` (TWS Live) / `7497` (TWS Paper) / `4002` (Gateway Live) / `4001` (Gateway Paper)
- ✅ "Allow connections from localhost only"
- Master API Client ID: 留空 (QUANT MOO 自动分配)

### 2. QUANT MOO 中连接

**设置 → 券商管理 → 添加券商 → Interactive Brokers**

| 字段 | 值 | 说明 |
|------|-----|------|
| 名称 | 我的IB账户 | 自定义显示名称 |
| 主机 | 127.0.0.1 | TWS/Gateway 运行的主机 |
| 端口 | 7497 | 模拟盘 7497 | 实盘 7496 |
| 客户端ID | 自动 | 系统自动分配唯一ID |
| 账户ID | U1234567 | 你的IB账户号 |

### 3. 首次授权

连接时 TWS/Gateway 会弹出确认框:
- 点击 **Yes** 接受连接
- 后续自动重连, 无需重复确认

## 功能矩阵

| 功能 | 支持 | 说明 |
|------|:----:|------|
| 实时行情 | ✅ | L1 + L2 (需订阅) |
| 历史K线 | ✅ | 30年历史数据 |
| 市价单 | ✅ | Market Order |
| 限价单 | ✅ | Limit Order |
| 止损单 | ✅ | Stop Order |
| 条件单 | ✅ | Conditional/Bracket |
| 算法单 | ✅ | VWAP/TWAP/Adaptive |
| 期权 | ✅ | Stock + Index Options |
| 期货 | ✅ | CME/CBOT/NYMEX |
| 外汇 | ✅ | Spot FX |
| 债券 | ✅ | US Treasuries |

## 费用

IB 佣金按交易量计费, QUANT MOO 平台费详见[费用说明](/user-manual/billing)。

## 故障排除

| 问题 | 解决方案 |
|------|---------|
| 连接被拒绝 | 检查 TWS 是否运行 + API 端口是否正确 |
| 认证失败 | 重启 TWS, 重新授权 |
| 数据延迟 | 订阅市场数据 (IB 需单独订阅实时行情) |
| 频繁断线 | 检查网络, 降低数据订阅频率 |

## 技术参考

实现文件: `electron/broker/ib-adapter.ts`
IPC 通道: `broker:ib:*`
