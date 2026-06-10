"""P1-5d: Batch i18n replacement — replace top hardcoded CN strings with {t('key')}"""
import re, json, glob, os

I18N_MAP = {
    "加载中...": "loading",
    "暂无数据": "noData", 
    "刷新": "refresh",
    "← 返回": "back",
    "关闭": "close",
    "取消": "cancel",
    "确认": "confirm",
    "保存": "save",
    "删除": "delete",
    "编辑": "edit",
    "搜索": "search",
    "导出": "export",
    "导入": "import",
    "复制": "copy",
    "分享": "share",
    "设置": "settings",
    "帮助": "help",
    "关于": "about",
    "下载": "download",
    "上传": "upload",
    "发送": "send",
    "提交": "submit",
    "重置": "reset",
    "筛选": "filter",
    "排序": "sort",
    "升序": "asc",
    "降序": "desc",
    "启用": "enable",
    "禁用": "disable",
    "已启用": "enabled",
    "已禁用": "disabled",
    "成功": "success",
    "失败": "failed",
    "错误": "error",
    "警告": "warning",
    "重试": "retry",
    "连接": "connect",
    "断开": "disconnect",
    "已连接": "connected",
    "未连接": "disconnected",
    "连接中": "connecting",
    "在线": "online",
    "离线": "offline",
    "模拟": "simulation",
    "实盘": "live",
    "演示": "demo",
    "测试": "test",
    "全部": "all",
    "买入": "buy",
    "卖出": "sell",
    "做多": "long",
    "做空": "short",
    "开仓": "openPosition",
    "平仓": "closePosition",
    "持仓": "positions",
    "订单": "orders",
    "成交": "filled",
    "已成交": "tradeFilled",
    "已取消": "tradeCancelled",
    "已拒绝": "tradeRejected",
    "待处理": "pending",
    "部分成交": "partialFill",
    "市价": "marketPrice",
    "限价": "limitPrice",
    "止损": "stopLoss",
    "止盈": "takeProfit",
    "策略": "strategy",
    "回测": "backtest",
    "因子": "factor",
    "信号": "signal",
    "收益": "returnRate",
    "风险": "risk",
    "波动率": "volatility",
    "最大回撤": "maxDrawdown",
    "夏普": "sharpeRatio",
    "年化": "annualized",
    "胜率": "winRate",
    "盈亏比": "profitLossRatio",
    "总收益": "totalReturn",
    "日收益": "dailyReturn",
    "周收益": "weeklyReturn",
    "月收益": "monthlyReturn",
    "年收益": "yearlyReturn",
    "持仓市值": "positionValue",
    "总资产": "totalAssets",
    "可用资金": "availableFunds",
    "冻结资金": "frozenFunds",
    "购买力": "buyingPower",
    "杠杆": "leverage",
    "保证金": "margin",
    "行情": "market",
    "市场": "markets",
    "自选": "watchlist",
    "大盘": "index",
    "板块": "sector",
    "行业": "industry",
    "概念": "concept",
    "涨幅": "priceUp",
    "跌幅": "priceDown",
    "涨跌幅": "priceChange",
    "成交量": "volume",
    "成交额": "turnover",
    "换手率": "turnoverRate",
    "振幅": "amplitude",
    "开盘": "openPrice",
    "收盘": "closePrice",
    "最高": "highPrice",
    "最低": "lowPrice",
    "净资产": "netAsset",
    "负债": "liability",
    "净利润": "netProfit",
    "营收": "revenue",
    "毛利率": "grossMargin",
    "净利率": "netMargin",
    "ROE": "roe",
    "PE": "peRatio",
    "PB": "pbRatio",
    "股息率": "dividendYield",
    "市值": "marketCap",
    "流通市值": "floatCap",
    "时间": "time",
    "日期": "date",
    "代码": "code",
    "名称": "name",
    "价格": "price",
    "数量": "quantity",
    "方向": "direction",
    "状态": "status",
    "操作": "actions",
    "类型": "type",
    "结果": "result",
    "备注": "remarks",
    "详情": "details",
    "更多": "more",
    "查看": "view",
    "切换": "switch",
    "描述": "description",
    "上次": "last",
    "下次": "next",
    "前值": "prevValue",
    "今值": "currentValue",
    "预测": "forecast",
    "实际": "actual",
    "差异": "diff",
    "深色模式": "darkMode",
    "浅色模式": "lightMode",
    "系统": "system",
    "主题": "theme",
    "语言": "language",
    "账户": "account",
    "钱包": "wallet",
    "支付": "payment",
    "充值": "deposit",
    "提现": "withdraw",
    "转账": "transfer",
    "费率": "feeRate",
    "佣金": "commission",
    "手续费": "fee",
    "印花税": "stampDuty",
    "创建": "create",
    "新建": "new",
    "注册": "register",
    "登录": "login",
    "登出": "logout",
    "密码": "password",
    "验证": "verify",
    "许可证": "license",
    "版本": "version",
    "更新": "update",
    "升级": "upgrade",
    "降级": "downgrade",
    "安装": "install",
    "卸载": "uninstall",
    "重启": "restart",
    "显示": "show",
    "隐藏": "hide",
    "打开": "open",
    "展开": "expand",
    "折叠": "collapse",
    "通知": "notification",
    "消息": "message",
    "警告中心": "alertCenter",
    "最大": "max",
    "最小": "min",
    "平均": "average",
    "总计": "total",
    "合计": "sum",
    "今日": "today",
    "本周": "thisWeek",
    "本月": "thisMonth",
    "本年": "thisYear",
    "历史": "history",
    "最近": "recent",
    "热门": "popular",
    "推荐": "recommend",
    "新增": "newlyAdded",
    "减少": "decreased",
    "增加": "increased",
    "不变": "unchanged",
    "增持": "increaseHolding",
    "减持": "decreaseHolding",
    "中性": "neutral",
    "看涨": "bullish",
    "看跌": "bearish",
    "趋势": "trend",
    "震荡": "consolidation",
    "突破": "breakout",
    "反弹": "rebound",
    "回调": "pullback",
    "追涨": "chase",
    "策略社区": "strategyCommunity",
    "策略市场": "strategyMarketplace",
    "新手引导": "onboarding",
    "每日简报": "dailyDigest",
}

