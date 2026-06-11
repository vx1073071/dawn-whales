<!-- META
version: 1.12.0
last_updated: 2026-06-12
round: R108
owner: team
purpose: (auto-generated, needs review)
-->

# JVS 技能大脑 — 东方财富 & 市场数据全集

> 这是主龙虾的技能知识库快照。读完此文件，你（JVS）就拥有全部EM数据能力。
> 最后更新：2026-06-04

---

## 你的12个核心技能

### 1. em-mx-finance-data（金融数据查询）

**用途**: A股/港股/美股行情、财务数据、量化数据、盘口数据
**脚本**: `python3 {baseDir}/scripts/get_data.py --query "贵州茅台近期走势"`
**输出**: xlsx数据表 + description.txt
**限制**: 单次最多5个实体（超过自动截取前5个）
**无需API Key** — 平台代理层统一处理认证

**调用示例**:
```bash
# 实时行情
python3 scripts/get_data.py --query "英伟达最新价和涨跌幅"

# 财务报表
python3 scripts/get_data.py --query "贵州茅台最近一年营业收入和净利润"

# 多实体对比
python3 scripts/get_data.py --query "创业板指、沪深300、中证500春节以来涨幅"

# 基本面
python3 scripts/get_data.py --query "东方财富的基本面"
```

**Python API**:
```python
import asyncio
from scripts.get_data import query_mx_finance_data

result = await query_mx_finance_data(
    query="半导体ETF业绩表现",
    output_dir=Path("miaoxiang/mx_finance_data"),
)
# result = { "xlsx_path": "...", "description_path": "...", "row_count": 42 }
```

**依赖**: `pip3 install httpx pandas openpyxl --user`

---

### 2. em-mx-finance-search（金融资讯搜索）

**用途**: 公告、研报、财经新闻、交易所动态、政策
**脚本**: `python3 {baseDir}/scripts/get_data.py "寒武纪688256最新研报与公告"`
**输出**: txt资讯正文
**无需API Key**

**调用示例**:
```bash
# 个股资讯
python3 scripts/get_data.py "格力电器最新研报与公告"

# 板块新闻
python3 scripts/get_data.py "商业航天板块近期新闻"

# 宏观解读
python3 scripts/get_data.py "北向资金流向解读"

# 仅输出不落盘
python3 scripts/get_data.py "商业航天板块近期新闻" --no-save
```

**Python API**:
```python
result = await query_financial_news(
    query="新能源板块近期政策与龙头公司动态",
    output_dir=Path("workspace/mx_finance_search"),
    save_to_file=True,
)
# result = { "content": "...", "output_path": "...", "raw": {...} }
```

---

### 3. em-mx-macro-data（宏观经济数据）

**用途**: GDP、CPI、PMI、失业率、M2、社融、利率、汇率、商品价格
**脚本**: `python3 {baseDir}/scripts/get_data.py --query "中国GDP"`
**输出**: 多个CSV文件（按频率: yearly/quarterly/monthly） + description.txt
**无需API Key**

**⚠️ 输入约束**:
- ❌ 禁止模糊商品类别（"稀土"） → ✅ 必须具体（"氧化镨钕"）
- ❌ 禁止宏观泛指（"中国经济"） → ✅ 必须具体指标（"中国GDP同比增速"）
- ✅ 时间可灵活（"今年"、"过去三年"、"上月"）
- ✅ 地域可灵活（"中国各省"、"华东地区"）

**调用示例**:
```bash
python3 scripts/get_data.py --query "中国GDP"
python3 scripts/get_data.py --query "中国近五年GDP同比增速"
python3 scripts/get_data.py --query "美国制造业PMI"
python3 scripts/get_data.py --query "中国、印度、巴西的M2货币供应量"
python3 scripts/get_data.py --query "氧化镨钕、铜、铝的现货价格走势"
python3 scripts/get_data.py --query "华东地区GDP"
```

**Python API**:
```python
result = await query_mx_macro_data(
    query="中国近五年GDP",
    output_dir=Path("workspace/mx_macro_data"),
)
# result = { "csv_paths": [...], "description_path": "...", "row_counts": {...} }
```

**环境变量**: `MX_MACRO_DATA_OUTPUT_DIR`（可选，默认 `workspace/mx_macro_data`）

**上层规划引擎必须做完整性复核**:
- 读CSV → 检查缺失项 → 补全查询 → 迭代至完整（最多5次）

---

### 4. em-mx-stocks-screener（股票/基金/板块筛选）

