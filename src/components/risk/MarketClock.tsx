// ── DAWN WHALES — MarketClock (全球市场时钟) ───────────────────────────────

import { useState, useEffect } from 'react'
import { useState, useEffect } from 'react-i18next';

interface MarketSession {
  name: string;
  timezone: string;
  openHour: number;
  openMin: number;
  closeHour: number;
  closeMin: number;
  emoji: string;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

const MARKETS: MarketSession[] = [
  {
    name: '美股', timezone: 'America/New_York', openHour: 9, openMin: 30,
    closeHour: 16, closeMin: 0, emoji: '🇺🇸', days: [1, 2, 3, 4, 5],
  },
  {
    name: '港股', timezone: 'Asia/Hong_Kong', openHour: 9, openMin: 30,
    closeHour: 16, closeMin: 0, emoji: '🇭🇰', days: [1, 2, 3, 4, 5],
  },
  {
    name: 'A股', timezone: 'Asia/Shanghai', openHour: 9, openMin: 30,
    closeHour: 15, closeMin: 0, emoji: '🇨🇳', days: [1, 2, 3, 4, 5],
  },
  {
    name: '加密货币', timezone: 'UTC', openHour: 0, openMin: 0,
    closeHour: 24, closeMin: 0, emoji: '₿', days: [0, 1, 2, 3, 4, 5, 6],
  },
];

function getMarketStatus(market: MarketSession): {
  status: 'open' | 'closed' | 'pre' | 'post';
  label: string;
  color: string;
  nextEvent: string;
  minutesUntil: number;
} {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: market.timezone }));
  const day = tzNow.getDay();
  const hour = tzNow.getHours();
  const min = tzNow.getMinutes();
  const minutes = hour * 60 + min;
  const openMinutes = market.openHour * 60 + market.openMin;
  const closeMinutes = market.closeHour * 60 + market.closeMin;

  if (!market.days.includes(day)) {
    return { status: 'closed', label: '休市', color: 'text-gray-500', nextEvent: '周一开市', minutesUntil: getMinutesUntil(day, 1, openMinutes, tzNow) };
  }

  if (minutes < openMinutes - 60) {
    return { status: 'pre', label: '盘前', color: 'text-yellow-400', nextEvent: '开市', minutesUntil: openMinutes - minutes };
  }
  if (minutes < openMinutes) {
    return { status: 'pre', label: '即将开盘', color: 'text-[#D4A853]', nextEvent: t('components.openPrice'), minutesUntil: openMinutes - minutes };
  }
  if (minutes < closeMinutes) {
    return { status: 'open', label: '交易中', color: 'text-emerald-400', nextEvent: t('components.closePrice'), minutesUntil: closeMinutes - minutes };
  }
  if (minutes < closeMinutes + 120) {
    return { status: 'post', label: '盘后', color: 'text-blue-400', nextEvent: '收盘结束', minutesUntil: closeMinutes + 120 - minutes };
  }
  return { status: 'closed', label: '已收盘', color: 'text-gray-500', nextEvent: '明日开盘', minutesUntil: getMinutesUntil(day, market.days.includes(day + 1) ? day + 1 : 1, openMinutes, tzNow) };
}

function getMinutesUntil(currentDay: number, targetDay: number, targetMinutes: number, now: Date): number {
  let daysDiff = targetDay - currentDay;
  if (daysDiff <= 0) daysDiff += 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return daysDiff * 1440 - currentMinutes + targetMinutes;
}

function formatCountdown(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}小时${m}分`;
  return `${m}分钟`;
}

export default function MarketClock() {
  const { t } = useTranslation();

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold text-sm">🌍 全球市场时钟</h2>
        <span className="text-gray-500 text-[10px] font-mono">
          {time.toLocaleTimeString('zh-CN', { hour12: false })} (本地)
        </span>
      </div>

      <div className="space-y-2">
        {MARKETS.map((market) => {
          const status = getMarketStatus(market);
          return (
            <div
              key={market.name}
              className="flex items-center justify-between bg-[#12121a] rounded-lg px-3 py-2.5 border border-white/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{market.emoji}</span>
                <div>
                  <div className="text-white text-xs font-medium">{market.name}</div>
                  <div className="text-gray-500 text-[10px]">
                    {String(market.openHour).padStart(2, '0')}:{String(market.openMin).padStart(2, '0')} - {String(market.closeHour).padStart(2, '0')}:{String(market.closeMin).padStart(2, '0')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-medium ${status.color}`}>
                  {status.status === 'open' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />}
                  {status.label}
                </div>
                <div className="text-gray-500 text-[10px]">
                  {status.status === 'open'
                    ? `${status.nextEvent} ${formatCountdown(status.minutesUntil)}`
                    : `${status.nextEvent} ${formatCountdown(status.minutesUntil)}`
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
