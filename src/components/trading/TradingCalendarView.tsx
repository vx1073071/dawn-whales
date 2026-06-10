// ── TradingCalendarView ────────────────────────────────────────────────────

// Phase 4.2: 交易日历可视化组件

// ML-31-02 [P0]: 日历可视化 + 交易时段高亮 + 倒计时



import { useState, useEffect, useMemo } from 'react';



// ── Types ──────────────────────────────────────────────────────────────────






interface TradingSession {

  name: string;       // pre-market | regular | after-hours

  start: string;      // HH:MM

  end: string;        // HH:MM

}



interface Countdown {

  session: string;

  hours: number;

  minutes: number;

  seconds: number;

  isTrading: boolean;

}



// ── Mock Data ──────────────────────────────────────────────────────────────



const US_SESSIONS: TradingSession[] = [

  { name: 'pre-market', start: '04:00', end: '09:30' },

  { name: 'regular', start: '09:30', end: '16:00' },

  { name: 'after-hours', start: '16:00', end: '20:00' },

];



const HK_SESSIONS: TradingSession[] = [

  { name: 'pre-market', start: '09:00', end: '09:30' },

  { name: 'regular', start: '09:30', end: '16:00' },

  { name: 'after-hours', start: '16:00', end: '17:00' },

];



const US_HOLIDAYS_2026: Record<string, string> = {

  '2026-01-01': 'New Year\'s Day',

  '2026-01-19': 'Martin Luther King Jr. Day',

  '2026-02-16': 'Presidents\' Day',

  '2026-04-03': 'Good Friday',

  '2026-05-25': 'Memorial Day',

  '2026-06-19': 'Juneteenth',

  '2026-07-03': 'Independence Day',

  '2026-09-07': 'Labor Day',

  '2026-11-26': 'Thanksgiving Day',

  '2026-11-27': 'Early Close (1PM)',

  '2026-12-25': 'Christmas Day',

};



const HK_HOLIDAYS_2026: Record<string, string> = {

  '2026-01-01': 'New Year\'s Day',

  '2026-02-17': 'Chinese New Year',

  '2026-02-18': 'Chinese New Year',

  '2026-02-19': 'Chinese New Year',

  '2026-04-03': 'Good Friday',

  '2026-04-06': 'Easter Monday',

  '2026-04-07': 'Ching Ming Festival',

  '2026-05-01': 'Labour Day',

  '2026-05-14': 'Buddha\'s Birthday',

  '2026-06-09': 'Tuen Ng Festival',

  '2026-07-01': 'HKSAR Establishment Day',

  '2026-09-25': 'Mid-Autumn Festival',

  '2026-10-01': 'National Day',

  '2026-10-26': 'Chung Yeung Festival',

  '2026-12-25': 'Christmas Day',

  '2026-12-26': 'Boxing Day',

};



// ── Helpers ────────────────────────────────────────────────────────────────



function getDaysInMonth(year: number, month: number): number {

  return new Date(year, month + 1, 0).getDate();

}



function getFirstDayOfMonth(year: number, month: number): number {

  return new Date(year, month, 1).getDay(); // 0=Sun

}



function formatDate(y: number, m: number, d: number): string {

  const mm = String(m + 1).padStart(2, '0');

  const dd = String(d).padStart(2, '0');

  return `${y}-${mm}-${dd}`;

}



function isWeekend(dateStr: string): boolean {

  const d = new Date(dateStr + 'T00:00:00');

  return d.getDay() === 0 || d.getDay() === 6;

}



function getCurrentSession(sessions: TradingSession[]): TradingSession | null {

  const now = new Date();

  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;



  for (const session of sessions) {

    if (timeStr >= session.start && timeStr < session.end) {

      return session;

    }

  }

  return null;

}



