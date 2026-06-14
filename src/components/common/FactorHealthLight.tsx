// ── R170 B5: Factor Health Traffic Light ─────────────────────────────────
// Shows the health status of each factor with a traffic light indicator.
// Green = healthy, Yellow = warning, Red = critical.
//
// Integrates with factor-decay-monitor.ts and factor-alert-service.ts.
// Each light shows: IC trend direction, half-life status, alert count.
// Hovering shows detailed health report.

import React, { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface FactorHealthItem {
  factorId: string;
  nameCN: string;
  status: HealthStatus;
  currentIC?: number;
  icTrend?: 'up' | 'down' | 'flat';
  halfLifeDays?: number;
  crowdingPct?: number;
  activeAlerts?: number;
  lastChecked?: string;
  detail?: string;
}

interface FactorHealthLightProps {
  items: FactorHealthItem[];
  className?: string;
  /** Callback when a factor light is clicked */
  onSelect?: (factorId: string) => void;
  selectedFactorId?: string;
}

// ── Status configuration ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<HealthStatus, {
  label: string;
  color: string;
  bgColor: string;
  glowColor: string;
  dotClassName: string;
}> = {
  healthy: {
    label: '健康',
    color: '#22c55e',
    bgColor: 'rgba(34,197,94,0.1)',
    glowColor: 'rgba(34,197,94,0.4)',
    dotClassName: 'bg-green-500',
  },
  warning: {
    label: '预警',
    color: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.1)',
    glowColor: 'rgba(245,158,11,0.4)',
    dotClassName: 'bg-yellow-500',
  },
  critical: {
    label: '危险',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.1)',
    glowColor: 'rgba(239,68,68,0.5)',
    dotClassName: 'bg-red-500',
  },
  unknown: {
    label: '未知',
    color: '#6b7280',
    bgColor: 'rgba(107,114,128,0.1)',
    glowColor: 'rgba(107,114,128,0.3)',
    dotClassName: 'bg-gray-500',
  },
};

// ── Sub-component: Single traffic light ──────────────────────────────────────

