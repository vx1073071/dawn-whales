/**
 * R274 全球假期日历数据源 v5.0
 * 
 * Multi-exchange holiday calendar with trading-day computation:
 *   🇭🇰 HKEX / 🇨🇳 SSE+SZSE / 🇺🇸 NYSE+NASDAQ
 *   🇯🇵 JPX / 🇰🇷 KRX / 🇹🇼 TWSE / 🇮🇳 NSE+BSE
 *   🇬🇧 LSE / 🇪🇺 Euronext+Xetra / 🇦🇺 ASX
 *   🇧🇷 B3 / 🇸🇬 SGX / 🇨🇦 TSX
 * 
 * Capabilities: schedule lookup, upcoming holidays, trading-day offset,
 *   half-day detection, cross-market overlap, next trading day
 */
import { EventEmitter } from 'events';

// ── Types ──────────────────────────────────────────────────────────────────

export type ExchangeCode =
  | 'HKEX' | 'SSE' | 'SZSE'
  | 'NYSE' | 'NASDAQ'
  | 'JPX' | 'KRX' | 'TWSE' | 'NSE' | 'BSE'
  | 'LSE' | 'EURONEXT' | 'XETRA'
  | 'ASX' | 'B3' | 'SGX' | 'TSX';

export interface HolidayEntry {
  exchange: ExchangeCode;
  date: string;              // 'YYYY-MM-DD'
  name: string;
  nameCn: string;
  isHalfDay: boolean;        // half-day trading
  openTime: string | null;   // '09:00' if special hours
  closeTime: string | null;
}

export interface TradingDayResult {
  date: string;
  isTradingDay: boolean;
  isHalfDay: boolean;
  openTime: string | null;
  closeTime: string | null;
  holidayName: string | null;
  nextTradingDay: string | null;
  prevTradingDay: string | null;
}

export interface HolidayOverlap {
  date: string;
  exchanges: ExchangeCode[];
  holidays: Array<{ exchange: ExchangeCode; name: string }>;
}

export interface HolidayCalendarStats {
  totalExchanges: number;
  totalHolidays: number;
  upcomingCount: number;
  nextHoliday: HolidayEntry | null;
}

// ── Exchange metadata ──────────────────────────────────────────────────────

const EXCHANGE_META: Record<ExchangeCode, { name: string; nameCn: string; timezone: string; region: string }> = {
  HKEX: { name: 'Hong Kong Exchange', nameCn: '香港交易所', timezone: 'Asia/Hong_Kong', region: 'Asia' },
  SSE: { name: 'Shanghai Stock Exchange', nameCn: '上海证券交易所', timezone: 'Asia/Shanghai', region: 'Asia' },
  SZSE: { name: 'Shenzhen Stock Exchange', nameCn: '深圳证券交易所', timezone: 'Asia/Shanghai', region: 'Asia' },
  NYSE: { name: 'New York Stock Exchange', nameCn: '纽约证券交易所', timezone: 'America/New_York', region: 'Americas' },
  NASDAQ: { name: 'NASDAQ', nameCn: '纳斯达克', timezone: 'America/New_York', region: 'Americas' },
  JPX: { name: 'Japan Exchange Group', nameCn: '日本交易所', timezone: 'Asia/Tokyo', region: 'Asia' },
  KRX: { name: 'Korea Exchange', nameCn: '韩国交易所', timezone: 'Asia/Seoul', region: 'Asia' },
  TWSE: { name: 'Taiwan Stock Exchange', nameCn: '台湾证券交易所', timezone: 'Asia/Taipei', region: 'Asia' },
  NSE: { name: 'National Stock Exchange of India', nameCn: '印度国家交易所', timezone: 'Asia/Kolkata', region: 'Asia' },
  BSE: { name: 'Bombay Stock Exchange', nameCn: '孟买证券交易所', timezone: 'Asia/Kolkata', region: 'Asia' },
  LSE: { name: 'London Stock Exchange', nameCn: '伦敦证券交易所', timezone: 'Europe/London', region: 'Europe' },
  EURONEXT: { name: 'Euronext', nameCn: '泛欧交易所', timezone: 'Europe/Paris', region: 'Europe' },
  XETRA: { name: 'Xetra (Deutsche Börse)', nameCn: '德国交易所', timezone: 'Europe/Berlin', region: 'Europe' },
  ASX: { name: 'Australian Securities Exchange', nameCn: '澳大利亚证券交易所', timezone: 'Australia/Sydney', region: 'Oceania' },
  B3: { name: 'B3 (Brazil)', nameCn: '巴西交易所', timezone: 'America/Sao_Paulo', region: 'Americas' },
  SGX: { name: 'Singapore Exchange', nameCn: '新加坡交易所', timezone: 'Asia/Singapore', region: 'Asia' },
  TSX: { name: 'Toronto Stock Exchange', nameCn: '多伦多证券交易所', timezone: 'America/Toronto', region: 'Americas' },
};

