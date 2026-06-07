# 社交交易 API 文档

**版本**: v1.1.0-beta  
**更新日期**: 2026-06-08  
**作者**: youdao  
**基础URL**: `https://api.dawn-whales.ai/v1`

---

## 目录

1. [API 概览](#api-概览)
2. [认证和授权](#认证和授权)
3. [交易员 API](#交易员-api)
4. [信号 API](#信号-api)
5. [跟随交易 API](#跟随交易-api)
6. [收益 API](#收益-api)
7. [错误码说明](#错误码说明)
8. [示例代码](#示例代码)

---

## API 概览

### 基础信息

- **基础URL**: `https://api.dawn-whales.ai/v1`
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token

### API 分类

| 分类 | 端点前缀 | 说明 |
|-----|---------|------|
| 交易员 API | `/social/traders` | 交易员注册、认证、主页 |
| 信号 API | `/social/signals` | 信号发布、列表、详情 |
| 跟随交易 API | `/social/follows` | 跟随交易管理 |
| 收益 API | `/social/earnings` | 收益和提现 |

### 通用请求头

```http
Content-Type: application/json
Authorization: Bearer <token>
Accept: application/json
Accept-Language: zh-CN
```

### 通用响应格式

```json
{
  "success": true,
  "data": { ... },
  "message": "Success",
  "timestamp": 1717804800000
}
```

### 分页参数

```
?page=1          # 页码（从 1 开始）
&pageSize=20     # 每页数量（默认 20，最大 100）
```

### 分页响应格式

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

## 认证和授权

### 获取 Token

**端点**: `POST /auth/login`

**请求**:
```json
{
  "username": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "user": {
      "id": "user_123",
      "username": "user@example.com",
      "nickname": "用户昵称"
    }
  }
}
```

### Token 刷新

**端点**: `POST /auth/refresh`

**请求**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

### 权限说明

| 操作 | 权限 | 说明 |
|-----|------|------|
| 查看交易员 | 公开 | 无需认证 |
| 注册交易员 | 已认证 | 需要登录 |
| 发布信号 | 认证交易员 | 需要认证 |
| 跟随交易 | 已认证 | 需要登录 |
| 查看收益 | 交易员 | 仅交易员 |
| 提现 | 交易员 | 仅交易员 |

---

## 交易员 API

### 注册交易员

**端点**: `POST /social/traders/register`

**权限**: 已认证

**请求**:
```json
{
  "nickname": "交易大师",
  "avatar": "https://example.com/avatar.png",
  "bio": "10年交易经验，专注趋势交易",
  "experience": "10年股票交易经验",
  "style": "趋势跟踪"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "trader_123",
    "userId": "user_456",
    "nickname": "交易大师",
    "status": "pending",
    "createdAt": 1717804800000
  }
}
```

**错误码**:
- `400001`: 昵称已存在
- `400002`: 简介过长
- `400003`: 头像格式错误

### 申请认证

**端点**: `POST /social/traders/{id}/certify`

**权限**: 交易员

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "trader_123",
    "status": "pending",
    "certifiedAt": null
  }
}
```

**错误码**:
- `403001`: 无权限认证
- `400004`: 已认证

### 获取交易员主页

**端点**: `GET /social/traders/{id}`

**权限**: 公开

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "trader_123",
    "userId": "user_456",
    "nickname": "交易大师",
    "avatar": "https://example.com/avatar.png",
    "bio": "10年交易经验，专注趋势交易",
    "verified": true,
    "stats": {
      "totalSignals": 150,
      "followers": 500,
      "following": 50,
      "successRate": 0.75,
      "totalProfit": 50000
    },
    "createdAt": 1717804800000
  }
}
```

**错误码**:
- `404001`: 交易员不存在

### 获取交易员列表

**端点**: `GET /social/traders`

**权限**: 公开

**查询参数**:
```
?verified=true        # 是否认证
&sortBy=followers     # 排序（followers/profit/signals）
&page=1               # 页码
&pageSize=20          # 每页数量
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "trader_123",
        "nickname": "交易大师",
        "avatar": "https://example.com/avatar.png",
        "verified": true,
        "stats": {
          "totalSignals": 150,
          "followers": 500,
          "successRate": 0.75
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 关注交易员

**端点**: `POST /social/traders/{id}/follow`

**权限**: 已认证

**响应**:
```json
{
  "success": true,
  "data": {
    "traderId": "trader_123",
    "followedAt": 1717804800000
  }
}
```

**错误码**:
- `400005`: 已关注
- `404001`: 交易员不存在

### 取消关注

**端点**: `DELETE /social/traders/{id}/follow`

**权限**: 已认证

**响应**:
```json
{
  "success": true,
  "data": {
    "traderId": "trader_123"
  }
}
```

**错误码**:
- `400006`: 未关注

---

## 信号 API

### 发布信号

**端点**: `POST /social/signals`

**权限**: 认证交易员

**请求**:
```json
{
  "symbol": "HK.00700",
  "action": "BUY",
  "entryPrice": 380.00,
  "stopLoss": 370.00,
  "takeProfit": 400.00,
  "confidence": 0.85,
  "description": "腾讯突破关键阻力位，成交量放大"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "signal_123",
    "traderId": "trader_123",
    "symbol": "HK.00700",
    "action": "BUY",
    "entryPrice": 380.00,
    "status": "active",
    "createdAt": 1717804800000
  }
}
```

**错误码**:
- `403002`: 无权限发布
- `400007`: 参数无效
- `400008`: 价格无效

### 获取信号列表

**端点**: `GET /social/signals`

**权限**: 公开

**查询参数**:
```
?traderId=trader_123  # 交易员ID
&symbol=HK.00700      # 标的
&status=active        # 状态（active/closed/cancelled）
&sortBy=createdAt     # 排序（createdAt/confidence）
&page=1               # 页码
&pageSize=20          # 每页数量
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "signal_123",
        "trader": {
          "id": "trader_123",
          "nickname": "交易大师",
          "verified": true
        },
        "symbol": "HK.00700",
        "action": "BUY",
        "entryPrice": 380.00,
        "stopLoss": 370.00,
        "takeProfit": 400.00,
        "confidence": 0.85,
        "status": "active",
        "followers": 50,
        "createdAt": 1717804800000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### 获取信号详情

**端点**: `GET /social/signals/{id}`

**权限**: 公开

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "signal_123",
    "trader": {
      "id": "trader_123",
      "nickname": "交易大师",
      "verified": true
    },
    "symbol": "HK.00700",
    "action": "BUY",
    "entryPrice": 380.00,
    "stopLoss": 370.00,
    "takeProfit": 400.00,
    "confidence": 0.85,
    "description": "腾讯突破关键阻力位，成交量放大",
    "status": "active",
    "result": null,
    "followers": 50,
    "createdAt": 1717804800000,
    "closedAt": null
  }
}
```

**错误码**:
- `404002`: 信号不存在

### 关闭信号

**端点**: `POST /social/signals/{id}/close`

**权限**: 信号作者

**请求**:
```json
{
  "exitPrice": 395.00
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "signal_123",
    "status": "closed",
    "result": {
      "exitPrice": 395.00,
      "profit": 15.00,
      "closedAt": 1717808400000
    }
  }
}
```

**错误码**:
- `403003`: 无权限关闭
- `400009`: 信号已关闭

### 取消信号

**端点**: `DELETE /social/signals/{id}`

**权限**: 信号作者

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "signal_123"
  }
}
```

**错误码**:
- `403003`: 无权限取消
- `400010`: 信号已关闭

---

## 跟随交易 API

### 跟随交易

**端点**: `POST /social/signals/{id}/follow`

**权限**: 已认证

**请求**:
```json
{
  "positionSize": 10000,
  "stopLoss": 370.00,
  "takeProfit": 400.00
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "follow_123",
    "signalId": "signal_123",
    "traderId": "trader_123",
    "userId": "user_456",
    "config": {
      "positionSize": 10000,
      "stopLoss": 370.00,
      "takeProfit": 400.00
    },
    "status": "active",
    "createdAt": 1717804800000
  }
}
```

**错误码**:
- `400011`: 已跟随
- `400012`: 信号已关闭
- `400013`: 参数无效

### 获取我的跟随

**端点**: `GET /social/follows`

**权限**: 已认证

**查询参数**:
```
?status=active        # 状态（active/closed/cancelled）
&page=1               # 页码
&pageSize=20          # 每页数量
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "follow_123",
        "signal": {
          "id": "signal_123",
          "symbol": "HK.00700",
          "action": "BUY",
          "entryPrice": 380.00
        },
        "trader": {
          "id": "trader_123",
          "nickname": "交易大师"
        },
        "config": {
          "positionSize": 10000,
          "stopLoss": 370.00,
          "takeProfit": 400.00
        },
        "status": "active",
        "result": null,
        "createdAt": 1717804800000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

### 取消跟随

**端点**: `DELETE /social/follows/{id}`

**权限**: 跟随者

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "follow_123"
  }
}
```

**错误码**:
- `403004`: 无权限取消
- `400014`: 跟随已关闭

### 修改跟随参数

**端点**: `PUT /social/follows/{id}`

**权限**: 跟随者

**请求**:
```json
{
  "positionSize": 15000,
  "stopLoss": 365.00,
  "takeProfit": 405.00
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "follow_123",
    "config": {
      "positionSize": 15000,
      "stopLoss": 365.00,
      "takeProfit": 405.00
    }
  }
}
```

**错误码**:
- `403004`: 无权限修改
- `400015`: 参数无效

---

## 收益 API

### 查看收益概览

**端点**: `GET /social/earnings`

**权限**: 交易员

**响应**:
```json
{
  "success": true,
  "data": {
    "totalEarnings": 50000,
    "pendingEarnings": 5000,
    "withdrawnEarnings": 45000,
    "thisMonthEarnings": 5000,
    "lastMonthEarnings": 10000
  }
}
```

### 查看收益明细

**端点**: `GET /social/earnings/details`

**权限**: 交易员

**查询参数**:
```
?startDate=2026-06-01   # 开始日期
&endDate=2026-06-30     # 结束日期
&page=1                 # 页码
&pageSize=20            # 每页数量
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "date": "2026-06-07",
        "followerId": "user_789",
        "signalId": "signal_123",
        "profit": 1000,
        "earnings": 300,
        "status": "pending"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 30,
      "totalPages": 2
    }
  }
}
```

### 提现

**端点**: `POST /social/earnings/withdraw`

**权限**: 交易员

**请求**:
```json
{
  "amount": 1000,
  "method": "bank",
  "account": {
    "bankName": "中国银行",
    "accountNumber": "6222021234567890123",
    "accountName": "张三"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "withdrawId": "withdraw_123",
    "amount": 1000,
    "method": "bank",
    "status": "processing",
    "createdAt": 1717804800000,
    "estimatedArrival": 1718064000000
  }
}
```

**错误码**:
- `400016`: 提现金额不足
- `400017`: 提现金额低于最低限额
- `400018`: 账户信息无效
- `400019`: 今日提现次数已达上限

### 查看提现记录

**端点**: `GET /social/earnings/withdrawals`

**权限**: 交易员

**查询参数**:
```
?status=processing      # 状态（processing/completed/failed）
&page=1                 # 页码
&pageSize=20            # 每页数量
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "withdrawId": "withdraw_123",
        "amount": 1000,
        "method": "bank",
        "status": "processing",
        "createdAt": 1717804800000,
        "estimatedArrival": 1718064000000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

## 错误码说明

### 通用错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400000 | 请求参数错误 | 400 |
| 401000 | 未认证 | 401 |
| 403000 | 无权限 | 403 |
| 404000 | 资源不存在 | 404 |
| 500000 | 服务器内部错误 | 500 |

### 交易员错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400001 | 昵称已存在 | 400 |
| 400002 | 简介过长 | 400 |
| 400003 | 头像格式错误 | 400 |
| 400004 | 已认证 | 400 |
| 400005 | 已关注 | 400 |
| 400006 | 未关注 | 400 |
| 403001 | 无权限认证 | 403 |
| 404001 | 交易员不存在 | 404 |

### 信号错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400007 | 参数无效 | 400 |
| 400008 | 价格无效 | 400 |
| 400009 | 信号已关闭 | 400 |
| 400010 | 信号已取消 | 400 |
| 403002 | 无权限发布 | 403 |
| 403003 | 无权限关闭/取消 | 403 |
| 404002 | 信号不存在 | 404 |

### 跟随交易错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400011 | 已跟随 | 400 |
| 400012 | 信号已关闭 | 400 |
| 400013 | 参数无效 | 400 |
| 400014 | 跟随已关闭 | 400 |
| 400015 | 参数无效 | 400 |
| 403004 | 无权限操作 | 403 |

### 收益错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400016 | 提现金额不足 | 400 |
| 400017 | 提现金额低于最低限额 | 400 |
| 400018 | 账户信息无效 | 400 |
| 400019 | 今日提现次数已达上限 | 400 |
| 403005 | 无权限查看收益 | 403 |

---

## 示例代码

### JavaScript/TypeScript 示例

```typescript
import axios from 'axios';

const API_BASE_URL = 'https://api.dawn-whales.ai/v1';

class SocialTradingAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
  }

  // 交易员 API
  async registerTrader(data: {
    nickname: string;
    avatar: string;
    bio: string;
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/social/traders/register`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getTrader(traderId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/social/traders/${traderId}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async followTrader(traderId: string) {
    const response = await axios.post(
      `${API_BASE_URL}/social/traders/${traderId}/follow`,
      {},
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 信号 API
  async publishSignal(data: {
    symbol: string;
    action: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    confidence: number;
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/social/signals`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getSignals(params?: {
    traderId?: string;
    symbol?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const response = await axios.get(
      `${API_BASE_URL}/social/signals`,
      { headers: this.getHeaders(), params }
    );
    return response.data;
  }

  // 跟随交易 API
  async followSignal(signalId: string, config: {
    positionSize: number;
    stopLoss?: number;
    takeProfit?: number;
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/social/signals/${signalId}/follow`,
      config,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getFollows(params?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const response = await axios.get(
      `${API_BASE_URL}/social/follows`,
      { headers: this.getHeaders(), params }
    );
    return response.data;
  }

  // 收益 API
  async getEarnings() {
    const response = await axios.get(
      `${API_BASE_URL}/social/earnings`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async withdraw(amount: number, method: string, account: any) {
    const response = await axios.post(
      `${API_BASE_URL}/social/earnings/withdraw`,
      { amount, method, account },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

// 使用示例
const api = new SocialTradingAPI('your_token_here');

// 注册交易员
const trader = await api.registerTrader({
  nickname: '交易大师',
  avatar: 'https://example.com/avatar.png',
  bio: '10年交易经验',
});

// 发布信号
const signal = await api.publishSignal({
  symbol: 'HK.00700',
  action: 'BUY',
  entryPrice: 380.00,
  stopLoss: 370.00,
  takeProfit: 400.00,
  confidence: 0.85,
});

// 跟随交易
const follow = await api.followSignal('signal_123', {
  positionSize: 10000,
  stopLoss: 370.00,
  takeProfit: 400.00,
});

// 查看收益
const earnings = await api.getEarnings();

// 提现
const withdrawal = await api.withdraw(1000, 'bank', {
  bankName: '中国银行',
  accountNumber: '6222021234567890123',
  accountName: '张三',
});
```

### Python 示例

```python
import requests

API_BASE_URL = 'https://api.dawn-whales.ai/v1'

class SocialTradingAPI:
    def __init__(self, token: str):
        self.token = token
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        }

    def register_trader(self, data: dict):
        """注册交易员"""
        response = requests.post(
            f'{API_BASE_URL}/social/traders/register',
            headers=self.headers,
            json=data,
        )
        return response.json()

    def get_trader(self, trader_id: str):
        """获取交易员主页"""
        response = requests.get(
            f'{API_BASE_URL}/social/traders/{trader_id}',
            headers=self.headers,
        )
        return response.json()

    def publish_signal(self, data: dict):
        """发布信号"""
        response = requests.post(
            f'{API_BASE_URL}/social/signals',
            headers=self.headers,
            json=data,
        )
        return response.json()

    def follow_signal(self, signal_id: str, config: dict):
        """跟随交易"""
        response = requests.post(
            f'{API_BASE_URL}/social/signals/{signal_id}/follow',
            headers=self.headers,
            json=config,
        )
        return response.json()

    def get_earnings(self):
        """查看收益"""
        response = requests.get(
            f'{API_BASE_URL}/social/earnings',
            headers=self.headers,
        )
        return response.json()

    def withdraw(self, amount: float, method: str, account: dict):
        """提现"""
        response = requests.post(
            f'{API_BASE_URL}/social/earnings/withdraw',
            headers=self.headers,
            json={'amount': amount, 'method': method, 'account': account},
        )
        return response.json()


# 使用示例
api = SocialTradingAPI('your_token_here')

# 注册交易员
trader = api.register_trader({
    'nickname': '交易大师',
    'avatar': 'https://example.com/avatar.png',
    'bio': '10年交易经验',
})

# 发布信号
signal = api.publish_signal({
    'symbol': 'HK.00700',
    'action': 'BUY',
    'entryPrice': 380.00,
    'stopLoss': 370.00,
    'takeProfit': 400.00,
    'confidence': 0.85,
})

# 跟随交易
follow = api.follow_signal('signal_123', {
    'positionSize': 10000,
    'stopLoss': 370.00,
    'takeProfit': 400.00,
})

# 查看收益
earnings = api.get_earnings()

# 提现
withdrawal = api.withdraw(1000, 'bank', {
    'bankName': '中国银行',
    'accountNumber': '6222021234567890123',
    'accountName': '张三',
})
```

---

## 附录

### 相关文档

- [v1.1.0-beta Release Notes](../releases/v1.1.0-beta-release-notes.md)
- [社交交易用户指南](../guides/social-trading-user-guide.md)
- [v1.1.0 路线图更新](../roadmap/v1.1.0-roadmap-update.md)
- [API 参考文档](./api-reference.md)

### 联系方式

- API 支持: api-support@dawn-whales.ai
- 技术支持: support@dawn-whales.ai
- 社区论坛: https://community.dawn-whales.ai

---

**文档版本**: v1.1.0-beta  
**最后更新**: 2026-06-08T05:10:00+08:00  
**作者**: youdao  
**状态**: ✅ 社交交易 API 文档完成
