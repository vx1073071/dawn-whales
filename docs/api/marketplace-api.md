# 策略市场 API 文档

**版本**: v1.1.0-alpha  
**更新日期**: 2026-06-08  
**作者**: youdao  
**基础URL**: `https://api.dawn-whales.ai/v1`

---

## 目录

1. [API 概览](#api-概览)
2. [认证和授权](#认证和授权)
3. [策略 API](#策略-api)
4. [订阅 API](#订阅-api)
5. [评价 API](#评价-api)
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
| 策略 API | `/marketplace/strategies` | 策略发布、搜索、详情 |
| 订阅 API | `/marketplace/subscriptions` | 订阅管理 |
| 评价 API | `/marketplace/reviews` | 评价管理 |
| 收益 API | `/marketplace/earnings` | 收益和提现 |

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
| 查看策略 | 公开 | 无需认证 |
| 发布策略 | 已认证 | 需要登录 |
| 订阅策略 | 已认证 | 需要登录 |
| 评价策略 | 已订阅 | 需要订阅该策略 |
| 查看收益 | 作者 | 仅策略作者 |
| 提现 | 作者 | 仅策略作者 |

---

## 策略 API

### 发布策略

**端点**: `POST /marketplace/strategies`

**权限**: 已认证

**请求**:
```json
{
  "name": "双均线交叉策略",
  "description": "当短期均线上穿长期均线时买入，下穿时卖出",
  "code": "export class DualMAStrategy { ... }",
  "category": "trend",
  "tags": ["均线", "趋势", "短线"],
  "price": 0,
  "screenshots": [
    "https://example.com/screenshot1.png",
    "https://example.com/screenshot2.png"
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "strategy_123",
    "name": "双均线交叉策略",
    "status": "pending",
    "createdAt": 1717804800000
  }
}
```

**错误码**:
- `400001`: 策略名称已存在
- `400002`: 策略代码格式错误
- `400003`: 策略分类无效
- `400004`: 标签数量超过限制

### 获取策略列表

**端点**: `GET /marketplace/strategies`

**权限**: 公开

**查询参数**:
```
?category=trend           # 分类筛选
&tags=均线,趋势           # 标签筛选（逗号分隔）
&price=free               # 价格筛选（free/paid）
&minRating=4              # 最小评分
&sort=popular             # 排序（popular/newest/rating/price）
&page=1                   # 页码
&pageSize=20              # 每页数量
```

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "strategy_123",
        "name": "双均线交叉策略",
        "description": "当短期均线上线上穿长期均线时买入...",
        "author": {
          "id": "user_456",
          "nickname": "策略大师"
        },
        "category": "trend",
        "tags": ["均线", "趋势"],
        "price": 0,
        "stats": {
          "views": 1234,
          "subscriptions": 56,
          "rating": 4.5,
          "ratingCount": 23
        },
        "createdAt": 1717804800000,
        "updatedAt": 1717804800000
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

### 搜索策略

**端点**: `GET /marketplace/strategies/search`

**权限**: 公开

**查询参数**:
```
?q=均线                 # 搜索关键词
&category=trend         # 分类筛选
&tags=均线,趋势         # 标签筛选
&price=free             # 价格筛选
&page=1                 # 页码
&pageSize=20            # 每页数量
```

**响应**: 同获取策略列表

### 获取策略详情

**端点**: `GET /marketplace/strategies/{id}`

**权限**: 公开

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "strategy_123",
    "name": "双均线交叉策略",
    "description": "当短期均线上穿长期均线时买入，下穿时卖出",
    "code": "export class DualMAStrategy { ... }",
    "author": {
      "id": "user_456",
      "nickname": "策略大师",
      "avatar": "https://example.com/avatar.png"
    },
    "category": "trend",
    "tags": ["均线", "趋势", "短线"],
    "price": 0,
    "screenshots": [
      "https://example.com/screenshot1.png",
      "https://example.com/screenshot2.png"
    ],
    "stats": {
      "views": 1234,
      "subscriptions": 56,
      "rating": 4.5,
      "ratingCount": 23,
      "downloadCount": 78
    },
    "status": "published",
    "createdAt": 1717804800000,
    "updatedAt": 1717804800000
  }
}
```

**错误码**:
- `404001`: 策略不存在
- `403001`: 策略未发布

### 更新策略

**端点**: `PUT /marketplace/strategies/{id}`

**权限**: 作者

**请求**:
```json
{
  "name": "双均线交叉策略 v2",
  "description": "优化版双均线策略...",
  "code": "export class DualMAStrategyV2 { ... }",
  "tags": ["均线", "趋势", "优化"],
  "price": 100
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "strategy_123",
    "status": "pending",
    "updatedAt": 1717804800000
  }
}
```

**错误码**:
- `403002`: 无权限修改
- `400005`: 策略正在审核中

### 删除策略

**端点**: `DELETE /marketplace/strategies/{id}`

**权限**: 作者

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "strategy_123"
  }
}
```

**错误码**:
- `403002`: 无权限删除
- `400006`: 策略有活跃订阅

---

## 订阅 API

### 订阅策略

**端点**: `POST /marketplace/strategies/{id}/subscribe`

**权限**: 已认证

**请求**:
```json
{
  "duration": 1,  // 订阅时长（月）
  "autoRenew": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_123",
    "strategyId": "strategy_123",
    "status": "active",
    "expiresAt": 1720483200000,
    "autoRenew": true
  }
}
```

**错误码**:
- `400007`: 已订阅该策略
- `400008`: 支付失败
- `404001`: 策略不存在

### 获取我的订阅

**端点**: `GET /marketplace/subscriptions`

**权限**: 已认证

**查询参数**:
```
?status=active          # 状态筛选（active/cancelled/expired）
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
        "subscriptionId": "sub_123",
        "strategy": {
          "id": "strategy_123",
          "name": "双均线交叉策略",
          "author": {
            "id": "user_456",
            "nickname": "策略大师"
          }
        },
        "status": "active",
        "subscribedAt": 1717804800000,
        "expiresAt": 1720483200000,
        "autoRenew": true
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

### 取消订阅

**端点**: `POST /marketplace/subscriptions/{id}/cancel`

**权限**: 订阅者

**响应**:
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_123",
    "status": "cancelled",
    "cancelledAt": 1717804800000
  }
}
```

**错误码**:
- `403003`: 无权限取消
- `400009`: 订阅已取消

### 续订订阅

**端点**: `POST /marketplace/subscriptions/{id}/renew`

**权限**: 订阅者

**请求**:
```json
{
  "duration": 1  // 续订时长（月）
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_123",
    "status": "active",
    "expiresAt": 1723161600000
  }
}
```

**错误码**:
- `403003`: 无权限续订
- `400010`: 订阅未过期

---

## 评价 API

### 发表评价

**端点**: `POST /marketplace/strategies/{id}/reviews`

**权限**: 已订阅

**请求**:
```json
{
  "rating": 5,
  "comment": "这个策略非常好用，回测效果很好！"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "reviewId": "review_123",
    "strategyId": "strategy_123",
    "rating": 5,
    "comment": "这个策略非常好用，回测效果很好！",
    "createdAt": 1717804800000
  }
}
```

**错误码**:
- `400011`: 未订阅该策略
- `400012`: 已评价过该策略
- `400013`: 评分无效（1-5）
- `400014`: 评论内容过长

### 获取策略评价

**端点**: `GET /marketplace/strategies/{id}/reviews`

**权限**: 公开

**查询参数**:
```
?sort=newest            # 排序（newest/rating）
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
        "reviewId": "review_123",
        "user": {
          "id": "user_789",
          "nickname": "用户昵称",
          "avatar": "https://example.com/avatar.png"
        },
        "rating": 5,
        "comment": "这个策略非常好用，回测效果很好！",
        "createdAt": 1717804800000,
        "updatedAt": 1717804800000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 23,
      "totalPages": 2
    }
  }
}
```

### 更新评价

**端点**: `PUT /marketplace/reviews/{id}`

**权限**: 评价者

**请求**:
```json
{
  "rating": 4,
  "comment": "策略不错，但需要进一步优化"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "reviewId": "review_123",
    "rating": 4,
    "comment": "策略不错，但需要进一步优化",
    "updatedAt": 1717804800000
  }
}
```

**错误码**:
- `403004`: 无权限修改

### 删除评价

**端点**: `DELETE /marketplace/reviews/{id}`

**权限**: 评价者

**响应**:
```json
{
  "success": true,
  "data": {
    "reviewId": "review_123"
  }
}
```

**错误码**:
- `403004`: 无权限删除

---

## 收益 API

### 查看收益概览

**端点**: `GET /marketplace/earnings`

**权限**: 作者

**响应**:
```json
{
  "success": true,
  "data": {
    "totalEarnings": 35000,
    "pendingEarnings": 3500,
    "withdrawnEarnings": 31500,
    "thisMonthEarnings": 3500,
    "lastMonthEarnings": 7000
  }
}
```

### 查看收益明细

**端点**: `GET /marketplace/earnings/details`

**权限**: 作者

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
        "strategyId": "strategy_123",
        "strategyName": "双均线交叉策略",
        "subscriptionCount": 50,
        "earnings": 3500,
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

**端点**: `POST /marketplace/earnings/withdraw`

**权限**: 作者

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
- `400015`: 提现金额不足
- `400016`: 提现金额低于最低限额
- `400017`: 账户信息无效
- `400018`: 今日提现次数已达上限

### 查看提现记录

**端点**: `GET /marketplace/earnings/withdrawals`

**权限**: 作者

**查询参数**:
```
?status=processing      # 状态筛选（processing/completed/failed）
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

### 策略错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400001 | 策略名称已存在 | 400 |
| 400002 | 策略代码格式错误 | 400 |
| 400003 | 策略分类无效 | 400 |
| 400004 | 标签数量超过限制 | 400 |
| 400005 | 策略正在审核中 | 400 |
| 400006 | 策略有活跃订阅 | 400 |
| 403001 | 策略未发布 | 403 |
| 403002 | 无权限修改/删除 | 403 |
| 404001 | 策略不存在 | 404 |

### 订阅错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400007 | 已订阅该策略 | 400 |
| 400008 | 支付失败 | 400 |
| 400009 | 订阅已取消 | 400 |
| 400010 | 订阅未过期 | 400 |
| 403003 | 无权限操作订阅 | 403 |

### 评价错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400011 | 未订阅该策略 | 400 |
| 400012 | 已评价过该策略 | 400 |
| 400013 | 评分无效（1-5） | 400 |
| 400014 | 评论内容过长 | 400 |
| 403004 | 无权限修改/删除评价 | 403 |

### 收益错误码

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| 400015 | 提现金额不足 | 400 |
| 400016 | 提现金额低于最低限额 | 400 |
| 400017 | 账户信息无效 | 400 |
| 400018 | 今日提现次数已达上限 | 400 |
| 403005 | 无权限查看收益 | 403 |

---

## 示例代码

### JavaScript/TypeScript 示例

```typescript
import axios from 'axios';

const API_BASE_URL = 'https://api.dawn-whales.ai/v1';

class MarketplaceAPI {
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

  // 获取策略列表
  async getStrategies(params?: {
    category?: string;
    tags?: string[];
    price?: 'free' | 'paid';
    minRating?: number;
    sort?: 'popular' | 'newest' | 'rating' | 'price';
    page?: number;
    pageSize?: number;
  }) {
    const response = await axios.get(`${API_BASE_URL}/marketplace/strategies`, {
      headers: this.getHeaders(),
      params,
    });
    return response.data;
  }

  // 搜索策略
  async searchStrategies(query: string, params?: {
    category?: string;
    tags?: string[];
    page?: number;
    pageSize?: number;
  }) {
    const response = await axios.get(`${API_BASE_URL}/marketplace/strategies/search`, {
      headers: this.getHeaders(),
      params: { q: query, ...params },
    });
    return response.data;
  }

  // 获取策略详情
  async getStrategy(strategyId: string) {
    const response = await axios.get(
      `${API_BASE_URL}/marketplace/strategies/${strategyId}`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 发布策略
  async publishStrategy(data: {
    name: string;
    description: string;
    code: string;
    category: string;
    tags: string[];
    price: number;
  }) {
    const response = await axios.post(
      `${API_BASE_URL}/marketplace/strategies`,
      data,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 订阅策略
  async subscribeStrategy(strategyId: string, duration: number = 1) {
    const response = await axios.post(
      `${API_BASE_URL}/marketplace/strategies/${strategyId}/subscribe`,
      { duration, autoRenew: true },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 发表评价
  async submitReview(strategyId: string, rating: number, comment: string) {
    const response = await axios.post(
      `${API_BASE_URL}/marketplace/strategies/${strategyId}/reviews`,
      { rating, comment },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 查看收益
  async getEarnings() {
    const response = await axios.get(
      `${API_BASE_URL}/marketplace/earnings`,
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  // 提现
  async withdraw(amount: number, method: 'bank' | 'alipay', account: any) {
    const response = await axios.post(
      `${API_BASE_URL}/marketplace/earnings/withdraw`,
      { amount, method, account },
      { headers: this.getHeaders() }
    );
    return response.data;
  }
}

// 使用示例
const api = new MarketplaceAPI('your_token_here');

// 获取策略列表
const strategies = await api.getStrategies({
  category: 'trend',
  sort: 'popular',
  page: 1,
  pageSize: 20,
});

// 搜索策略
const searchResults = await api.searchStrategies('均线', {
  category: 'trend',
});

// 发布策略
const newStrategy = await api.publishStrategy({
  name: '双均线交叉策略',
  description: '当短期均线上穿长期均线时买入...',
  code: 'export class DualMAStrategy { ... }',
  category: 'trend',
  tags: ['均线', '趋势'],
  price: 0,
});

// 订阅策略
const subscription = await api.subscribeStrategy('strategy_123', 1);

// 发表评价
const review = await api.submitReview('strategy_123', 5, '非常好用！');

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

class MarketplaceAPI:
    def __init__(self, token: str):
        self.token = token
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        }

    def get_strategies(self, **params):
        """获取策略列表"""
        response = requests.get(
            f'{API_BASE_URL}/marketplace/strategies',
            headers=self.headers,
            params=params,
        )
        return response.json()

    def search_strategies(self, query: str, **params):
        """搜索策略"""
        params['q'] = query
        response = requests.get(
            f'{API_BASE_URL}/marketplace/strategies/search',
            headers=self.headers,
            params=params,
        )
        return response.json()

    def get_strategy(self, strategy_id: str):
        """获取策略详情"""
        response = requests.get(
            f'{API_BASE_URL}/marketplace/strategies/{strategy_id}',
            headers=self.headers,
        )
        return response.json()

    def publish_strategy(self, data: dict):
        """发布策略"""
        response = requests.post(
            f'{API_BASE_URL}/marketplace/strategies',
            headers=self.headers,
            json=data,
        )
        return response.json()

    def subscribe_strategy(self, strategy_id: str, duration: int = 1):
        """订阅策略"""
        response = requests.post(
            f'{API_BASE_URL}/marketplace/strategies/{strategy_id}/subscribe',
            headers=self.headers,
            json={'duration': duration, 'autoRenew': True},
        )
        return response.json()

    def submit_review(self, strategy_id: str, rating: int, comment: str):
        """发表评价"""
        response = requests.post(
            f'{API_BASE_URL}/marketplace/strategies/{strategy_id}/reviews',
            headers=self.headers,
            json={'rating': rating, 'comment': comment},
        )
        return response.json()

    def get_earnings(self):
        """查看收益"""
        response = requests.get(
            f'{API_BASE_URL}/marketplace/earnings',
            headers=self.headers,
        )
        return response.json()

    def withdraw(self, amount: float, method: str, account: dict):
        """提现"""
        response = requests.post(
            f'{API_BASE_URL}/marketplace/earnings/withdraw',
            headers=self.headers,
            json={'amount': amount, 'method': method, 'account': account},
        )
        return response.json()


# 使用示例
api = MarketplaceAPI('your_token_here')

# 获取策略列表
strategies = api.get_strategies(
    category='trend',
    sort='popular',
    page=1,
    pageSize=20,
)

# 搜索策略
search_results = api.search_strategies('均线', category='trend')

# 发布策略
new_strategy = api.publish_strategy({
    'name': '双均线交叉策略',
    'description': '当短期均线上穿长期均线时买入...',
    'code': 'export class DualMAStrategy { ... }',
    'category': 'trend',
    'tags': ['均线', '趋势'],
    'price': 0,
})

# 订阅策略
subscription = api.subscribe_strategy('strategy_123', 1)

# 发表评价
review = api.submit_review('strategy_123', 5, '非常好用！')

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

- [v1.1.0-alpha Release Notes](../releases/v1.1.0-alpha-release-notes.md)
- [策略市场用户指南](../guides/marketplace-user-guide.md)
- [v1.1.0 路线图](../roadmap/v1.1.0-roadmap.md)
- [API 参考文档](./api-reference.md)

### 联系方式

- API 支持: api-support@dawn-whales.ai
- 技术支持: support@dawn-whales.ai
- 社区论坛: https://community.dawn-whales.ai

---

**文档版本**: v1.1.0-alpha  
**最后更新**: 2026-06-08T04:10:00+08:00  
**作者**: youdao  
**状态**: ✅ 策略市场 API 文档完成
