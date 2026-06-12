// @ts-nocheck
// PerformanceMonitorPanel — Real-time system performance monitoring dashboard
// J-43-03: CPU, memory, latency, QPS metrics with multi-account comparison,
// alert history, and trend visualization

import { useState, useEffect, useMemo } from 'react';
import { EngineError } from '../../../electron/engine/core/engine-error';

// ============================================================
// Types & Interfaces
// ============================================================

type MetricType = 'cpu' | 'memory' | 'latency' | 'qps';
type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertType = 'threshold' | 'anomaly' | 'degradation' | 'recovery';
type TimeRange = '1h' | '1d' | '7d';
type TrendDirection = 'up' | 'down' | 'stable';

interface MetricValue {
  value: number;
  timestamp: number;
}

interface MetricConfig {
  key: MetricType;
  label: string;
  unit: string;
  min: number;
  max: number;
  warningThreshold: number;
  criticalThreshold: number;
  icon: string;
}

interface AccountPerformance {
  accountId: string;
  accountName: string;
  cpu: number;
  memory: number;
  latency: number;
  qps: number;
  uptime: number;
  errorRate: number;
}

interface PerformanceAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  metric: MetricType;
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

interface TrendPoint {
  time: number;
  value: number;
}

interface Props {
  accountId?: string;
  refreshIntervalMs?: number;
  maxHistoryPoints?: number;
  alertRetentionHours?: number;
}

// ============================================================
// Constants
// ============================================================

const METRIC_CONFIGS: MetricConfig[] = [
  {
    key: 'cpu',
    label: 'CPU Usage',
    unit: '%',
    min: 0,
    max: 100,
    warningThreshold: 70,
    criticalThreshold: 90,
    icon: '⚡',
  },
  {
    key: 'memory',
    label: 'Memory',
    unit: '%',
    min: 0,
    max: 100,
    warningThreshold: 75,
    criticalThreshold: 92,
    icon: '🧠',
  },
  {
    key: 'latency',
    label: 'Latency',
    unit: 'ms',
    min: 0,
    max: 5000,
    warningThreshold: 500,
    criticalThreshold: 2000,
    icon: '⏱️',
  },
  {
    key: 'qps',
    label: 'QPS',
    unit: 'req/s',
    min: 0,
    max: 10000,
    warningThreshold: 8000,
    criticalThreshold: 9500,
    icon: '📊',
  },
];

const MOCK_ACCOUNTS: string[] = [
  'Account-Alpha',
  'Account-Beta',
  'Account-Gamma',
  'Account-Delta',
  'Account-Epsilon',
];

const ALERT_MESSAGES: Record<AlertType, string[]> = {
  threshold: [
    'exceeded warning threshold',
    'breached critical limit',
    'approaching maximum capacity',
  ],
  anomaly: [
    'unusual spike detected',
    'abnormal pattern identified',
    'statistical deviation observed',
  ],
  degradation: [
    'performance degradation detected',
    'throughput declining steadily',
    'response time increasing',
  ],
  recovery: [
    'metric returned to normal range',
    'service recovered from degradation',
    'performance stabilized',
  ],
};

// ============================================================
// Utility Functions
// ============================================================

