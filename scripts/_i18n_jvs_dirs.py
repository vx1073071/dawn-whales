import re, glob, json

I18N_MAP = {
    "加载中...": "loading", "暂无数据": "noData", "刷新": "refresh", "← 返回": "back",
    "关闭": "close", "取消": "cancel", "确认": "confirm", "保存": "save", "删除": "delete",
    "编辑": "edit", "搜索": "search", "导出": "export", "导入": "import", "复制": "copy",
    "设置": "settings", "帮助": "help", "下载": "download", "全部": "all", "买入": "buy",
    "卖出": "sell", "做多": "long", "做空": "short", "持仓": "positions", "订单": "orders",
    "已成交": "tradeFilled", "待处理": "pending", "市价": "marketPrice", "限价": "limitPrice",
    "止损": "stopLoss", "止盈": "takeProfit", "策略": "strategy", "回测": "backtest",
    "因子": "factor", "信号": "signal", "收益": "returnRate", "风险": "risk",
    "波动率": "volatility", "最大回撤": "maxDrawdown", "夏普": "sharpeRatio",
    "胜率": "winRate", "总收益": "totalReturn", "持仓市值": "positionValue",
    "总资产": "totalAssets", "可用资金": "availableFunds", "购买力": "buyingPower",
    "行情": "marketQuotes", "市场": "markets", "板块": "sector", "行业": "industry",
    "涨跌幅": "priceChange", "成交量": "volume", "成交额": "turnover",
    "换手率": "turnoverRate", "开盘": "openPrice", "收盘": "closePrice",
    "最高": "highPrice", "最低": "lowPrice", "市值": "marketCap",
    "时间": "time", "日期": "date", "代码": "code", "名称": "name",
    "价格": "price", "数量": "quantity", "方向": "direction", "状态": "status",
    "操作": "actions", "类型": "type", "备注": "remarks", "详情": "details",
    "更多": "more", "查看": "view", "切换": "switch", "深色模式": "darkMode",
    "浅色模式": "lightMode", "系统": "system", "语言": "language", "账户": "account",
    "钱包": "wallet", "充值": "deposit", "提现": "withdraw", "费率": "feeRate",
    "创建": "create", "新建": "new", "登录": "login", "通知": "notification",
    "总计": "total", "今日": "today", "本周": "thisWeek", "本月": "thisMonth",
    "历史": "history", "最近": "recent", "推荐": "recommend", "中性": "neutral",
    "看涨": "bullish", "看跌": "bearish", "趋势": "trend", "震荡": "consolidation",
    "突破": "breakout", "策略社区": "strategyCommunity", "策略市场": "strategyMarketplace",
    "新手引导": "onboarding", "每日简报": "dailyDigest", "成功": "success",
    "失败": "failed", "错误": "error", "警告": "warning", "重试": "retry",
    "连接": "connect", "断开": "disconnect", "已连接": "connected",
    "未连接": "disconnected", "连接中": "connecting", "在线": "online",
    "模拟": "simulation", "实盘": "live", "测试": "test", "筛选": "filter",
    "排序": "sort", "重置": "reset", "提交": "submit", "分享": "share",
}

# JVS's directories (ML takes over)
dirs = [
    'src/components/trading',
    'src/components/ai', 
    'src/components/backtest',
    'src/components/tools',
    'src/components/release',
    'src/components/pm',
]

total_files = 0
total_reps = 0

for d in dirs:
    for f in glob.glob(f'{d}/**/*.tsx', recursive=True):
        with open(f, 'r', encoding='utf-8', errors='ignore') as fh:
            content = fh.read()
        
        original = content
        reps = 0
        
        # Replace JSX text: >中文<
        for cn_text, key in sorted(I18N_MAP.items(), key=lambda x: -len(x[0])):
            pattern = re.compile(r'>(' + re.escape(cn_text) + r')<')
            new_content = pattern.sub(r'>{t("components.' + key + r'")}<', content)
            if new_content != content:
                # Verify not inside t() already
                safe = True
                for m in pattern.finditer(content):
                    pos = m.start()
                    before = content[max(0, pos-20):pos]
                    if 't(' in before[-6:] or '{t(' in before[-10:]:
                        safe = False
                if safe:
                    content = new_content
                    reps += 1
        
        if reps > 0:
            # Add useTranslation
            if 'useTranslation' not in content:
                content = re.sub(
                    r"(import\s+.*from\s+['\"]react['\"]\s*;)",
                    r"\1\nimport { useTranslation } from 'react-i18next';",
                    content
                )
                if 'useTranslation' not in content:
                    content = "import { useTranslation } from 'react-i18next';\n" + content
            
            if re.search(r'export\s+default\s+function', content) and 'const { t } = useTranslation()' not in content:
                content = re.sub(
                    r'(export\s+default\s+function\s+\w+\([^)]*\)\s*\{)',
                    r'\1\n  const { t } = useTranslation();',
                    content
                )
            
            with open(f, 'w', encoding='utf-8') as fh:
                fh.write(content)
            total_files += 1
            total_reps += reps
            print(f'  {f}: {reps} reps')

print(f'\nTotal: {total_files} files, {total_reps} replacements')