const TrafficLightDot: React.FC<{
  item: FactorHealthItem;
  isSelected: boolean;
  onClick?: () => void;
}> = ({ item, isSelected, onClick }) => {
  const config = STATUS_CONFIG[item.status];
  const [showDetail, setShowDetail] = useState(false);

  const trendArrow: Record<string, string> = {
    up: '↗', down: '↘', flat: '→',
  };

  return (
    <div className="relative">
      <button
        onClick={() => { onClick?.(); setShowDetail(!showDetail); }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          isSelected
            ? 'border-white/20'
            : 'border-transparent hover:border-white/10'
        }`}
        style={{ backgroundColor: isSelected ? config.bgColor : 'transparent' }}
        title={`${item.nameCN}: ${config.label}`}
      >
        {/* Traffic light */}
        <div className="relative flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center relative"
            style={{
              backgroundColor: config.color + '20',
              boxShadow: isSelected ? `0 0 12px ${config.glowColor}` : 'none',
            }}
          >
            {/* Inner dot with pulse when not healthy */}
            <div
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                item.status === 'critical' ? 'animate-pulse' : ''
              }`}
              style={{ backgroundColor: config.color }}
            />
            {/* Ring animation for warning/critical */}
            {(item.status === 'warning' || item.status === 'critical') && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: config.color }}
              />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="text-left">
          <div className="text-xs text-white font-medium leading-tight">
            {item.nameCN}
          </div>
          <div className="text-[10px] opacity-70" style={{ color: config.color }}>
            {config.label}
            {item.currentIC !== undefined && (
              <span className="ml-1 font-mono">
                IC: {item.currentIC.toFixed(3)}
              </span>
            )}
          </div>
        </div>

        {/* Trend arrow */}
        {item.icTrend && (
          <span
            className={`text-xs font-bold ${
              item.icTrend === 'up' ? 'text-green-400' :
              item.icTrend === 'down' ? 'text-red-400' :
              'text-gray-500'
            }`}
          >
            {trendArrow[item.icTrend]}
          </span>
        )}

        {/* Alert count */}
        {item.activeAlerts !== undefined && item.activeAlerts > 0 && (
          <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">
            {item.activeAlerts}
          </span>
        )}
      </button>

      {/* Detail popover */}
      {showDetail && (
        <div className="absolute z-40 top-full left-0 mt-1 w-[260px] bg-[#1a1a25] border border-white/10 rounded-lg p-3 shadow-2xl text-[10px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white font-medium text-xs">{item.nameCN}</span>
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              {config.label}
            </span>
          </div>

          <div className="space-y-1.5">
            {item.currentIC !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">当前IC</span>
                <span className="text-white font-mono">{item.currentIC.toFixed(4)}</span>
              </div>
            )}
            {item.icTrend && (
              <div className="flex justify-between">
                <span className="text-gray-500">IC趋势</span>
                <span className={
                  item.icTrend === 'up' ? 'text-green-400' :
                  item.icTrend === 'down' ? 'text-red-400' :
                  'text-gray-400'
                }>
                  {item.icTrend === 'up' ? '上升' : item.icTrend === 'down' ? '下降' : '持平'}
                </span>
              </div>
            )}
            {item.halfLifeDays !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">半衰期</span>
                <span className={
                  item.halfLifeDays >= 30 ? 'text-green-400' :
                  item.halfLifeDays >= 15 ? 'text-yellow-400' :
                  'text-red-400'
                }>
                  {item.halfLifeDays}天
                </span>
              </div>
            )}
            {item.crowdingPct !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">拥挤度</span>
                <span className={
                  item.crowdingPct < 30 ? 'text-green-400' :
                  item.crowdingPct < 60 ? 'text-yellow-400' :
                  'text-red-400'
                }>
                  {item.crowdingPct}%
                </span>
              </div>
            )}
            {item.lastChecked && (
              <div className="flex justify-between">
                <span className="text-gray-500">上次检查</span>
                <span className="text-gray-400">{item.lastChecked}</span>
              </div>
            )}
          </div>

          {item.detail && (
            <p className="mt-2 pt-2 border-t border-white/5 text-gray-500 leading-relaxed">
              {item.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ── Summary bar ──────────────────────────────────────────────────────────────

const HealthSummary: React.FC<{ items: FactorHealthItem[] }> = ({ items }) => {
  const counts = {
    healthy: items.filter((i) => i.status === 'healthy').length,
    warning: items.filter((i) => i.status === 'warning').length,
    critical: items.filter((i) => i.status === 'critical').length,
    unknown: items.filter((i) => i.status === 'unknown').length,
    total: items.length,
  };

  return (
    <div className="flex items-center gap-3 text-[10px]">
      <span className="text-gray-500">因子健康:</span>
      <span className="text-green-400 font-medium">
        🟢 {counts.healthy}
      </span>
      <span className="text-yellow-400 font-medium">
        🟡 {counts.warning}
      </span>
      <span className="text-red-400 font-medium">
        🔴 {counts.critical}
      </span>
      {(counts.unknown > 0) && (
        <span className="text-gray-500">
          ⚪ {counts.unknown}
        </span>
      )}
      <span className="text-gray-600">
        / {counts.total}
      </span>

      {/* Overall health bar */}
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[120px] ml-2">
        <div className="flex h-full">
          {counts.healthy > 0 && (
            <div
              className="bg-green-500 h-full transition-all"
              style={{ width: `${(counts.healthy / counts.total) * 100}%` }}
            />
          )}
          {counts.warning > 0 && (
            <div
              className="bg-yellow-500 h-full transition-all"
              style={{ width: `${(counts.warning / counts.total) * 100}%` }}
            />
          )}
          {counts.critical > 0 && (
            <div
              className="bg-red-500 h-full transition-all"
              style={{ width: `${(counts.critical / counts.total) * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const FactorHealthLight: React.FC<FactorHealthLightProps> = ({
  items,
  className,
  onSelect,
  selectedFactorId,
}) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-gray-600">
        暂无因子健康数据
      </div>
    );
  }

  return (
    <div className={`bg-gray-900/60 rounded-lg border border-gray-800 p-4 ${className ?? ''}`}>
      <h3 className="text-xs font-semibold text-gray-300 mb-3">
        🚦 因子健康红绿灯
      </h3>

      {/* Summary bar */}
      <div className="mb-3">
        <HealthSummary items={items} />
      </div>

      {/* Traffic lights grid */}
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <TrafficLightDot
            key={item.factorId}
            item={item}
            isSelected={item.factorId === selectedFactorId}
            onClick={() => onSelect?.(item.factorId)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-white/5 flex gap-4 text-[9px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span> 健康: IC稳定, 半衰期&gt;30天
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span> 预警: IC衰减中, 半衰期15-30天
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span> 危险: IC骤降, 半衰期&lt;15天
        </span>
      </div>
    </div>
  );
};

// ── Hook: Generate mock health items from factor data ────────────────────────

export function useFactorHealthMock(): FactorHealthItem[] {
  const mockFactors: FactorHealthItem[] = [
    {
      factorId: 'MKT', nameCN: '市场Beta', status: 'healthy',
      currentIC: 0.055, icTrend: 'flat', halfLifeDays: 52, crowdingPct: 12,
      lastChecked: '2分钟前', detail: '市场Beta因子表现稳定，IC保持在0.05以上。当前高Beta环境对趋势策略有利。',
    },
    {
      factorId: 'MOM_12M', nameCN: '12月动量', status: 'warning',
      currentIC: 0.028, icTrend: 'down', halfLifeDays: 18, crowdingPct: 55,
      activeAlerts: 2,
      lastChecked: '2分钟前', detail: '动量因子IC从0.045降至0.028，半衰期缩短至18天。拥挤度升至55%，提示避开纯动量策略。',
    },
    {
      factorId: 'HML', nameCN: '价值因子', status: 'healthy',
      currentIC: 0.035, icTrend: 'up', halfLifeDays: 90, crowdingPct: 15,
      lastChecked: '2分钟前', detail: '价值因子近期IC回升，半衰期90天表现稳健。低拥挤度意味着仍有Alpha空间。',
    },
    {
      factorId: 'VOL_60D', nameCN: '60日低波', status: 'warning',
      currentIC: -0.038, icTrend: 'down', halfLifeDays: 25, crowdingPct: 42,
      activeAlerts: 1,
      lastChecked: '2分钟前', detail: '低波因子IC持续走弱，牛市中低波策略可能跑输。拥挤度上升需关注。',
    },
    {
      factorId: 'QUAL', nameCN: '品质因子', status: 'healthy',
      currentIC: 0.040, icTrend: 'up', halfLifeDays: 60, crowdingPct: 18,
      lastChecked: '2分钟前', detail: '品质因子IC回升至0.04，上升趋势明显。低拥挤+长半衰期，适合长期配置。',
    },
    {
      factorId: 'LIQ', nameCN: '流动性因子', status: 'critical',
      currentIC: 0.012, icTrend: 'down', halfLifeDays: 10, crowdingPct: 68,
      activeAlerts: 3,
      lastChecked: '2分钟前', detail: '流动性因子IC骤降至0.012，半衰期仅10天。极度拥挤，建议暂停使用该因子。',
    },
    {
      factorId: 'SMB', nameCN: '小盘因子', status: 'unknown',
      lastChecked: '2分钟前', detail: '小盘因子数据暂时不可用，等待Futu OpenD数据恢复。',
    },
    {
      factorId: 'YIELD', nameCN: '股息率', status: 'healthy',
      currentIC: 0.028, icTrend: 'flat', halfLifeDays: 80, crowdingPct: 10,
      lastChecked: '2分钟前', detail: '股息率因子长期稳定，低拥挤度。在利率下行周期中表现更优。',
    },
  ];
  return mockFactors;
}

export default FactorHealthLight;