function computeCountdown(sessions: TradingSession[]): Countdown | null {

  const now = new Date();

  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;



  // Check if currently in a session

  for (const session of sessions) {

    if (timeStr >= session.start + ':00' && timeStr < session.end + ':00') {

      // Compute time until end

      const [h, m] = session.end.split(':').map(Number);

      const endDate = new Date(now);

      endDate.setHours(h, m, 0, 0);

      const diff = endDate.getTime() - now.getTime();

      return {

        session: session.name,

        hours: Math.floor(diff / 3600000),

        minutes: Math.floor((diff % 3600000) / 60000),

        seconds: Math.floor((diff % 60000) / 1000),

        isTrading: true,

      };

    }

  }



  // Find next session

  for (const session of sessions) {

    if (timeStr < session.start + ':00') {

      const [h, m] = session.start.split(':').map(Number);

      const startDate = new Date(now);

      startDate.setHours(h, m, 0, 0);

      const diff = startDate.getTime() - now.getTime();

      return {

        session: session.name,

        hours: Math.floor(diff / 3600000),

        minutes: Math.floor((diff % 3600000) / 60000),

        seconds: Math.floor((diff % 60000) / 1000),

        isTrading: false,

      };

    }

  }



  return null;

}



// ── Component ──────────────────────────────────────────────────────────────



type Market = 'US' | 'HK';

type CalendarView = 'month' | 'week';