**用途**: 按条件筛选A股/港股/美股/基金/ETF/可转债/板块
**脚本**: `python3 {baseDir}/scripts/get_data.py --query "..." --select-type A股`
**输出**: CSV + description.txt
**无需API Key**

**调用示例**:
```bash
# A股
python3 scripts/get_data.py --query "股价大于500元的股票" --select-type A股
python3 scripts/get_data.py --query "创业板市盈率最低的50只" --select-type A股
python3 scripts/get_data.py --query "股价大于100元，主力流入，成交额排名前50" --select-type A股

# 港股
python3 scripts/get_data.py --query "港股的科技龙头" --select-type 港股

# 美股
python3 scripts/get_data.py --query "纳斯达克市值前30" --select-type 美股

# 板块
python3 scripts/get_data.py --query "今天涨幅最大板块" --select-type 板块

# 基金
python3 scripts/get_data.py --query "白酒主题基金近一年收益排名" --select-type 基金

# ETF
python3 scripts/get_data.py --query "规模超2亿的电力ETF" --select-type ETF

# 可转债
python3 scripts/get_data.py --query "价格低于110元溢价率超5个点的可转债" --select-type 可转债
```

**Python API**:
```python
result = await query_mx_stocks_screener(
    query="A股半导体板块市值前20",
    selectType="A股",
    output_dir=Path("miaoxiang/mx_stocks_screener"),
)
```

**A股进阶**: 高管信息、龙虎榜、分红、并购、增发、回购、主营区域、券商金股

---

### 5. em-fund-diagnosis（基金诊断）

**用途**: 单只基金综合分析（收益+风险+持仓结构）
**脚本**: `python3 {baseDir}/scripts/get_data.py --query "华夏成长混合基金"`
**输出**: Markdown诊断报告
**触发**: 用户问"这只基金怎么样""适不适合持有"
**不触发**: 用户要求回测/建模/多基金对比

```bash
python3 scripts/get_data.py --query "华夏成长混合基金"
python3 scripts/get_data.py --query "这只基金适合长期持有吗" --no-save
```

---

### 6. em-stock-diagnosis（个股诊断）

**用途**: 单只股票深度诊断
**脚本**: `python3 {baseDir}/scripts/get_data.py --query "海康威视怎么样"`
**输出**: Markdown诊断报告
**触发**: 用户问单只股票深度分析

---

### 7. em-stock-market-hotspot-discovery（市场热点发现）

**用途**: 今日热点、热门股票、活跃方向
**脚本**: `python3 {baseDir}/scripts/get_data.py --query "今日热点"`
**输出**: Markdown热点报告
**触发**: "今日热点是什么""热股有哪些"

```bash
python3 scripts/get_data.py --query "今日热点"
python3 scripts/get_data.py --query "今天最热的股票有哪些"
```

---

### 8. mx-data（东方财富金融数据 · 项目级）

与 em-mx-finance-data 功能相同，项目级安装版本。
**脚本路径**: `C:\Users\vx107\.easyclaw\workspace\skills\mx-data\scripts\get_data.py`

---

### 9. mx-search（东方财富资讯搜索 · 项目级）

与 em-mx-finance-search 功能相同。
**脚本路径**: `C:\Users\vx107\.easyclaw\workspace\skills\mx-search\scripts\get_data.py`

---

### 10. mx-select-stock（选股 · 项目级）

与 em-mx-stocks-screener 功能相同。
**脚本路径**: `C:\Users\vx107\.easyclaw\workspace\skills\mx-select-stock\scripts\get_data.py`

---

### 11. mx-selfselect（自选股管理 · 全局级）

**路径**: `C:\Users\vx107\.easyclaw\skills\mx-selfselect\SKILL.md`
**用途**: 管理用户自选股列表

---

### 12. mx-stock-simulator（股票模拟交易 · 项目级）

**脚本路径**: `C:\Users\vx107\.easyclaw\workspace\skills\mx-stock-simulator\SKILL.md`
**用途**: 模拟交易、回测验证

---

## 辅助技能

### futuapi（富途OpenD API）
**路径**: `C:\Users\vx107\.easyclaw\workspace\skills\futuapi\SKILL.md`
**用途**: 富途行情/交易/账户管理
**OpenD端口**: 11111（运行中）

### moomooapi（moomoo OpenD API）
**路径**: `C:\Users\vx107\.easyclaw\workspace\skills\moomooapi\SKILL.md`
**用途**: moomoo行情/交易

### tushare-finance（Tushare金融数据）
**路径**: `C:\Users\vx107\.easyclaw\workspace\skills\tushare-finance\SKILL.md`
**用途**: A股数据备用源