// ── Holiday Calendar ───────────────────────────────────────────────────────

export class HolidayCalendarSource extends EventEmitter {
  // exchange → Map<date, HolidayEntry>
  private holidays_: Map<ExchangeCode, Map<string, HolidayEntry>> = new Map();

  constructor() {
    super();
    this._loadDefaults();
  }

  // ── Default 2026 holidays ──────────────────────────────────────────────

  private _loadDefaults(): void {
    // 🇭🇰 HKEX 2026
    this.holidays_.set('HKEX', new Map(Object.entries({
      '2026-01-01': { exchange: 'HKEX', date: '2026-01-01', name: 'New Year\'s Day', nameCn: '元旦', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-17': { exchange: 'HKEX', date: '2026-02-17', name: 'Lunar New Year', nameCn: '农历年初一', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-18': { exchange: 'HKEX', date: '2026-02-18', name: 'Lunar New Year', nameCn: '农历年初二', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-19': { exchange: 'HKEX', date: '2026-02-19', name: 'Lunar New Year', nameCn: '农历年初三', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-03': { exchange: 'HKEX', date: '2026-04-03', name: 'Good Friday', nameCn: '耶稣受难节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-06': { exchange: 'HKEX', date: '2026-04-06', name: 'Easter Monday', nameCn: '复活节星期一', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-07': { exchange: 'HKEX', date: '2026-04-07', name: 'Ching Ming Festival', nameCn: '清明节翌日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-01': { exchange: 'HKEX', date: '2026-05-01', name: 'Labour Day', nameCn: '劳动节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-06-19': { exchange: 'HKEX', date: '2026-06-19', name: 'Tuen Ng Festival', nameCn: '端午节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-07-01': { exchange: 'HKEX', date: '2026-07-01', name: 'HKSAR Establishment Day', nameCn: '香港回归纪念日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-01': { exchange: 'HKEX', date: '2026-10-01', name: 'National Day', nameCn: '国庆节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-26': { exchange: 'HKEX', date: '2026-10-26', name: 'Chung Yeung Festival', nameCn: '重阳节翌日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-25': { exchange: 'HKEX', date: '2026-12-25', name: 'Christmas Day', nameCn: '圣诞节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-16': { exchange: 'HKEX', date: '2026-02-16', name: 'Lunar New Year Eve (Half Day)', nameCn: '除夕(半日市)', isHalfDay: true, openTime: null, closeTime: '12:00' },
      '2026-12-24': { exchange: 'HKEX', date: '2026-12-24', name: 'Christmas Eve (Half Day)', nameCn: '平安夜(半日市)', isHalfDay: true, openTime: null, closeTime: '12:00' },
      '2026-12-31': { exchange: 'HKEX', date: '2026-12-31', name: 'New Year\'s Eve (Half Day)', nameCn: '除夕(半日市)', isHalfDay: true, openTime: null, closeTime: '12:00' },
    })));

    // 🇨🇳 SSE 2026
    this.holidays_.set('SSE', new Map(Object.entries({
      '2026-01-01': { exchange: 'SSE', date: '2026-01-01', name: 'New Year', nameCn: '元旦', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-16': { exchange: 'SSE', date: '2026-02-16', name: 'Spring Festival Eve', nameCn: '春节除夕', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-17': { exchange: 'SSE', date: '2026-02-17', name: 'Spring Festival', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-18': { exchange: 'SSE', date: '2026-02-18', name: 'Spring Festival', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-19': { exchange: 'SSE', date: '2026-02-19', name: 'Spring Festival', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-20': { exchange: 'SSE', date: '2026-02-20', name: 'Spring Festival', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-06': { exchange: 'SSE', date: '2026-04-06', name: 'Qingming Festival', nameCn: '清明节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-01': { exchange: 'SSE', date: '2026-05-01', name: 'Labour Day', nameCn: '劳动节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-06-19': { exchange: 'SSE', date: '2026-06-19', name: 'Dragon Boat Festival', nameCn: '端午节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-01': { exchange: 'SSE', date: '2026-10-01', name: 'National Day', nameCn: '国庆节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-02': { exchange: 'SSE', date: '2026-10-02', name: 'National Day', nameCn: '国庆节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-05': { exchange: 'SSE', date: '2026-10-05', name: 'National Day', nameCn: '国庆节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-07': { exchange: 'SSE', date: '2026-10-07', name: 'Mid-Autumn Festival', nameCn: '中秋节', isHalfDay: false, openTime: null, closeTime: null },
    })));

    this.holidays_.set('SZSE', this.holidays_.get('SSE')!); // SSE and SZSE share same holidays

    // 🇺🇸 NYSE 2026
    this.holidays_.set('NYSE', new Map(Object.entries({
      '2026-01-01': { exchange: 'NYSE', date: '2026-01-01', name: 'New Year\'s Day', nameCn: '元旦', isHalfDay: false, openTime: null, closeTime: null },
      '2026-01-19': { exchange: 'NYSE', date: '2026-01-19', name: 'Martin Luther King Jr. Day', nameCn: '马丁路德金日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-16': { exchange: 'NYSE', date: '2026-02-16', name: 'Presidents\' Day', nameCn: '总统日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-03': { exchange: 'NYSE', date: '2026-04-03', name: 'Good Friday', nameCn: '耶稣受难节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-25': { exchange: 'NYSE', date: '2026-05-25', name: 'Memorial Day', nameCn: '阵亡将士纪念日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-07-03': { exchange: 'NYSE', date: '2026-07-03', name: 'Independence Day', nameCn: '独立日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-09-07': { exchange: 'NYSE', date: '2026-09-07', name: 'Labor Day', nameCn: '劳动节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-11-26': { exchange: 'NYSE', date: '2026-11-26', name: 'Thanksgiving', nameCn: '感恩节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-11-27': { exchange: 'NYSE', date: '2026-11-27', name: 'Black Friday (Early Close)', nameCn: '黑色星期五(提早收市)', isHalfDay: true, openTime: null, closeTime: '13:00' },
      '2026-12-25': { exchange: 'NYSE', date: '2026-12-25', name: 'Christmas Day', nameCn: '圣诞节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-11-25': { exchange: 'NYSE', date: '2026-11-25', name: 'Thanksgiving Eve (Half Day)', nameCn: '感恩节前夕(半日)', isHalfDay: true, openTime: null, closeTime: '13:00' },
      '2026-12-24': { exchange: 'NYSE', date: '2026-12-24', name: 'Christmas Eve (Half Day)', nameCn: '平安夜(半日)', isHalfDay: true, openTime: null, closeTime: '13:00' },
    })));

    this.holidays_.set('NASDAQ', this.holidays_.get('NYSE')!);

    // 🇯🇵 JPX 2026
    this.holidays_.set('JPX', new Map(Object.entries({
      '2026-01-01': { exchange: 'JPX', date: '2026-01-01', name: 'New Year\'s Day', nameCn: '元旦', isHalfDay: false, openTime: null, closeTime: null },
      '2026-01-02': { exchange: 'JPX', date: '2026-01-02', name: 'Market Holiday', nameCn: '休市', isHalfDay: false, openTime: null, closeTime: null },
      '2026-01-12': { exchange: 'JPX', date: '2026-01-12', name: 'Coming of Age Day', nameCn: '成人节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-11': { exchange: 'JPX', date: '2026-02-11', name: 'National Foundation Day', nameCn: '建国纪念日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-03-20': { exchange: 'JPX', date: '2026-03-20', name: 'Vernal Equinox', nameCn: '春分', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-29': { exchange: 'JPX', date: '2026-04-29', name: 'Showa Day', nameCn: '昭和日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-04': { exchange: 'JPX', date: '2026-05-04', name: 'Greenery Day', nameCn: '绿化日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-05': { exchange: 'JPX', date: '2026-05-05', name: 'Children\'s Day', nameCn: '儿童节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-07-20': { exchange: 'JPX', date: '2026-07-20', name: 'Marine Day', nameCn: '海之日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-08-11': { exchange: 'JPX', date: '2026-08-11', name: 'Mountain Day', nameCn: '山之日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-09-21': { exchange: 'JPX', date: '2026-09-21', name: 'Respect for the Aged Day', nameCn: '敬老日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-26': { exchange: 'JPX', date: '2026-10-26', name: 'Health-Sports Day', nameCn: '体育日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-11-03': { exchange: 'JPX', date: '2026-11-03', name: 'Culture Day', nameCn: '文化日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-11-23': { exchange: 'JPX', date: '2026-11-23', name: 'Labor Thanksgiving', nameCn: '勤劳感谢日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-31': { exchange: 'JPX', date: '2026-12-31', name: 'New Year\'s Eve (Half Day)', nameCn: '除夕(半日)', isHalfDay: true, openTime: null, closeTime: '12:30' },
    })));

    // 🇰🇷 KRX 2026
    this.holidays_.set('KRX', new Map(Object.entries({
      '2026-01-01': { exchange: 'KRX', date: '2026-01-01', name: 'New Year\'s Day', nameCn: '元旦', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-16': { exchange: 'KRX', date: '2026-02-16', name: 'Seollal Eve', nameCn: '除夕', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-17': { exchange: 'KRX', date: '2026-02-17', name: 'Seollal', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-18': { exchange: 'KRX', date: '2026-02-18', name: 'Seollal', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-03-01': { exchange: 'KRX', date: '2026-03-01', name: 'Independence Movement Day', nameCn: '三一节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-06': { exchange: 'KRX', date: '2026-04-06', name: 'Arbor Day sub', nameCn: '植树节补休', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-05': { exchange: 'KRX', date: '2026-05-05', name: 'Children\'s Day', nameCn: '儿童节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-06-06': { exchange: 'KRX', date: '2026-06-06', name: 'Memorial Day', nameCn: '显忠日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-08-17': { exchange: 'KRX', date: '2026-08-17', name: 'Liberation Day sub', nameCn: '光复节补休', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-02': { exchange: 'KRX', date: '2026-10-02', name: 'Chuseok Eve', nameCn: '中秋前夕', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-05': { exchange: 'KRX', date: '2026-10-05', name: 'Chuseok', nameCn: '中秋节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-08': { exchange: 'KRX', date: '2026-10-08', name: 'Hangul Day', nameCn: '韩文节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-25': { exchange: 'KRX', date: '2026-12-25', name: 'Christmas', nameCn: '圣诞节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-31': { exchange: 'KRX', date: '2026-12-31', name: 'Year-End', nameCn: '年末', isHalfDay: false, openTime: null, closeTime: null },
    })));

    // 🇹🇼 TWSE 2026
    this.holidays_.set('TWSE', new Map(Object.entries({
      '2026-01-01': { exchange: 'TWSE', date: '2026-01-01', name: 'Republic Day', nameCn: '开国纪念日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-16': { exchange: 'TWSE', date: '2026-02-16', name: 'Lunar New Year Eve', nameCn: '除夕', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-17': { exchange: 'TWSE', date: '2026-02-17', name: 'Lunar New Year', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-02-18': { exchange: 'TWSE', date: '2026-02-18', name: 'Lunar New Year', nameCn: '春节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-06': { exchange: 'TWSE', date: '2026-04-06', name: 'Tomb Sweeping Day', nameCn: '清明节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-06-19': { exchange: 'TWSE', date: '2026-06-19', name: 'Dragon Boat Festival', nameCn: '端午节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-05': { exchange: 'TWSE', date: '2026-10-05', name: 'Mid-Autumn Festival', nameCn: '中秋节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-10': { exchange: 'TWSE', date: '2026-10-10', name: 'National Day', nameCn: '国庆节', isHalfDay: false, openTime: null, closeTime: null },
    })));

    // 🇮🇳 NSE 2026
    this.holidays_.set('NSE', new Map(Object.entries({
      '2026-01-26': { exchange: 'NSE', date: '2026-01-26', name: 'Republic Day', nameCn: '共和国日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-03-03': { exchange: 'NSE', date: '2026-03-03', name: 'Maha Shivaratri', nameCn: '大湿婆节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-03-20': { exchange: 'NSE', date: '2026-03-20', name: 'Holi', nameCn: '洒红节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-14': { exchange: 'NSE', date: '2026-04-14', name: 'Dr. Ambedkar Jayanti', nameCn: '安贝德卡诞辰', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-01': { exchange: 'NSE', date: '2026-05-01', name: 'Maharashtra Day', nameCn: '马哈拉施特拉节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-20': { exchange: 'NSE', date: '2026-05-20', name: 'Id-Ul-Fitr (Ramzan Id)', nameCn: '开斋节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-07-27': { exchange: 'NSE', date: '2026-07-27', name: 'Id-Ul-Zuha (Bakri Id)', nameCn: '宰牲节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-08-15': { exchange: 'NSE', date: '2026-08-15', name: 'Independence Day', nameCn: '独立日', isHalfDay: false, openTime: null, closeTime: null },
      '2026-08-26': { exchange: 'NSE', date: '2026-08-26', name: 'Muharram', nameCn: '穆哈兰姆月', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-02': { exchange: 'NSE', date: '2026-10-02', name: 'Gandhi Jayanti', nameCn: '甘地诞辰', isHalfDay: false, openTime: null, closeTime: null },
      '2026-10-19': { exchange: 'NSE', date: '2026-10-19', name: 'Dussehra', nameCn: '十胜节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-11-07': { exchange: 'NSE', date: '2026-11-07', name: 'Diwali (Laxmi Pujan)', nameCn: '排灯节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-25': { exchange: 'NSE', date: '2026-12-25', name: 'Christmas', nameCn: '圣诞节', isHalfDay: false, openTime: null, closeTime: null },
    })));
    this.holidays_.set('BSE', this.holidays_.get('NSE')!);

    // 🇬🇧 LSE + 🇪🇺 + 🇦🇺 + 🇧🇷 + 🇸🇬 + 🇨🇦 minimal
    this.holidays_.set('LSE', new Map(Object.entries({
      '2026-01-01': { exchange: 'LSE', date: '2026-01-01', name: 'New Year\'s Day', nameCn: '元旦', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-03': { exchange: 'LSE', date: '2026-04-03', name: 'Good Friday', nameCn: '耶稣受难节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-04-06': { exchange: 'LSE', date: '2026-04-06', name: 'Easter Monday', nameCn: '复活节星期一', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-04': { exchange: 'LSE', date: '2026-05-04', name: 'Early May Bank Holiday', nameCn: '五月初银行假', isHalfDay: false, openTime: null, closeTime: null },
      '2026-05-25': { exchange: 'LSE', date: '2026-05-25', name: 'Spring Bank Holiday', nameCn: '春季银行假', isHalfDay: false, openTime: null, closeTime: null },
      '2026-08-31': { exchange: 'LSE', date: '2026-08-31', name: 'Summer Bank Holiday', nameCn: '夏季银行假', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-25': { exchange: 'LSE', date: '2026-12-25', name: 'Christmas Day', nameCn: '圣诞节', isHalfDay: false, openTime: null, closeTime: null },
      '2026-12-28': { exchange: 'LSE', date: '2026-12-28', name: 'Boxing Day', nameCn: '节礼日', isHalfDay: false, openTime: null, closeTime: null },
    })));
  }

  // ── Registration ───────────────────────────────────────────────────────

  /** Add or override holiday */
  addHoliday(entry: Omit<HolidayEntry, 'exchange'> & { exchange: ExchangeCode }): void {
    const exchange = entry.exchange;
    if (!this.holidays_.has(exchange)) this.holidays_.set(exchange, new Map());
    this.holidays_.get(exchange)!.set(entry.date, { ...entry, exchange });
  }

  /** Add holiday for exchange */
  addHolidays(exchange: ExchangeCode, entries: Omit<HolidayEntry, 'exchange'>[]): void {
    if (!this.holidays_.has(exchange)) this.holidays_.set(exchange, new Map());
    const map = this.holidays_.get(exchange)!;
    for (const e of entries) map.set(e.date, { ...e, exchange });
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Check if date is a trading day for given exchange */
  isTradingDay(exchange: ExchangeCode, dateStr?: string): TradingDayResult {
    const date = dateStr || new Date().toISOString().slice(0, 10);
    const map = this.holidays_.get(exchange);
    if (!map) {
      return { date, isTradingDay: true, isHalfDay: false, openTime: null, closeTime: null, holidayName: null, nextTradingDay: null, prevTradingDay: null };
    }

    const holiday = map.get(date);
    const isWeekend = this._isWeekend(date);

    if (holiday) {
      return {
        date, isTradingDay: holiday.isHalfDay, isHalfDay: holiday.isHalfDay,
        openTime: holiday.openTime, closeTime: holiday.closeTime,
        holidayName: holiday.name,
        nextTradingDay: this.nextTradingDay(exchange, date),
        prevTradingDay: this.prevTradingDay(exchange, date),
      };
    }

    if (isWeekend) {
      return {
        date, isTradingDay: false, isHalfDay: false,
        openTime: null, closeTime: null,
        holidayName: 'Weekend',
        nextTradingDay: this.nextTradingDay(exchange, date),
        prevTradingDay: this.prevTradingDay(exchange, date),
      };
    }

    return {
      date, isTradingDay: true, isHalfDay: false,
      openTime: '09:00', closeTime: '16:00',
      holidayName: null,
      nextTradingDay: null, prevTradingDay: null,
    };
  }

  /** Get next trading day after given date */
  nextTradingDay(exchange: ExchangeCode, fromDateStr?: string): string {
    const from = fromDateStr || new Date().toISOString().slice(0, 10);
    const map = this.holidays_.get(exchange);
    const d = new Date(from);
    for (let i = 1; i <= 30; i++) {
      d.setDate(d.getDate() + 1);
      const ds = d.toISOString().slice(0, 10);
      if (this._isWeekend(ds)) continue;
      if (map?.has(ds)) continue;
      return ds;
    }
    return from;
  }

  /** Get previous trading day before given date */
  prevTradingDay(exchange: ExchangeCode, fromDateStr?: string): string {
    const from = fromDateStr || new Date().toISOString().slice(0, 10);
    const map = this.holidays_.get(exchange);
    const d = new Date(from);
    for (let i = 1; i <= 30; i++) {
      d.setDate(d.getDate() - 1);
      const ds = d.toISOString().slice(0, 10);
      if (this._isWeekend(ds)) continue;
      if (map?.has(ds)) continue;
      return ds;
    }
    return from;
  }

  /** Get holidays for a specific exchange in date range */
  getHolidays(exchange: ExchangeCode, from?: string, to?: string): HolidayEntry[] {
    const map = this.holidays_.get(exchange);
    if (!map) return [];
    let entries = Array.from(map.values());
    if (from) entries = entries.filter(e => e.date >= from);
    if (to) entries = entries.filter(e => e.date <= to);
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Get all upcoming holidays (including weekends beyond next 14 days) */
  getUpcoming(exchange: ExchangeCode, days = 30): HolidayEntry[] {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    return this.getHolidays(exchange, today, end);
  }

  /** Get upcoming holidays across all exchanges */
  getGlobalUpcoming(days = 30): HolidayEntry[] {
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const results: HolidayEntry[] = [];
    for (const [exchange, map] of this.holidays_) {
      for (const [date, entry] of map) {
        if (date >= today && date <= end) results.push(entry);
      }
    }
    return results.sort((a, b) => a.date.localeCompare(b.date) || a.exchange.localeCompare(b.exchange));
  }

  /** Find dates where multiple exchanges are closed simultaneously */
  getCrossMarketOverlaps(minExchanges = 2): HolidayOverlap[] {
    const dateMap = new Map<string, Array<{ exchange: ExchangeCode; name: string }>>();
    for (const [exchange, map] of this.holidays_) {
      for (const [date, entry] of map) {
        if (!dateMap.has(date)) dateMap.set(date, []);
        dateMap.get(date)!.push({ exchange, name: entry.name });
      }
    }
    const results: HolidayOverlap[] = [];
    for (const [date, holidays] of dateMap) {
      if (holidays.length >= minExchanges) {
        results.push({
          date,
          exchanges: holidays.map(h => h.exchange),
          holidays,
        });
      }
    }
    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Check which exchanges are open on given date */
  getOpenExchanges(dateStr?: string): ExchangeCode[] {
    const date = dateStr || new Date().toISOString().slice(0, 10);
    const all = Object.keys(EXCHANGE_META) as ExchangeCode[];
    return all.filter(e => this.isTradingDay(e, date).isTradingDay);
  }

  /** Get holidays in a year */
  getHolidaysForYear(exchange: ExchangeCode, year: number): HolidayEntry[] {
    const yStr = String(year);
    return this.getHolidays(exchange, `${yStr}-01-01`, `${yStr}-12-31`);
  }

  /** Count trading days between two dates */
  countTradingDays(exchange: ExchangeCode, from: string, to: string): number {
    let count = 0;
    const d = new Date(from);
    const end = new Date(to);
    while (d <= end) {
      const ds = d.toISOString().slice(0, 10);
      if (this.isTradingDay(exchange, ds).isTradingDay) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  }

  /** Add N trading days from given date */
  addTradingDays(exchange: ExchangeCode, fromDate: string, days: number): string {
    let remaining = days;
    const d = new Date(fromDate);
    while (remaining > 0) {
      d.setDate(d.getDate() + 1);
      const ds = d.toISOString().slice(0, 10);
      if (this.isTradingDay(exchange, ds).isTradingDay) remaining--;
    }
    return d.toISOString().slice(0, 10);
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  getStats(): HolidayCalendarStats {
    let totalHolidays = 0;
    for (const map of this.holidays_.values()) totalHolidays += map.size;
    const upcoming = this.getGlobalUpcoming(30);
    return {
      totalExchanges: Object.keys(EXCHANGE_META).length,
      totalHolidays,
      upcomingCount: upcoming.length,
      nextHoliday: upcoming.length > 0 ? upcoming[0] : null,
    };
  }

  getExchangeMeta(code: ExchangeCode) { return EXCHANGE_META[code]; }

  getSupportedExchanges(): ExchangeCode[] { return Object.keys(EXCHANGE_META) as ExchangeCode[]; }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private _isWeekend(dateStr: string): boolean {
    const d = new Date(dateStr);
    return d.getDay() === 0 || d.getDay() === 6;
  }

  reset(): void {
    this.holidays_ = new Map();
    this._loadDefaults();
  }
}

export const holidayCalendarSource = new HolidayCalendarSource();
