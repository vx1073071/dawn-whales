"""JVS P1-5d: Batch i18n for trading/ai/backtest/tools/release/pm"""
import re, os, glob, json

# ── Load existing I18N_MAP ───────────────────────────────────────────────
exec_globals = {}
exec(open('scripts/i18n_replace.py','r',encoding='utf-8').read().split('def apply_replacements')[0].replace('I18N_MAP = {','I18N_MAP_ORIG = {'), exec_globals)
I18N_MAP_ORIG = exec_globals.get('I18N_MAP_ORIG', {})

# ── Extended map ─────────────────────────────────────────────────────────
MOCK_MAP = {
    '苹果': 'mockStockApple','英伟达': 'mockStockNvidia','特斯拉': 'mockStockTesla',
    '微软': 'mockStockMicrosoft','博通': 'mockStockBroadcom','谷歌': 'mockStockGoogle',
    '亚马逊': 'mockStockAmazon','台积电': 'mockStockTsmc','腾讯': 'mockStockTencent',
    '阿里': 'mockStockAlibaba','美团': 'mockStockMeituan','比亚迪': 'mockStockByd',
    '双均线突破': 'strategyDualMA','动量轮动': 'strategyMomentumRotate',
    '价值投资': 'strategyValueInvest','网格交易': 'strategyGrid','趋势跟踪': 'strategyTrendFollow',
    '均值回归': 'strategyMeanRev','突破策略': 'strategyBreakout','震荡策略': 'strategyOscillation',
    '金叉信号': 'signalGoldenCross','死叉信号': 'signalDeadCross',
    '止损触发': 'signalStopLoss','突破前高': 'signalBreakHigh',
    '动量衰减': 'signalMomDecay','动量转弱': 'signalMomWeaken',
    '目标价到达': 'signalTargetReached','低于均值': 'signalBelowAvg','芯片需求': 'signalChipDemand',
    '条件规则': 'conditionRule','新建规则': 'newRule','规则名称': 'ruleName',
    '触发条件': 'triggerCondition','执行动作': 'execAction','添加条件': 'addCondition',
    '策略信号': 'strategySignal','信号预览': 'signalPreview','信号强度': 'signalStrength',
    '仓位管理': 'positionMgmt','仓位分析': 'positionAnalysis','资金管理': 'fundMgmt',
    '风险评分': 'riskScore','快速交易': 'quickTrade','订单管理': 'orderMgmt',
    '委托管理': 'entrustMgmt','成交查询': 'execQuery','持仓查询': 'positionQuery',
    '今日盈亏': 'todayPnl','本月盈亏': 'monthPnl','累计盈亏': 'totalPnl',
    '回测报告': 'backtestReport','回测对比': 'backtestCompare','回测参数': 'backtestParams',
    '回测结果': 'backtestResult','蒙特卡洛': 'monteCarlo','参数扫描': 'paramScan',
    '参数优化': 'paramOptimize','滚动优化': 'walkForward','最大回撤': 'maxDD',
    '夏普比率': 'sharpe','年化收益': 'annualR','胜率': 'winRate','盈亏比': 'plr',
    '总交易': 'totalTrades','盈利交易': 'winTrades','亏损交易': 'lossTrades',
    '收益曲线': 'returnCurve','回撤曲线': 'ddCurve','月度收益': 'monthlyRet',
    '交易时间线': 'tradeTimeline','数据导出': 'dataExport','数据质量': 'dataQuality',
    '导出格式': 'exportFormat','导出范围': 'exportRange','数据源': 'dataSource',
    '数据校验': 'dataValidate','完整性': 'completeness','准确性': 'accuracy',
    '及时性': 'timeliness','一致性': 'consistency','质量报告': 'qualityReport',
    '修复建议': 'fixSuggestion','AI助手': 'aiAssistant','智能分析': 'smartAnalysis',
    '分析结果': 'analysisResult','策略建议': 'strategySuggestion','风险提示': 'riskWarning',
    '市场解读': 'marketInterpretation','深度分析': 'deepAnalysis','生成报告': 'generateReport',
    '清空对话': 'clearChat','协作': 'collaboration','代理协作': 'agentCollab',
    '代理名称': 'agentName','任务分配': 'taskAssign','协作面板': 'collabPanel',
    '模型配置': 'modelConfig','基础模型': 'baseModel','API地址': 'apiAddress',
    '系统提示': 'systemPrompt','测试连接': 'testConnection',
    '版本发布': 'release','版本号': 'versionNumber','发布日期': 'releaseDate',
    '更新日志': 'changelog','新功能': 'newFeature','已知问题': 'knownIssue',
    '下载地址': 'downloadUrl','发布说明': 'releaseNote',
    '代理仪表盘': 'agentDashboard','任务队列': 'taskQueue','活跃任务': 'activeTasks',
    '完成率': 'completionRate','平均响应': 'avgResponse',
}

FULL_MAP = {**MOCK_MAP, **I18N_MAP_ORIG}

def add_import_and_hook(content):
    """Add import and hook if missing"""
    if "const { t } = useTranslation()" in content:
        return content
    
    # Add import after last existing import
    lines = content.split('\n')
    last_import = 0
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import = i
    import_line = "import { useTranslation } from 'react-i18next';"
    lines.insert(last_import + 1, import_line)
    content = '\n'.join(lines)
    
    # Add t() hook
    for pat in [r'(export default function\s+\w+\s*\([^)]*\)\s*\{)', 
                r'(export function\s+\w+\s*\([^)]*\)\s*\{)']:
        m = re.search(pat, content)
        if m:
            pos = m.end()
            content = content[:pos] + '\n  const { t } = useTranslation();' + content[pos:]
            return content
    return content

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()
    content = original
    reps = 0
    
    for cn_text, key in sorted(FULL_MAP.items(), key=lambda x: -len(x[0])):
        if cn_text not in content:
            continue
        
        # JSX text: >中文<
        pat1 = re.compile(r'>(' + re.escape(cn_text) + r')<')
        cnt1 = len(pat1.findall(content))
        if cnt1 > 0:
            content = pat1.sub(r'>{t("components.' + key + r'")}<', content)
            reps += cnt1
        
        # Quote string: '中文' or "中文" (not already inside t())
        # Simple approach: find all occurrences and replace if not preceded by t(
        escaped = re.escape(cn_text)
        for q in ["'", '"']:
            pattern_str = q + escaped + q
            idx = 0
            while True:
                idx = content.find(pattern_str, idx)
                if idx == -1:
                    break
                # Check preceding char - not inside t( or existing key
                before = content[max(0,idx-3):idx]
                if 't(' in before or 'key' in before.lower():
                    idx += len(pattern_str)
                    continue
                # Skip comment lines
                line_start = content.rfind('\n', 0, idx) + 1
                line = content[line_start:content.find('\n', idx)]
                if line.strip().startswith('//') or line.strip().startswith('*'):
                    idx += len(pattern_str)
                    continue
                # Replace
                replacement = 't("components.' + key + '")'
                content = content[:idx] + replacement + content[idx+len(pattern_str):]
                reps += 1
                idx += len(replacement)
    
    if content != original:
        content = add_import_and_hook(content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return reps
    return 0

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
        reps = process_file(f)
        if reps:
            total_files += 1
            total_reps += reps
            print(f'  {f}: {reps}')

print(f'\nFiles: {total_files}, Replacements: {total_reps}')
