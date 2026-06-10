// ── DAWN WHALES — SystemLog (系统日志) ─────────────────────────────────────

import { useState, useEffect , useTranslation} from 'react'
import { useState, useEffect } from 'react-i18next';

interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

const DEMO_LOGS: LogEntry[] = [
  { id: '1', timestamp: Date.now() - 1000, level: 'info', source: 'OpenD', message: '行情推送连接建立' },
  { id: '2', timestamp: Date.now() - 5000, level: 'info', source: 'StrategyEngine', message: '策略 MA_Crossover 启动运行' },
  { id: '3', timestamp: Date.now() - 12000, level: 'warn', source: 'RiskEngine', message: '日亏损接近上限 80%' },
  { id: '4', timestamp: Date.now() - 30000, level: 'info', source: 'Broker', message: '订单 #88234 部分成交 50/100' },
  { id: '5', timestamp: Date.now() - 45000, level: 'error', source: 'DataProvider', message: '获取 K 线数据超时，使用缓存' },
  { id: '6', timestamp: Date.now() - 60000, level: 'info', source: 'RiskEngine', message: 'Kelly 仓位计算: f*=0.125, qty=250' },
  { id: '7', timestamp: Date.now() - 90000, level: 'warn', source: 'MarketData', message: 'VIX 突破 25，波动率调节生效' },
  { id: '8', timestamp: Date.now() - 120000, level: 'info', source: 'Backtest', message: '回测完成: 夏普 1.34, 最大回撤 12.5%' },
];

export default function SystemLog() {
  const { t } = useTranslation();

  const [logs, setLogs] = useState<LogEntry[]>(DEMO_LOGS);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Simulate incoming logs
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const sources = ['OpenD', 'StrategyEngine', 'RiskEngine', 'Broker', 'MarketData'];
        const messages = [
          '心跳检测正常',
          '行情数据更新',
          '策略信号生成',
          '风控检查通过',
          '订单状态变更',
        ];
        const newLog: LogEntry = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          level: Math.random() > 0.8 ? 'warn' : 'info',
          source: sources[Math.floor(Math.random() * sources.length)],
          message: messages[Math.floor(Math.random() * messages.length)],
        };
        setLogs((prev) => [newLog, ...prev].slice(0, 100));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = logs.filter((l) => filter === 'all' || l.level === filter);

  const levelConfig = {
    info: { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-400/5' },
    warn: { dot: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-400/5' },
    error: { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-400/5' },
  };

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-sm">📋 系统日志</h2>
          <span className="text-[10px] text-gray-500">{logs.length} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              autoScroll ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
            }`}
          >
            {autoScroll ? '自动刷新' : '已暂停'}
          </button>
          <button
            onClick={() => setLogs([])}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 mb-3">
        {(['all', 'info', 'warn', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              filter === f ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {f === 'all' ? t('components.all') : f === 'info' ? '信息' : f === 'warn' ? t('components.warning') : t('components.error')}
          </button>
        ))}
      </div>

      {/* Log List */}
      <div className="space-y-1 max-h-64 overflow-y-auto pr-1 font-mono">
        {filtered.map((log) => {
          const cfg = levelConfig[log.level];
          return (
            <div
              key={log.id}
              className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[10px] ${cfg.bg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
              <span className="text-gray-500 flex-shrink-0 w-14">
                {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
              <span className={`flex-shrink-0 w-16 ${cfg.text}`}>{log.source}</span>
              <span className="text-gray-300 flex-1 min-w-0">{log.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