### yahooquery（Yahoo Finance）
**路径**: `C:\Users\vx107\.easyclaw\workspace\skills\yahooquery\SKILL.md`
**用途**: 美股数据备用源

### option-greeks（期权希腊字母）
**路径**: `C:\Users\vx107\.easyclaw\workspace\skills\option-greeks\SKILL.md`
**用途**: Delta/Gamma/Theta/Vega/Rho计算（已内置纯JS版本）

---

## 在DAWN WHALES中集成EM数据

### IPC Handler命名规范

```typescript
// electron/main.ts 中追加:
ipcMain.handle('em:get-heatmap', async (_e, params) => { ... });
ipcMain.handle('em:get-macro', async (_e, params) => { ... });
ipcMain.handle('em:get-sentiment', async (_e, params) => { ... });
ipcMain.handle('screener:search', async (_e, params) => { ... });
ipcMain.handle('em:get-hotspot', async (_e, params) => { ... });
ipcMain.handle('em:diagnose-stock', async (_e, params) => { ... });
ipcMain.handle('em:diagnose-fund', async (_e, params) => { ... });
```

### 调用EM脚本的标准模式

```typescript
import { execAsync } from '../utils/exec-async';

async function callEMScript(query: string, scriptPath: string): Promise<any> {
  const pythonExe = 'python3'; // 或完整路径
  const cmd = `"${pythonExe}" "${scriptPath}" --query "${query}"`;
  const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: 30000 });
  // 解析输出文件路径，读取xlsx/csv
  return parseResult(stdout);
}
```

### 脚本路径

```typescript
// 全局级
const EM_SKILLS = 'C:\\Users\\vx107\\.easyclaw\\workspace\\skills';
const EM_FINANCE_DATA = path.join(EM_SKILLS, 'em-mx-finance-data', 'scripts', 'get_data.py');
const EM_FINANCE_SEARCH = path.join(EM_SKILLS, 'em-mx-finance-search', 'scripts', 'get_data.py');
const EM_MACRO_DATA = path.join(EM_SKILLS, 'em-mx-macro-data', 'scripts', 'get_data.py');
const EM_STOCKS_SCREENER = path.join(EM_SKILLS, 'em-mx-stocks-screener', 'scripts', 'get_data.py');

// 项目级
const MX_SKILLS = 'C:\\Users\\vx107\\.easyclaw\\workspace\\skills';
const MX_DATA = path.join(MX_SKILLS, 'mx-data', 'scripts', 'get_data.py');
const MX_SEARCH = path.join(MX_SKILLS, 'mx-search', 'scripts', 'get_data.py');
```

---

## 关键提醒

1. **所有EM脚本无需API Key** — 平台代理层统一处理
2. **输出编码必须是UTF-8无BOM** — 之前BOM导致Vite构建失败
3. **单次查询最多5个实体** — finance-data的限制
4. **宏观数据禁止模糊查询** — 必须指定具体指标名称
5. **选股筛选器CSV列名是中文** — 需要在IPC层做映射
6. **测试必须保持38/38全绿** — 每次改动后运行 `npx tsx tests/engine.test.ts`

---

## 你的任务清单（优先级排序）

### 🔴 JVS-1: 市场热力图数据管道（立即开始）
- 文件: `electron/data/em-data-provider.ts`
- 调用: `em-mx-finance-data` 的板块数据
- 输出: `SectorData[]` → 兼容 `MarketHeatmap.tsx`
- IPC: `em:get-heatmap`

### 🟡 JVS-2: 宏观数据仪表盘
- 文件: `electron/data/macro-provider.ts`
- 调用: `em-mx-macro-data` 的GDP/CPI/PMI
- 输出: `MacroPoint[]` → 时间序列
- IPC: `em:get-macro`

### 🟡 JVS-3: 市场情绪指数
- 文件: `electron/engine/sentiment-index.ts`
- 调用: `em-mx-finance-data` (资金流向+融资余额+北向资金)
- 输出: 0-100 单一分数
- IPC: `em:get-sentiment`

### 🟢 JVS-4: 股票筛选器后端
- 文件: `electron/engine/stock-screener.ts`
- 调用: `em-mx-stocks-screener`
- IPC: `screener:search`

### 📋 后续自动分配
- JVS-5: 新闻舆情聚合（em-mx-finance-search）
- JVS-6: 板块轮动监控（em-mx-finance-data 资金流向）
- JVS-7: 个股异动检测（em-stock-diagnosis）
- JVS-8: 市场热点发现（em-stock-market-hotspot-discovery）