export default function TradingCalendarView() {

  const now = new Date();

  const [year] = useState(now.getFullYear());

  const [month, setMonth] = useState(now.getMonth());

  const [market, setMarket] = useState<Market>('US');

  const [view, setView] = useState<CalendarView>('month');

  const [countdown, setCountdown] = useState<Countdown | null>(null);



  const sessions = market === 'US' ? US_SESSIONS : HK_SESSIONS;

  const holidays = market === 'US' ? US_HOLIDAYS_2026 : HK_HOLIDAYS_2026;

  const currentSession = useMemo(() => getCurrentSession(sessions), [sessions]);



  // Update countdown every second

  useEffect(() => {

    const timer = setInterval(() => {

      setCountdown(computeCountdown(sessions));

    }, 1000);

    return () => clearInterval(timer);

  }, [sessions]);



  // Immediate first update

  useEffect(() => { setCountdown(computeCountdown(sessions)); }, [sessions]);



  const daysInMonth = getDaysInMonth(year, month);

  const firstDay = getFirstDayOfMonth(year, month);

  const todayStr = formatDate(now.getFullYear(), now.getMonth(), now.getDate());



  const weeks: (number | null)[][] = [];

  let week: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) week.push(null);

  for (let d = 1; d <= daysInMonth; d++) {

    week.push(d);

    if (week.length === 7) { weeks.push(week); week = []; }

  }

  if (week.length > 0) weeks.push(week);



  const sessionColor = (session: string) => {

    if (session === 'regular') return 'text-emerald-400';

    if (session === 'pre-market') return 'text-blue-400';

    return 'text-yellow-400';

  };



  const sessionBg = (session: string) => {

    if (session === 'regular') return 'bg-emerald-500/10 border-emerald-500/30';

    if (session === 'pre-market') return 'bg-blue-500/10 border-blue-500/30';

    return 'bg-yellow-500/10 border-yellow-500/30';

  };



  return (

    <div className="space-y-4">

      {/* Header Controls */}

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">

          <button onClick={() => setMonth(m => m === 0 ? 11 : m - 1)} className="text-gray-400 hover:text-white px-2">◀</button>

          <span className="text-white font-medium">{year}年{month + 1}月</span>

          <button onClick={() => setMonth(m => m === 11 ? 0 : m + 1)} className="text-gray-400 hover:text-white px-2">▶</button>

        </div>

        <div className="flex items-center gap-2">

          <select value={market} onChange={(e) => setMarket(e.target.value as Market)}

            className="bg-[#1a1a25] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300">

            <option value="US">美股 (US)</option>

            <option value="HK">港股 (HK)</option>

          </select>

          <div className="flex bg-[#1a1a25] rounded-lg p-0.5">

            <button onClick={() => setView('month')}

              className={`px-3 py-1.5 rounded-md text-sm ${view === 'month' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-400'}`}>

              📅 月

            </button>

            <button onClick={() => setView('week')}

              className={`px-3 py-1.5 rounded-md text-sm ${view === 'week' ? 'bg-[#C9A046]/20 text-[#D4A853]' : 'text-gray-400'}`}>

              📋 周

            </button>

          </div>

        </div>

      </div>



      {/* Session Status Bar */}

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl p-4">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-sm text-gray-400">

              {market === 'US' ? '美股 美东时间 (EST)' : '港股 HKT'}

            </div>

            <div className="flex items-center gap-3 mt-2">

              {sessions.map(s => (

                <span key={s.name} className={`text-xs px-3 py-1 rounded-full border ${currentSession?.name === s.name ? sessionBg(s.name) : 'bg-transparent border-white/10 text-gray-500'}`}>

                  {s.name === 'pre-market' ? '盘前' : s.name === 'regular' ? '盘中' : '盘后'}

                  &nbsp;{s.start}-{s.end}

                  {currentSession?.name === s.name && ' 🔴'}

                </span>

              ))}

            </div>

          </div>

          {countdown && (

            <div className={`text-right ${countdown.isTrading ? sessionColor(countdown.session) : 'text-gray-400'}`}>

              <div className="text-xs text-gray-500 mb-1">

                {countdown.isTrading ? '收盘倒计时' : `距${countdown.session === 'pre-market' ? '盘前' : countdown.session === 'regular' ? '盘中' : '盘后'}开盘`}

              </div>

              <div className="text-2xl font-mono font-bold">

                {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}

              </div>

            </div>

          )}

        </div>

      </div>



      {/* Calendar Grid */}

      <div className="bg-[#1a1a25] border border-white/5 rounded-xl overflow-hidden">

        {/* Day headers */}

        <div className="grid grid-cols-7 border-b border-white/5">

          {['日', '一', '二', '三', '四', '五', '六'].map(d => (

            <div key={d} className="p-3 text-center text-xs text-gray-500 font-medium">{d}</div>

          ))}

        </div>



        {/* Weeks */}

        {weeks.map((week, wi) => (

          <div key={wi} className="grid grid-cols-7 border-b border-white/[0.02] last:border-b-0">

            {week.map((day, di) => {

              if (!day) return <div key={di} className="p-2 min-h-[80px]" />;

              const dateStr = formatDate(year, month, day);

              const isToday = dateStr === todayStr;

              const isWeekendDay = isWeekend(dateStr);

              const isHoliday = !!holidays[dateStr];

              const holidayName = holidays[dateStr];

              const isActive = !isWeekendDay && !isHoliday;



              return (

                <div key={di}

                  className={`p-2 min-h-[80px] border-r border-white/[0.02] last:border-r-0 relative

                    ${isActive ? 'hover:bg-white/[0.03]' : ''}`}>

                  <div className={`text-xs mb-1 flex items-center gap-1

                    ${isToday ? 'text-[#D4A853] font-bold' : 'text-gray-400'}`}>

                    <span className={`w-5 h-5 rounded-full flex items-center justify-center

                      ${isToday ? 'bg-[#C9A046]/20' : ''}`}>

                      {day}

                    </span>

                    {isHoliday && <span className="text-red-400" title={holidayName}>休</span>}

                  </div>

                  {isActive && (

                    <div className="space-y-1 mt-2">

                      {sessions.some(s => s.name === 'pre-market') && (

                        <div className="h-1 rounded bg-blue-500/30" title="盘前" />

                      )}

                      <div className="h-1.5 rounded bg-emerald-500/40" title="盘中 9:30-16:00" />

                      {sessions.some(s => s.name === 'after-hours') && (

                        <div className="h-1 rounded bg-yellow-500/30" title="盘后" />

                      )}

                    </div>

                  )}

                  {holidayName && (

                    <div className="absolute bottom-1 left-1 right-1 text-[9px] text-red-400/70 truncate">

                      {holidayName}

                    </div>

                  )}

                  {isWeekendDay && (

                    <div className="text-[9px] text-gray-600 mt-2">休市</div>

                  )}

                </div>

              );

            })}

          </div>

        ))}

      </div>



      {/* Legend */}

      <div className="flex items-center gap-6 text-xs text-gray-500">

        <div className="flex items-center gap-1.5">

          <div className="w-3 h-3 rounded-full bg-[#C9A046]/30" />

          <span>{t("components.today")}</span>

        </div>

        <div className="flex items-center gap-1.5">

          <div className="w-3 h-3 rounded bg-emerald-500/40" />

          <span>交易时段</span>

        </div>

        <div className="flex items-center gap-1.5">

          <span className="text-red-400">休</span>

          <span>假日</span>

        </div>

        <div className="flex items-center gap-1.5">

          <span className="text-gray-600">休市</span>

          <span>周末</span>

        </div>

      </div>

    </div>

  );

}