def apply_replacements(filepath, dry_run=False):
    with open(filepath, 'r', encoding='utf-8') as fh:
        content = fh.read()
    
    original = content
    replacements = 0
    
    for cn_text, key in sorted(I18N_MAP.items(), key=lambda x: -len(x[0])):
        # Only replace standalone occurrences (not inside already translated text)
        # Replace in JSX text: >中文< → >{t('key')}<
        pattern1 = re.compile(r'>(' + re.escape(cn_text) + r')<')
        new_content = pattern1.sub(r'>{t("components.' + key + r'")}<', content)
        # Don't double-replace
        if new_content != content:
            # Verify it's not inside t() already
            safe = True
            for m in pattern1.finditer(content):
                pos = m.start()
                before = content[max(0, pos-30):pos]
                if 't(' in before[-10:] or '{t(' in before[-15:]:
                    safe = False
                    break
            if safe:
                content = new_content
                replacements += 1
        
        # Replace in string literals: '中文' → t('components.key')
        pattern2 = re.compile(r"(?<!t\()'(" + re.escape(cn_text) + r")'")
        if pattern2.search(content):
            content = pattern2.sub(r"t('components." + key + r"')", content)
            replacements += 1
        
        # JSX attribute: title="中文" → title={t('key')}
        pattern3 = re.compile(r'(title|placeholder|aria-label)="(' + re.escape(cn_text) + r')"')
        if pattern3.search(content):
            content = pattern3.sub(r'\1={t("components.' + key + r'")}', content)
            replacements += 1
    
    if content != original and not dry_run:
        with open(filepath, 'w', encoding='utf-8') as fh:
            fh.write(content)
    
    return content != original, replacements

# Process all component files
files = glob.glob('src/components/**/*.tsx', recursive=True)
total_replaced = 0
files_changed = 0

for f in sorted(files):
    changed, reps = apply_replacements(f)
    if changed:
        files_changed += 1
        total_replaced += reps
        print(f"  ✅ {f}: {reps} replacements")

print(f"\n=== Summary ===")
print(f"Files changed: {files_changed}")
print(f"Total replacements: {total_replaced}")

# Update zh-CN.json with new keys
zh_cn_path = 'src/i18n/locales/zh-CN.json'
with open(zh_cn_path, 'r', encoding='utf-8') as fh:
    zh_cn = json.load(fh)

if 'components' not in zh_cn:
    zh_cn['components'] = {}

for cn_text, key in sorted(I18N_MAP.items()):
    if key not in zh_cn['components']:
        zh_cn['components'][key] = cn_text

with open(zh_cn_path, 'w', encoding='utf-8') as fh:
    json.dump(zh_cn, fh, ensure_ascii=False, indent=2)

print(f"zh-CN.json components keys: {len(zh_cn.get('components', {}))}")
