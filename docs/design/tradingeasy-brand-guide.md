# TradingEasy 品牌指南 v1.0

> 版本: v1.0 | 日期: 2026-06-15 | 维护: QClaw(设计虾)
> 适用范围: 全平台 (桌面端 + 落地页 + 服务器 + 文档 + 营销)

---

## 一、品牌身份

```
品牌名: TradingEasy
标语: 让交易更简单
英文标语: Trade Smarter, Not Harder
简称: TE
吉祥物: 🦐 (虾)
```

### 1.1 品牌故事

TradingEasy 不是一个冷冰冰的交易终端。它是一个**AI驱动的因子量化平台**，让专业量化分析像聊天一样简单。

**三句话解释 TradingEasy:**
1. 像选菜一样选因子 → 拖放到画布 → AI自动构建策略
2. 44个专业因子 + 实时IC追踪 + 一键回测 → 零代码量化
3. 创作者市场分享策略 → 躺着赚钱 (L1:70% L2:80% L3:90%)

---

## 二、命名规范

### 2.1 正确写法

| 场景 | 写法 | 示例 |
|------|------|------|
| 品牌全名 | TradingEasy | TradingEasy 是一款AI量化平台 |
| 代码仓库 | tradingeasy | github.com/vx1073071/tradingeasy |
| 域名 | tradingeasy.io | https://tradingeasy.io |
| 邮箱 | xxx@tradingeasy.io | support@tradingeasy.io |
| 包名 | tradingeasy | npm install tradingeasy |
| 文件路径 | tradineasy/ | C:\Users\...\tradineasy\ |
| 简称 | TE | TE v2.3.0 |

### 2.2 ❌ 禁止写法

```
❌ Dawn Whales / DawnWhales / dawnwhales / dawn-whales
❌ DW
❌ dawnwhales.com
❌ anything with "whale"
```

### 2.3 大小写规则

```
代码中 (PascalCase): TradingEasy
URL/路径 (小写): tradingeasy
文档正文 (首字母大写): TradingEasy
CSS类名 (BEM): .te-xxx
环境变量: TRADINGEASY_xxx
```

---

## 三、视觉标识

### 3.1 主色调

```
主色 (金色): #D4A574 (品牌色, 虾的暖金色)
辅助色1: #1A1A2E (深蓝黑, 背景)
辅助色2: #16213E (中蓝, 面板背景)
辅助色3: #0F3460 (亮蓝, 强调)
文字色: #E0E0E0 (浅灰白, 主要文字)
次要文字: #A0A0B0 (灰, 次要信息)
```

### 3.2 水印规范

```
文字水印: "TradingEasy" + 🦐
位置: 右下角或居中平铺
透明度: 25-40%
倾斜: 0° (水平平铺) 或 45° (对角平铺)
尺寸: 不小于图片尺寸的 15%
```

### 3.3 吉祥物

```
🦐 = TradingEasy 品牌吉祥物
含义: 虾 — 灵活、快速、精准、群居协作

使用场景:
  - 分享卡片 / 导出PNG (右下角)
  - 404页面 / 加载页面
  - 品牌物料
  - 社交媒体头像 / favicon
```

---

## 四、产品架构命名

### 4.1 三大产品线

| 产品 | 名称 | 定位 |
|------|------|------|
| 桌面端 | TradingEasy Desktop | Electron全功能交易终端 |
| 落地页 | TradingEasy Web | 品牌展示+下载入口 |
| 服务器 | TradingEasy Server | API/钱包/计费/创作者市场 |

### 4.2 核心功能命名

```
因子系统: FactorLab
AI助手: AI Advisor
策略市场: Strategy Market
创作者看板: Creator Dashboard
因子对比: Factor Compare
信号订阅: Signal Feed
跟单交易: CopyTrade
```

---

## 五、URL & 联系方式

### 5.1 域名

```
主站: https://tradingeasy.io
文档: https://docs.tradingeasy.io
API: https://api.tradingeasy.io
GitHub: https://github.com/vx1073071/tradingeasy
```

### 5.2 邮箱

```
技术支持: support@tradingeasy.io
隐私合规: privacy@tradingeasy.io
商务合作: business@tradingeasy.io
安全报告: security@tradingeasy.io
```

---

## 六、内容语调

### 6.1 品牌声音

```
专业但不冷漠: 用量化术语但加上人话翻译
友好但不轻浮: 用🦐增加亲和力，但保持交易工具的专业感
实用但不功利: 免费功能大方给，付费是锦上添花
透明但不暴露: 公开因子方法论，但不暴露策略细节
```

### 6.2 用户称呼

```
用户: "你" (不称"您"，保持友好)
创作者: "创作者" 或直接 @昵称
AI: "AI Advisor" 或 "🦐 AI"
品牌自称: "TradingEasy" 或 "TE"
```

### 6.3 营销短语库

```
"让交易更简单"
"选因子像选菜一样简单"
"零代码量化，拖放即策略"
"你的因子，你的策略，你的收益"
"Trade Smarter, Not Harder"
```

---

## 七、品牌使用禁止事项

```
❌ 不要在正式产品中自称 "Dawn Whales"
❌ 不要用鲸鱼🐋相关的视觉元素
❌ 不要引用 dawnwhales.com 任何URL
❌ 不要在水印中写 "Dawn Whales" 或 "DW"
❌ 不要在代码注释中保留 "Dawn Whales" (除非是历史changelog)
❌ 不要用 DW 作为缩写
```

---

## 八、迁移检查清单

### 8.1 代码层
- [ ] package.json: name/description
- [ ] Electron窗口title
- [ ] HTML title / meta标签
- [ ] 所有CSS/组件中的品牌文字
- [ ] 环境变量前缀
- [ ] 数据库/表名
- [ ] 8语言i18n文件

### 8.2 文档层
- [ ] docs/ 258个文件已全部改名 ✅ (R179完成)
- [ ] 品牌指南 (本文件)

### 8.3 外部层
- [ ] GitHub仓库名
- [ ] 域名注册
- [ ] 社交媒体账号
- [ ] 邮箱设置
- [ ] SSL证书

### 8.4 确认验证
- [ ] grep全项目零 "Dawn Whales" 残留
- [ ] grep全项目零 "dawnwhales" 残留
- [ ] grep全项目零 "dawn-whales" (除路径外)
- [ ] TSC=0, Build=0

---

*品牌指南 v1.0: 2026-06-15 | QClaw(设计虾) | TradingEasy R179*
