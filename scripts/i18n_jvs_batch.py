"""JVS P1-5d: Batch i18n for trading/ai/backtest/tools/release/pm"""
import re, os, glob, json

# ── Load existing I18N_MAP from the original script ──────────────────────
I18N_MAP_ORIG = {}
exec(open('scripts/i18n_replace.py','r',encoding='utf-8').read().split('def apply_replacements')[0].replace('I18N_MAP = {','I18N_MAP_ORIG = {'))

# ── Extended map for mock data patterns ──────────────────────────────────
MOCK_MAP = {
    # Mock stock names
    '苹果': 'mockStockApple',
    '英伟达': 'mockStockNvidia',
    '特斯拉': 'mockStockTesla',
    '微软': 'mockStockMicrosoft',
    '博通': 'mockStockBroadcom',
    '谷歌': 'mockStockGoogle',
    '亚马逊': 'mockStockAmazon',
    'Meta': 'mockStockMeta',
    '台积电': 'mockStockTsmc',
    '腾讯': 'mockStockTencent',
    '阿里': 'mockStockAlibaba',
    '美团': 'mockStockMeituan',
    '比亚迪': 'mockStockByd',
    # Strategy names
    '双均线突破': 'strategyDualMA',
    '动量轮动': 'strategyMomentumRotate',
    '价值投资': 'strategyValueInvest',
    '网格交易': 'strategyGrid',
    '趋势跟踪': 'strategyTrendFollow',
    '均值回归': 'strategyMeanRev',
    '海龟交易': 'strategyTurtle',
    '突破策略': 'strategyBreakout',
    '震荡策略': 'strategyOscillation',
    # Remarks / signals
    '金叉信号': 'signalGoldenCross',
    '死叉信号': 'signalDeadCross',
    '止损触发': 'signalStopLoss',
    '突破前高': 'signalBreakHigh',
    '动量衰减': 'signalMomDecay',
    '动量转弱': 'signalMomWeaken',
    '目标价到达': 'signalTargetReached',
    '低于均值': 'signalBelowAvg',
    '芯片需求': 'signalChipDemand',
    # UI components
    '条件规则': 'conditionRule',
    '新建规则': 'newRule',
    '规则名称': 'ruleName',
    '规则列表': 'ruleList',
    '触发条件': 'triggerCondition',
    '执行动作': 'execAction',
    '添加条件': 'addCondition',
    '添加动作': 'addAction',
    '条件组': 'conditionGroup',
    '策略信号': 'strategySignal',
    '信号强度': 'signalStrength',
    '信号预览': 'signalPreview',
    '信号历史': 'signalHistory',
    '仓位管理': 'positionMgmt',
    '仓位分析': 'positionAnalysis',
    '资金管理': 'fundMgmt',
    '风险评分': 'riskScore',
    '评级': 'rating',
    # Trading UI
    '交易面板': 'tradePanel',
    '快速交易': 'quickTrade',
    '订单管理': 'orderMgmt',
    '委托管理': 'entrustMgmt',
    '成交查询': 'execQuery',
    '持仓查询': 'positionQuery',
    '资金查询': 'fundQuery',
    '今日盈亏': 'todayPnl',
    '本月盈亏': 'monthPnl',
    '累计盈亏': 'totalPnl',
    # Backtest
    '回测报告': 'backtestReport',
    '回测对比': 'backtestCompare',
    '回测参数': 'backtestParams',
    '回测结果': 'backtestResult',
    '回测曲线': 'backtestCurve',
    '蒙特卡洛': 'monteCarlo',
    '参数扫描': 'paramScan',
    '参数优化': 'paramOptimize',
    '滚动优化': 'walkForward',
    '最大回撤': 'maxDD',
    '夏普比率': 'sharpe',
    '年化收益': 'annualR',
    '胜率': 'winRate',
    '盈亏比': 'plr',
    '总交易': 'totalTrades',
    '盈利交易': 'winTrades',
    '亏损交易': 'lossTrades',
    '平均盈利': 'avgWin',
    '平均亏损': 'avgLoss',
    '收益曲线': 'returnCurve',
    '回撤曲线': 'ddCurve',
    '月度收益': 'monthlyRet',
    '热力图': 'heatmap',
    '交易时间线': 'tradeTimeline',
    # Tools
    '数据导出': 'dataExport',
    '数据质量': 'dataQuality',
    '导出格式': 'exportFormat',
    '导出范围': 'exportRange',
    '数据源': 'dataSource',
    '数据校验': 'dataValidate',
    '完整性': 'completeness',
    '准确性': 'accuracy',
    '及时性': 'timeliness',
    '一致性': 'consistency',
    '质量报告': 'qualityReport',
    '问题数据': 'problemData',
    '修复建议': 'fixSuggestion',
    # AI
    'AI助手': 'aiAssistant',
    '智能分析': 'smartAnalysis',
    '自然语言': 'naturalLanguage',
    '问题输入': 'questionInput',
    '分析结果': 'analysisResult',
    '建议': 'suggestion',
    '策略建议': 'strategySuggestion',
    '风险提示': 'riskWarning',
    '市场解读': 'marketInterpretation',
    '深度分析': 'deepAnalysis',
    '生成报告': 'generateReport',
    'AI回答': 'aiAnswer',
    '追问': 'followUp',
    '清空对话': 'clearChat',
    '协作': 'collaboration',
    '代理协作': 'agentCollab',
    '代理名称': 'agentName',
    '代理状态': 'agentStatus',
    '任务分配': 'taskAssign',
    '协作面板': 'collabPanel',
    '进度跟踪': 'progressTracking',
    # LLM
    '模型配置': 'modelConfig',
    '基础模型': 'baseModel',
    'API地址': 'apiAddress',
    '系统提示': 'systemPrompt',
    '温度': 'temperature',
    '最大长度': 'maxLength',
    '测试连接': 'testConnection',
    '连接成功': 'connSuccess',
    '连接失败': 'connFailed',
    # Release
    '版本发布': 'release',
    '版本号': 'versionNumber',
    '发布日期': 'releaseDate',
    '更新日志': 'changelog',
    '新功能': 'newFeature',
    '改进': 'improvement',
    '修复': 'fix',
    '已知问题': 'knownIssue',
    '下载地址': 'downloadUrl',
    '安装说明': 'installGuide',
    '发布说明': 'releaseNote',
    '回滚': 'rollback',
    '灰度发布': 'canaryRelease',
    '全量发布': 'fullRelease',
    # PM
    '代理仪表盘': 'agentDashboard',
    '代理状态': 'agentStatus2',
    '任务队列': 'taskQueue',
    '活跃任务': 'activeTasks',
    '完成率': 'completionRate',
    '平均响应': 'avgResponse',
}

