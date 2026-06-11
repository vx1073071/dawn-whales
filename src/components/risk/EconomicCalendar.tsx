// ── DAWN WHALES — EconomicCalendar () ──────────────────────────────

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  event: string;
  importance: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
  actual?: string;
}

const DEMO_EVENTS: EconomicEvent[] = [
  { id: '1', date: '2026-06-05', time: '20:30', country: '🇺🇸', event: i18n.t('EconomicCalendar.k1'), importance: 'high', forecast: i18n.t('EconomicCalendar.k2'), previous: i18n.t('EconomicCalendar.k3') },
  { id: '2', date: '2026-06-05', time: '20:30', country: '🇺🇸', event: i18n.t('EconomicCalendar.k4'), importance: 'high', forecast: '3.8%', previous: '3.9%' },
  { id: '3', date: '2026-06-10', time: '20:30', country: '🇺🇸', event: i18n.t('EconomicCalendar.k5'), importance: 'high', forecast: '0.3%', previous: '0.4%' },
  { id: '4', date: '2026-06-10', time: '02:00', country: '🇺🇸', event: i18n.t('EconomicCalendar.k6'), importance: 'high', forecast: '5.50%', previous: '5.50%' },
  { id: '5', date: '2026-06-12', time: '20:30', country: '🇺🇸', event: i18n.t('EconomicCalendar.k7'), importance: 'medium', forecast: '0.2%', previous: '0.3%' },
  { id: '6', date: '2026-06-13', time: '22:00', country: '🇺🇸', event: i18n.t('EconomicCalendar.k8'), importance: 'medium', forecast: '68.5', previous: '67.4' },
  { id: '7', date: '2026-06-15', time: '09:30', country: '🇨🇳', event: i18n.t('EconomicCalendar.k9'), importance: 'medium', forecast: '5.8%', previous: '5.6%' },
  { id: '8', date: '2026-06-18', time: '20:30', country: '🇺🇸', event: i18n.t('EconomicCalendar.k10'), importance: 'medium', forecast: i18n.t('EconomicCalendar.k11'), previous: i18n.t('EconomicCalendar.k12') },
];

export default function EconomicCalendar() {
  const { t } = useTranslation();

  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');

  const filtered = useMemo(() => {
    let events = DEMO_EVENTS;
    if (filter !== 'all') {
      events = events.filter((e) => e.importance === filter);
    }
    return events.sort((a, b) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime());
  }, [filter]);

  const now = new Date();
  const nextEvent = filtered.find((e) => new Date(e.date + 'T' + e.time) > now);

  const importanceConfig = {
    high: { dot: 'bg-red-500', label: i18n.t('EconomicCalendar.k13'), bg: 'bg-red-500/10', text: 'text-red-400' },
    medium: { dot: 'bg-[#D4A853]', label: i18n.t('EconomicCalendar.k14'), bg: 'bg-[#D4A853]/10', text: 'text-[#D4A853]' },
    low: { dot: 'bg-gray-500', label: i18n.t('EconomicCalendar.k15'), bg: 'bg-gray-500/10', text: 'text-gray-400' },
  };

  return (
    <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-semibold text-sm">📅 财经日历</h2>
          {nextEvent && (
            <p className="text-gray-500 text-[10px] mt-0.5">
              下一个: {nextEvent.country} {nextEvent.event} · {nextEvent.date.slice(5)} {nextEvent.time}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'high', 'medium'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                filter === f ? 'bg-[#C9A046] text-black' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {f === 'all' ? t('components.all') : f === 'high' ? i18n.t('EconomicCalendar.k16') : i18n.t('EconomicCalendar.k17')}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
        {filtered.map((event) => {
          const cfg = importanceConfig[event.importance];
          const eventTime = new Date(event.date + 'T' + event.time);
          const isPast = eventTime < now;
          return (
            <div
              key={event.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
                isPast ? 'bg-[#12121a] opacity-50' : 'bg-[#12121a] border border-white/5'
              }`}
            >
              <div className="flex-shrink-0 w-14">
                <div className="text-gray-400 text-[10px]">{event.date.slice(5)}</div>
                <div className="text-gray-500 text-[10px] font-mono">{event.time}</div>
              </div>
              <span className="text-sm flex-shrink-0">{event.country}</span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-xs truncate">{event.event}</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  {event.forecast && <span>{i18n.t('EconomicCalendar.k0')}{event.forecast}</span>}
                  {event.previous && <span>{i18n.t('EconomicCalendar.k1')}{event.previous}</span>}
                  {event.actual && <span className="text-[#D4A853]">{i18n.t('EconomicCalendar.k2')}{event.actual}</span>}
                </div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} flex-shrink-0`}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