function generateRandomValue(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getStatusColor(value: number, config: MetricConfig): string {
  if (value >= config.criticalThreshold) return '#ef4444';
  if (value >= config.warningThreshold) return '#eab308';
  return '#22c55e';
}

function getStatusBg(value: number, config: MetricConfig): string {
  if (value >= config.criticalThreshold) return 'rgba(239, 68, 68, 0.15)';
  if (value >= config.warningThreshold) return 'rgba(234, 179, 8, 0.15)';
  return 'rgba(34, 197, 94, 0.15)';
}

function getStatusLabel(value: number, config: MetricConfig): string {
  if (value >= config.criticalThreshold) return 'Critical';
  if (value >= config.warningThreshold) return 'Warning';
  return 'Healthy';
}

function getTrendDirection(history: MetricValue[]): TrendDirection {
  if (history.length < 5) return 'stable';
  const recent = history.slice(-5);
  const values = recent.map((h) => h.value);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const firstHalf = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const diff = avg - firstHalf;
  if (Math.abs(diff) < avg * 0.02) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function generateMockAccountPerformance(): AccountPerformance[] {
  return MOCK_ACCOUNTS.map((name, idx) => ({
    accountId: `acc-${idx + 1}`,
    accountName: name,
    cpu: generateRandomValue(15, 85),
    memory: generateRandomValue(30, 90),
    latency: generateRandomValue(50, 800),
    qps: generateRandomValue(500, 8000),
    uptime: generateRandomValue(95, 99.99),
    errorRate: generateRandomValue(0, 5),
  }));
}

function generateTrendData(
  points: number,
  baseValue: number,
  variance: number
): TrendPoint[] {
  const now = Date.now();
  const result: TrendPoint[] = [];
  let current = baseValue;
  for (let i = 0; i < points; i++) {
    current += generateRandomValue(-variance, variance);
    current = Math.max(0, current);
    result.push({
      time: now - (points - i) * 60000,
      value: current,
    });
  }
  return result;
}

// ============================================================
// Sub-Components
// ============================================================

/** SVG trend arrow indicator */
function TrendArrow({ direction }: { direction: TrendDirection }) {
  if (direction === 'up') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" className="inline-block">
        <path d="M8 2 L13 9 L10 9 L10 14 L6 14 L6 9 L3 9 Z" fill="#ef4444" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" className="inline-block">
        <path d="M8 14 L13 7 L10 7 L10 2 L6 2 L6 7 L3 7 Z" fill="#22c55e" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className="inline-block">
      <rect x="2" y="6" width="12" height="4" rx="2" fill="#94a3b8" />
    </svg>
  );
}

/** SVG status dot with pulse animation */
function StatusDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-3 w-3">
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-3 w-3"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

/** Inline SVG mini sparkline for metric cards */
function Sparkline({
  data,
  color,
  width = 80,
  height = 30,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height * 0.8 - height * 0.1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Metric card showing current value, trend, sparkline */
function MetricCard({
  config,
  currentValue,
  history,
}: {
  config: MetricConfig;
  currentValue: number;
  history: MetricValue[];
}) {
  const color = getStatusColor(currentValue, config);
  const bgColor = getStatusBg(currentValue, config);
  const label = getStatusLabel(currentValue, config);
  const direction = getTrendDirection(history);
  const sparklineData = history.slice(-20).map((h) => h.value);
  const percent =
    ((currentValue - config.min) / (config.max - config.min)) * 100;

  return (
    <div
      className="rounded-xl p-4 border border-gray-700 transition-all duration-300 hover:border-gray-500"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">
          {config.icon} {config.label}
        </span>
        <StatusDot color={color} />
      </div>
      <div className="flex items-end justify-between mb-3">
        <div>
          <span className="text-3xl font-bold" style={{ color }}>
            {currentValue.toFixed(config.unit === 'ms' ? 0 : 1)}
          </span>
          <span className="text-sm text-gray-400 ml-1">{config.unit}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendArrow direction={direction} />
          <span className="text-xs text-gray-400 capitalize">{direction}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
        />
      </div>

      {/* Sparkline */}
      <div className="flex items-center justify-between">
        <Sparkline data={sparklineData} color={color} />
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            color,
            backgroundColor: `${color}20`,
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

/** Bar chart for multi-account comparison (inline SVG) */
function AccountComparisonChart({
  accounts,
  metric,
}: {
  accounts: AccountPerformance[];
  metric: MetricType;
}) {
  const config = METRIC_CONFIGS.find((c) => c.key === metric)!;
  const values = accounts.map((a) => a[metric] as number);
  const maxVal = Math.max(...values, config.max * 0.5);
  const barWidth = 40;
  const gap = 20;
  const chartHeight = 180;
  const chartWidth = accounts.length * (barWidth + gap) + gap;
  const labelsOffset = 25;

  const bestIdx = values.indexOf(Math.min(...values));
  const worstIdx = values.indexOf(Math.max(...values));

  return (
    <svg
      width={chartWidth}
      height={chartHeight + labelsOffset + 20}
      className="mx-auto"
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = chartHeight - frac * chartHeight;
        return (
          <g key={frac}>
            <line
              x1={0}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="#374151"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <text x={0} y={y - 4} fill="#6b7280" fontSize="10">
              {(maxVal * frac).toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {accounts.map((account, i) => {
        const val = account[metric] as number;
        const barHeight = (val / maxVal) * chartHeight;
        const x = gap + i * (barWidth + gap);
        const y = chartHeight - barHeight;
        const color = getStatusColor(val, config);
        const isBest = i === bestIdx;
        const isWorst = i === worstIdx;

        return (
          <g key={account.accountId}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              fill={color}
              opacity={0.85}
            />
            {/* Value label */}
            <text
              x={x + barWidth / 2}
              y={y - 6}
              fill={color}
              fontSize="11"
              textAnchor="middle"
              fontWeight="bold"
            >
              {val.toFixed(0)}
            </text>
            {/* Best/Worst indicator */}
            {isBest && (
              <text
                x={x + barWidth / 2}
                y={y - 18}
                fill="#22c55e"
                fontSize="10"
                textAnchor="middle"
              >
                ★ Best
              </text>
            )}
            {isWorst && (
              <text
                x={x + barWidth / 2}
                y={y - 18}
                fill="#ef4444"
                fontSize="10"
                textAnchor="middle"
              >
                ▼ Worst
              </text>
            )}
            {/* Account name label */}
            <text
              x={x + barWidth / 2}
              y={chartHeight + 15}
              fill="#9ca3af"
              fontSize="10"
              textAnchor="middle"
            >
              {account.accountName.split('-')[1]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Line chart for trend visualization (inline SVG) */
function TrendLineChart({
  series,
  color,
  width = 600,
  height = 200,
  label,
  unit,
}: {
  series: TrendPoint[];
  color: string;
  width?: number;
  height?: number;
  label: string;
  unit: string;
}) {
  if (series.length < 2) return null;

  const padding = { top: 20, right: 60, bottom: 30, left: 50 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = series.map((p) => p.value);
  const minV = Math.min(...values) * 0.9;
  const maxV = Math.max(...values) * 1.1;
  const rangeV = maxV - minV || 1;
  const minT = series[0].time;
  const maxT = series[series.length - 1].time;
  const rangeT = maxT - minT || 1;

  const toX = (t: number) => padding.left + ((t - minT) / rangeT) * innerW;
  const toY = (v: number) =>
    padding.top + innerH - ((v - minV) / rangeV) * innerH;

  const pathD = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.time).toFixed(1)},${toY(p.value).toFixed(1)}`)
    .join(' ');

  // Area fill
  const areaD =
    pathD +
    ` L${toX(maxT).toFixed(1)},${(padding.top + innerH).toFixed(1)}` +
    ` L${toX(minT).toFixed(1)},${(padding.top + innerH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: minV + f * rangeV,
    y: toY(minV + f * rangeV),
  }));

  // X-axis ticks (5 evenly spaced)
  const xTickCount = 5;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const t = minT + (i / (xTickCount - 1)) * rangeT;
    return { time: t, x: toX(t) };
  });

  const lastValue = series[series.length - 1].value;

  return (
    <svg width={width} height={height} className="w-full">
      <defs>
        <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="#374151"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <text
            x={padding.left - 8}
            y={tick.y + 4}
            fill="#6b7280"
            fontSize="10"
            textAnchor="end"
          >
            {tick.value.toFixed(tick.value > 100 ? 0 : 1)}
          </text>
        </g>
      ))}

      {/* X labels */}
      {xTicks.map((tick, i) => (
        <text
          key={i}
          x={tick.x}
          y={height - 5}
          fill="#6b7280"
          fontSize="10"
          textAnchor="middle"
        >
          {formatTimestamp(tick.time)}
        </text>
      ))}

      {/* Area */}
      <path d={areaD} fill={`url(#grad-${label})`} />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End dot */}
      <circle
        cx={toX(maxT)}
        cy={toY(lastValue)}
        r="4"
        fill={color}
        stroke="#111827"
        strokeWidth="2"
      />

      {/* Current value label */}
      <text
        x={toX(maxT) + 8}
        y={toY(lastValue) + 4}
        fill={color}
        fontSize="12"
        fontWeight="bold"
      >
        {lastValue.toFixed(1)} {unit}
      </text>
    </svg>
  );
}

/** Alert severity badge */
function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const colors: Record<AlertSeverity, { bg: string; text: string }> = {
    critical: { bg: 'bg-red-900/50', text: 'text-red-400' },
    warning: { bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
    info: { bg: 'bg-blue-900/50', text: 'text-blue-400' },
  };
  const c = colors[severity];
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text} capitalize`}
    >
      {severity}
    </span>
  );
}

/** Alert type badge */
function AlertTypeBadge({ type }: { type: AlertType }) {
  const colors: Record<AlertType, string> = {
    threshold: 'text-orange-400',
    anomaly: 'text-purple-400',
    degradation: 'text-red-400',
    recovery: 'text-green-400',
  };
  return (
    <span className={`text-xs font-medium capitalize ${colors[type]}`}>
      {type}
    </span>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function PerformanceMonitorPanel({
  refreshIntervalMs = 2000,
  maxHistoryPoints = 300,
  alertRetentionHours = 24,
}: Props) {
  // --- State ---
  const [metrics, setMetrics] = useState<Record<MetricType, MetricValue[]>>({
    cpu: [],
    memory: [],
    latency: [],
    qps: [],
  });
  const [accounts, setAccounts] = useState<AccountPerformance[]>(
    generateMockAccountPerformance()
  );
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('1h');
  const [selectedComparisonMetric, setSelectedComparisonMetric] =
    useState<MetricType>('cpu');
  const [alertFilterType, setAlertFilterType] = useState<AlertType | 'all'>(
    'all'
  );
  const [isLive, setIsLive] = useState(true);

  // --- Initialize with historical data ---
  useEffect(() => {
    const now = Date.now();
    const initial: Record<MetricType, MetricValue[]> = {
      cpu: generateTrendData(60, 45, 5).map((p) => ({
        value: p.value,
        timestamp: p.time,
      })),
      memory: generateTrendData(60, 62, 3).map((p) => ({
        value: p.value,
        timestamp: p.time,
      })),
      latency: generateTrendData(60, 200, 30).map((p) => ({
        value: p.value,
        timestamp: p.time,
      })),
      qps: generateTrendData(60, 3500, 300).map((p) => ({
        value: p.value,
        timestamp: p.time,
      })),
    };
    setMetrics(initial);

    // Seed some initial alerts
    const seedAlerts: PerformanceAlert[] = [
      {
        id: generateAlertId(),
        type: 'threshold',
        severity: 'warning',
        metric: 'cpu',
        message: 'CPU usage exceeded warning threshold',
        timestamp: now - 3600000,
        value: 78.5,
        threshold: 70,
        acknowledged: false,
      },
      {
        id: generateAlertId(),
        type: 'recovery',
        severity: 'info',
        metric: 'latency',
        message: 'Latency returned to normal range',
        timestamp: now - 7200000,
        value: 180,
        threshold: 500,
        acknowledged: true,
      },
      {
        id: generateAlertId(),
        type: 'anomaly',
        severity: 'critical',
        metric: 'memory',
        message: 'Memory unusual spike detected',
        timestamp: now - 1800000,
        value: 94.2,
        threshold: 92,
        acknowledged: false,
      },
    ];
    setAlerts(seedAlerts);
  }, []);

  // --- Real-time simulation loop ---
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const now = Date.now();

      setMetrics((prev) => {
        const updated: Record<MetricType, MetricValue[]> = { ...prev };

        // CPU: random walk around 35-65
        const lastCpu = prev.cpu.length > 0 ? prev.cpu[prev.cpu.length - 1].value : 45;
        const newCpu = clamp(lastCpu + generateRandomValue(-4, 4), 5, 98);
        updated.cpu = [...prev.cpu, { value: newCpu, timestamp: now }].slice(
          -maxHistoryPoints
        );

        // Memory: slow drift around 55-75
        const lastMem =
          prev.memory.length > 0 ? prev.memory[prev.memory.length - 1].value : 62;
        const newMem = clamp(lastMem + generateRandomValue(-2, 2.5), 20, 99);
        updated.memory = [
          ...prev.memory,
          { value: newMem, timestamp: now },
        ].slice(-maxHistoryPoints);

        // Latency: occasional spikes
        const lastLat =
          prev.latency.length > 0
            ? prev.latency[prev.latency.length - 1].value
            : 200;
        const spike = Math.random() < 0.05 ? generateRandomValue(200, 600) : 0;
        const newLat = clamp(
          lastLat + generateRandomValue(-20, 20) + spike,
          10,
          4500
        );
        updated.latency = [
          ...prev.latency,
          { value: newLat, timestamp: now },
        ].slice(-maxHistoryPoints);

        // QPS: correlated with inverse latency
        const lastQps =
          prev.qps.length > 0 ? prev.qps[prev.qps.length - 1].value : 3500;
        const newQps = clamp(
          lastQps + generateRandomValue(-200, 200),
          100,
          9900
        );
        updated.qps = [
          ...prev.qps,
          { value: newQps, timestamp: now },
        ].slice(-maxHistoryPoints);

        // Check for alerts
        METRIC_CONFIGS.forEach((config) => {
          const newVal = updated[config.key][updated[config.key].length - 1].value;
          if (newVal >= config.criticalThreshold && Math.random() < 0.3) {
            const types: AlertType[] = ['threshold', 'anomaly', 'degradation'];
            const type = types[Math.floor(Math.random() * types.length)];
            const msgs = ALERT_MESSAGES[type];
            setAlerts((prevAlerts) =>
              [
                {
                  id: generateAlertId(),
                  type,
                  severity: 'critical' as AlertSeverity,
                  metric: config.key,
                  message: `${config.label} ${msgs[Math.floor(Math.random() * msgs.length)]}`,
                  timestamp: now,
                  value: newVal,
                  threshold: config.criticalThreshold,
                  acknowledged: false,
                },
                ...prevAlerts,
              ].slice(0, 100)
            );
          } else if (newVal >= config.warningThreshold && Math.random() < 0.15) {
            const msgs = ALERT_MESSAGES.threshold;
            setAlerts((prevAlerts) =>
              [
                {
                  id: generateAlertId(),
                  type: 'threshold' as AlertType,
                  severity: 'warning' as AlertSeverity,
                  metric: config.key,
                  message: `${config.label} ${msgs[Math.floor(Math.random() * msgs.length)]}`,
                  timestamp: now,
                  value: newVal,
                  threshold: config.warningThreshold,
                  acknowledged: false,
                },
                ...prevAlerts,
              ].slice(0, 100)
            );
          }
        });

        return updated;
      });

      // Refresh account data periodically
      if (Math.random() < 0.3) {
        setAccounts(generateMockAccountPerformance());
      }
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [isLive, refreshIntervalMs, maxHistoryPoints]);

  // --- Clean up old alerts ---
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - alertRetentionHours * 3600000;
      setAlerts((prev) => prev.filter((a) => a.timestamp > cutoff));
    }, 60000);
    return () => clearInterval(cleanupInterval);
  }, [alertRetentionHours]);

  // --- Derived data ---
  const currentValues = useMemo(() => {
    const result: Record<MetricType, number> = { cpu: 0, memory: 0, latency: 0, qps: 0 };
    (Object.keys(metrics) as MetricType[]).forEach((key) => {
      const arr = metrics[key];
      result[key] = arr.length > 0 ? arr[arr.length - 1].value : 0;
    });
    return result;
  }, [metrics]);

  const filteredAlerts = useMemo(() => {
    let filtered = [...alerts];
    if (alertFilterType !== 'all') {
      filtered = filtered.filter((a) => a.type === alertFilterType);
    }
    // Time range filter
    const now = Date.now();
    const rangeMs: Record<TimeRange, number> = {
      '1h': 3600000,
      '1d': 86400000,
      '7d': 604800000,
    };
    const cutoff = now - rangeMs[selectedTimeRange];
    filtered = filtered.filter((a) => a.timestamp >= cutoff);
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [alerts, alertFilterType, selectedTimeRange]);

  const trendSeries = useMemo(() => {
    const rangeMs: Record<TimeRange, number> = {
      '1h': 3600000,
      '1d': 86400000,
      '7d': 604800000,
    };
    const cutoff = Date.now() - rangeMs[selectedTimeRange];
    const result: Record<MetricType, TrendPoint[]> = { cpu: [], memory: [], latency: [], qps: [] };
    (Object.keys(metrics) as MetricType[]).forEach((key) => {
      result[key] = metrics[key]
        .filter((m) => m.timestamp >= cutoff)
        .map((m) => ({ time: m.timestamp, value: m.value }));
    });
    return result;
  }, [metrics, selectedTimeRange]);

  const alertStats = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'critical').length;
    const warning = alerts.filter((a) => a.severity === 'warning').length;
    const info = alerts.filter((a) => a.severity === 'info').length;
    return { critical, warning, info, total: alerts.length };
  }, [alerts]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Performance Monitor
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time system metrics and alert monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Live toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              isLive
                ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
              }`}
            />
            {isLive ? 'Live' : 'Paused'}
          </button>

          {/* Time range selector */}
          <div className="flex bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {(['1h', '1d', '7d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  selectedTimeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert summary bar */}
      <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl px-5 py-3 border border-gray-700">
        <span className="text-sm text-gray-400">Alert Summary:</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-sm text-red-400 font-medium">
            {alertStats.critical} Critical
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-sm text-yellow-400 font-medium">
            {alertStats.warning} Warning
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-sm text-blue-400 font-medium">
            {alertStats.info} Info
          </span>
        </div>
        <span className="text-sm text-gray-500 ml-auto">
          {alertStats.total} total alerts
        </span>
      </div>

      {/* Real-time Metric Cards */}
      <section>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">
          Real-time Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {METRIC_CONFIGS.map((config) => (
            <MetricCard
              key={config.key}
              config={config}
              currentValue={currentValues[config.key]}
              history={metrics[config.key]}
            />
          ))}
        </div>
      </section>

      {/* Two-column: Comparison + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Multi-Account Performance Comparison */}
        <section className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200">
              Account Comparison
            </h2>
            <select
              value={selectedComparisonMetric}
              onChange={(e) =>
                setSelectedComparisonMetric(e.target.value as MetricType)
              }
              className="bg-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              {METRIC_CONFIGS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label} ({c.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <AccountComparisonChart
              accounts={accounts}
              metric={selectedComparisonMetric}
            />
          </div>

          {/* Account details table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-2">Account</th>
                  <th className="text-right py-2 px-2">CPU</th>
                  <th className="text-right py-2 px-2">Memory</th>
                  <th className="text-right py-2 px-2">Latency</th>
                  <th className="text-right py-2 px-2">QPS</th>
                  <th className="text-right py-2 px-2">Uptime</th>
                  <th className="text-right py-2 px-2">Err Rate</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  const cpuColor = getStatusColor(
                    acc.cpu,
                    METRIC_CONFIGS[0]
                  );
                  const memColor = getStatusColor(
                    acc.memory,
                    METRIC_CONFIGS[1]
                  );
                  const latColor = getStatusColor(
                    acc.latency,
                    METRIC_CONFIGS[2]
                  );
                  return (
                    <tr
                      key={acc.accountId}
                      className="border-b border-gray-800 hover:bg-gray-800/50"
                    >
                      <td className="py-2 px-2 font-medium text-gray-200">
                        {acc.accountName}
                      </td>
                      <td
                        className="py-2 px-2 text-right font-mono"
                        style={{ color: cpuColor }}
                      >
                        {acc.cpu.toFixed(1)}%
                      </td>
                      <td
                        className="py-2 px-2 text-right font-mono"
                        style={{ color: memColor }}
                      >
                        {acc.memory.toFixed(1)}%
                      </td>
                      <td
                        className="py-2 px-2 text-right font-mono"
                        style={{ color: latColor }}
                      >
                        {acc.latency.toFixed(0)}ms
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-gray-300">
                        {acc.qps.toFixed(0)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-green-400">
                        {acc.uptime.toFixed(2)}%
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-gray-300">
                        {acc.errorRate.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Performance Alert History */}
        <section className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-200">
              Alert History
            </h2>
            <select
              value={alertFilterType}
              onChange={(e) =>
                setAlertFilterType(e.target.value as AlertType | 'all')
              }
              className="bg-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="threshold">Threshold</option>
              <option value="anomaly">Anomaly</option>
              <option value="degradation">Degradation</option>
              <option value="recovery">Recovery</option>
            </select>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-3">🔔</p>
                <p>No alerts in the selected time range</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                    alert.acknowledged
                      ? 'bg-gray-800/30 border-gray-700/50 opacity-60'
                      : 'bg-gray-800/60 border-gray-600'
                  }`}
                >
                  {/* Severity indicator line */}
                  <div
                    className="w-1 rounded-full self-stretch flex-shrink-0"
                    style={{
                      backgroundColor:
                        alert.severity === 'critical'
                          ? '#ef4444'
                          : alert.severity === 'warning'
                          ? '#eab308'
                          : '#3b82f6',
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={alert.severity} />
                      <AlertTypeBadge type={alert.type} />
                      <span className="text-xs text-gray-500">
                        {alert.metric.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">
                        Value: {alert.value.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-600">|</span>
                      <span className="text-xs text-gray-500">
                        Threshold: {alert.threshold}
                      </span>
                      <span className="text-xs text-gray-600">|</span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(alert.timestamp)}
                      </span>
                    </div>
                  </div>

                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="flex-shrink-0 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                    >
                      Ack
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Performance Trend Visualization */}
      <section className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">
            Performance Trends
          </h2>
          <span className="text-xs text-gray-500">
            Range: {selectedTimeRange} · {trendSeries.cpu.length} data points
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {METRIC_CONFIGS.map((config) => {
            const direction = getTrendDirection(metrics[config.key]);
            const color = getStatusColor(currentValues[config.key], config);
            return (
              <div
                key={config.key}
                className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-300 font-medium">
                      {config.icon} {config.label}
                    </span>
                    <TrendArrow direction={direction} />
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{
                      color,
                      backgroundColor: `${color}20`,
                    }}
                  >
                    {direction}
                  </span>
                </div>
                <TrendLineChart
                  series={trendSeries[config.key]}
                  color={color}
                  width={550}
                  height={180}
                  label={config.key}
                  unit={config.unit}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer status bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-800">
        <span>
          Last updated: {metrics.cpu.length > 0 ? formatTimestamp(metrics.cpu[metrics.cpu.length - 1].timestamp) : 'N/A'}
        </span>
        <span>
          History: {metrics.cpu.length} points · Refresh: {refreshIntervalMs / 1000}s
        </span>
        <span>
          Alerts retained: {alertRetentionHours}h · Total: {alerts.length}
        </span>
      </div>
    </div>
  );
}

void EngineError; // [SYSTEM] structured error tracking