# Merge maps (original map takes priority for common keys)
FULL_MAP = {**MOCK_MAP, **I18N_MAP_ORIG}

def add_i18n_import(content):
    """Add useTranslation import only if file doesn't already have it"""
    if "import { useTranslation }" in content:
        return content
    if "import {t}" in content and "useTranslation" in content:
        return content
    if "const { t } = useTranslation()" in content:
        return content
    
    # Insert import after first existing import block
    lines = content.split('\n')
    last_import = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import ') or stripped.startswith('// ──') or stripped.startswith('/*'):
            last_import = i
    
    import_line = "import { useTranslation } from 'react-i18next';"
    if last_import >= 0:
        lines.insert(last_import + 1, import_line)
    else:
        lines.insert(0, import_line)
    
    content = '\n'.join(lines)
    return content

def add_t_hook(content):
    """Add const { t } = useTranslation() at the top of each component function"""
    if "const { t } = useTranslation()" in content:
        return content
    
    # Find export default function / export function
    patterns = [
        r'(export default function\s+\w+\s*\([^)]*\)\s*\{)',
        r'(export function\s+\w+\s*\([^)]*\)\s*\{)',
        r'(function\s+\w+\s*\([^)]*\)\s*\{)',
    ]
    
    for pat in patterns:
        match = re.search(pat, content)
        if match:
            pos = match.end()
            # Check it's not already added
            line_start = content.rfind('\n', 0, pos) + 1
            content = content[:pos] + '\n  const { t } = useTranslation();' + content[pos:]
            return content
    
    return content

def replace_in_file(filepath):
    """Replace hardcoded Chinese with t() calls"""
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    
    content = original
    replacements = 0
    
    # Sort by longest CN text first to avoid partial matches
    for cn_text, key in sorted(FULL_MAP.items(), key=lambda x: -len(x[0])):
        if cn_text not in content:
            continue
        
        # Pattern 1: JSX text children >中文<
        pat1 = re.compile(r'>(' + re.escape(cn_text) + r')<')
        new_cnt = len(pat1.findall(content))
        if new_cnt > 0:
            content = pat1.sub(r'>{t("components.' + key + r'")}<', content)
            replacements += new_cnt
        
        # Pattern 2: String literals in code '中文' or "中文"
        # But NOT inside t('...'), import statements, or comments
        pat2 = re.compile(
            r'(?<!t\(\s*)(?<!t\(\s)(?<!t\()'  # not already t()
            r'(?<!["\w])'  # not part of word
            r'(?P<q>[\'\"])' + re.escape(cn_text) + r'(?P=q)'  # quoted string
        )
        for m in pat2.finditer(content):
            # Skip if inside a comment line
            line_start = content.rfind('\n', 0, m.start()) + 1
            line = content[line_start:m.end()]
            if line.strip().startswith('//') or line.strip().startswith('*') or line.strip().startswith('/*'):
                continue
            content = content[:m.start()] + 't("components.' + key + '")' + content[m.end():]
            replacements += 1
            # Restart from beginning since positions shifted
            return replace_in_file_helper(filepath, original, FULL_MAP) if True else None
    
    if content != original:
        content = add_i18n_import(content)
        content = add_t_hook(content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  OK {filepath}: {replacements} replacements')
        return replacements
    return 0

def replace_in_file_helper(filepath, original, full_map):
    """Re-entrant version to avoid issues with string mutation + regex"""
    content = original
    reps = 0
    for cn_text, key in sorted(full_map.items(), key=lambda x: -len(x[0])):
        if cn_text not in content:
            continue
        pat1 = re.compile(r'>(' + re.escape(cn_text) + r')<')
        cnt1 = len(pat1.findall(content))
        if cnt1 > 0:
            content = pat1.sub(r'>{t("components.' + key + r'")}<', content)
            reps += cnt1
    if content != original:
        content = add_i18n_import(content)
        content = add_t_hook(content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  OK {filepath}: {reps} replacements')
    return reps

# ── Main ──────────────────────────────────────────────────────────────────
target_dirs = [
    'src/components/trading',
    'src/components/ai',
    'src/components/backtest',
    'src/components/tools',
    'src/components/release',
    'src/components/pm',
]

total_files = 0
total_reps = 0

for d in target_dirs:
    pattern = os.path.join(d, '**/*.tsx')
    files = sorted(glob.glob(pattern, recursive=True))
    for f in files:
        reps = replace_in_file(f)
        if reps:
            total_files += 1
            total_reps += reps

print(f'\n=== Summary ===')
print(f'Files changed: {total_files}')
print(f'Total replacements: {total_reps}')
