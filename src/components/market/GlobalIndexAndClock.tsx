// @ts-nocheck
// QUANT MOO — 全球指数条 + 多市场时钟 (Global Index Ticker + Multi-Market Clock)
// R255 ML#2 UI-05 (4h) + ML#3 UI-06 (3h) — 7小时合并组件

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tag, Space, Typography, Row, Col, Timeline, Tooltip,
  Statistic, Badge, Segmented, Select, Progress, Divider
} from 'antd';
import {
  GlobalOutlined, ClockCircleOutlined, CaretUpOutlined, CaretDownOutlined,
  MinusOutlined, StockOutlined, DollarOutlined, ThunderboltOutlined,
  InfoCircleOutlined, SunOutlined, MoonOutlined, SwapOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ── Types ──
interface IndexQuote {
  id: string;
  name: string;
  market: string;
  marketCN: string;
  currency: string;
  price: number;
  change: number;
  changePct: number;
  flag: string;
  volume?: number;
  status: 'open' | 'pre' | 'post' | 'closed' | 'lunch_break';
  timezone: string;
  openTime: string;
  closeTime: string;
  lunchStart?: string;
  lunchEnd?: string;
}

interface MarketSession {
  market: string;
  marketCN: string;
  timezone: string;
  utcOffset: number;
  status: 'open' | 'pre' | 'lunch' | 'post' | 'closed';
  openTime: string;
  closeTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  currentTime: Date;
  nextEvent: string;
  nextEventTime: Date;
  progressPct: number; // session progress 0-100
  isDST: boolean;
}

// ── Mock Data ──
const mockIndexQuotes: IndexQuote[] = [
  // ── 股票交易所 25个 ──
  // 美洲 (4)
  { id: 'spx', name: 'S&P 500', market: 'US', marketCN: '美股', currency: 'USD', price: 6047.82, change: 32.15, changePct: 0.53, flag: '🇺🇸', volume: 2.1e9, status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'ndx', name: 'NASDAQ 100', market: 'US', marketCN: '美股', currency: 'USD', price: 21634.50, change: 142.30, changePct: 0.66, flag: '🇺🇸', volume: 3.8e9, status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'dji', name: 'DJIA', market: 'US', marketCN: '美股', currency: 'USD', price: 43397.20, change: -18.40, changePct: -0.04, flag: '🇺🇸', volume: 0.98e9, status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'vix', name: 'VIX', market: 'US', marketCN: '美股', currency: 'USD', price: 14.52, change: -0.83, changePct: -5.41, flag: '🇺🇸', status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:15' },
  { id: 'rut', name: 'Russell 2000', market: 'US', marketCN: '美股', currency: 'USD', price: 2218.30, change: 8.50, changePct: 0.38, flag: '🇺🇸', status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:00' },
  { id: 'tsx', name: 'S&P/TSX 60', market: 'CA', marketCN: '加拿大', currency: 'CAD', price: 1512.40, change: 12.30, changePct: 0.82, flag: '🇨🇦', status: 'open', timezone: 'America/Toronto', openTime: '09:30', closeTime: '16:00' },
  { id: 'bovespa', name: 'Bovespa', market: 'BR', marketCN: '巴西', currency: 'BRL', price: 128500, change: -850, changePct: -0.66, flag: '🇧🇷', status: 'closed', timezone: 'America/Sao_Paulo', openTime: '10:00', closeTime: '17:00' },

  // 亚太 (9)
  { id: 'hsi', name: '恒生指数', market: 'HK', marketCN: '港股', currency: 'HKD', price: 24580.90, change: -312.60, changePct: -1.25, flag: '🇭🇰', status: 'closed', timezone: 'Asia/Hong_Kong', openTime: '09:30', closeTime: '16:00', lunchStart: '12:00', lunchEnd: '13:00' },
  { id: 'hscei', name: '国企指数', market: 'HK', marketCN: '港股', currency: 'HKD', price: 8820.50, change: -95.30, changePct: -1.07, flag: '🇭🇰', status: 'closed', timezone: 'Asia/Hong_Kong', openTime: '09:30', closeTime: '16:00' },
  { id: 'hstech', name: '恒生科技', market: 'HK', marketCN: '港股', currency: 'HKD', price: 5520.30, change: -85.40, changePct: -1.52, flag: '🇭🇰', status: 'closed', timezone: 'Asia/Hong_Kong', openTime: '09:30', closeTime: '16:00' },
  { id: 'shcomp', name: '上证指数', market: 'CN', marketCN: 'A股', currency: 'CNY', price: 3420.50, change: 18.30, changePct: 0.54, flag: '🇨🇳', status: 'closed', timezone: 'Asia/Shanghai', openTime: '09:30', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '13:00' },
  { id: 'szcomp', name: '深证成指', market: 'CN', marketCN: 'A股', currency: 'CNY', price: 11850.20, change: 45.60, changePct: 0.39, flag: '🇨🇳', status: 'closed', timezone: 'Asia/Shanghai', openTime: '09:30', closeTime: '15:00' },
  { id: 'csi300', name: '沪深300', market: 'CN', marketCN: 'A股', currency: 'CNY', price: 4210.80, change: 22.10, changePct: 0.53, flag: '🇨🇳', status: 'closed', timezone: 'Asia/Shanghai', openTime: '09:30', closeTime: '15:00' },
  { id: 'chinext', name: '创业板指', market: 'CN', marketCN: 'A股', currency: 'CNY', price: 2450.30, change: 35.20, changePct: 1.46, flag: '🇨🇳', status: 'closed', timezone: 'Asia/Shanghai', openTime: '09:30', closeTime: '15:00' },
  { id: 'n225', name: '日経225', market: 'JP', marketCN: '日股', currency: 'JPY', price: 41532.00, change: 285.00, changePct: 0.69, flag: '🇯🇵', status: 'closed', timezone: 'Asia/Tokyo', openTime: '09:00', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '12:30' },
  { id: 'topx', name: 'TOPIX', market: 'JP', marketCN: '日股', currency: 'JPY', price: 2830.50, change: 18.20, changePct: 0.65, flag: '🇯🇵', status: 'closed', timezone: 'Asia/Tokyo', openTime: '09:00', closeTime: '15:00' },
  { id: 'kospi', name: 'KOSPI', market: 'KR', marketCN: '韩国', currency: 'KRW', price: 2820.30, change: -12.40, changePct: -0.44, flag: '🇰🇷', status: 'closed', timezone: 'Asia/Seoul', openTime: '09:00', closeTime: '15:30' },
  { id: 'twse', name: 'TWSE 台湾加权', market: 'TW', marketCN: '台湾', currency: 'TWD', price: 18650.20, change: 85.30, changePct: 0.46, flag: '🇹🇼', status: 'closed', timezone: 'Asia/Taipei', openTime: '09:00', closeTime: '13:30' },
  { id: 'sti', name: 'STI', market: 'SG', marketCN: '新加坡', currency: 'SGD', price: 3420.80, change: 18.50, changePct: 0.54, flag: '🇸🇬', status: 'closed', timezone: 'Asia/Singapore', openTime: '09:00', closeTime: '17:00' },
  { id: 'asx200', name: 'ASX 200', market: 'AU', marketCN: '澳洲', currency: 'AUD', price: 7850.40, change: 42.30, changePct: 0.54, flag: '🇦🇺', status: 'closed', timezone: 'Australia/Sydney', openTime: '10:00', closeTime: '16:00' },
  { id: 'nifty50', name: 'Nifty 50', market: 'IN', marketCN: '印度', currency: 'INR', price: 24180.50, change: 165.20, changePct: 0.69, flag: '🇮🇳', status: 'closed', timezone: 'Asia/Kolkata', openTime: '09:15', closeTime: '15:30' },
  { id: 'sensex', name: 'SENSEX', market: 'IN', marketCN: '印度', currency: 'INR', price: 79320.40, change: 520.30, changePct: 0.66, flag: '🇮🇳', status: 'closed', timezone: 'Asia/Kolkata', openTime: '09:15', closeTime: '15:30' },
  { id: 'jci', name: '雅加达综指', market: 'ID', marketCN: '印尼', currency: 'IDR', price: 7280.50, change: -45.20, changePct: -0.62, flag: '🇮🇩', status: 'closed', timezone: 'Asia/Jakarta', openTime: '09:00', closeTime: '15:00' },
  { id: 'set', name: 'SET', market: 'TH', marketCN: '泰国', currency: 'THB', price: 1520.80, change: 8.30, changePct: 0.55, flag: '🇹🇭', status: 'closed', timezone: 'Asia/Bangkok', openTime: '10:00', closeTime: '16:30' },
  { id: 'vnindex', name: 'VN-Index', market: 'VN', marketCN: '越南', currency: 'VND', price: 1285.30, change: 12.40, changePct: 0.98, flag: '🇻🇳', status: 'closed', timezone: 'Asia/Ho_Chi_Minh', openTime: '09:00', closeTime: '14:45' },
  { id: 'klci', name: 'KLCI', market: 'MY', marketCN: '马来西亚', currency: 'MYR', price: 1580.30, change: -8.20, changePct: -0.52, flag: '🇲🇾', status: 'closed', timezone: 'Asia/Kuala_Lumpur', openTime: '09:00', closeTime: '17:00' },
  { id: 'psei', name: 'PSEi', market: 'PH', marketCN: '菲律宾', currency: 'PHP', price: 6720.40, change: 35.60, changePct: 0.53, flag: '🇵🇭', status: 'closed', timezone: 'Asia/Manila', openTime: '09:30', closeTime: '15:00' },

  // 欧洲+中东+非洲 (5)
  { id: 'ftse', name: 'FTSE 100', market: 'UK', marketCN: '英股', currency: 'GBP', price: 8420.50, change: -28.30, changePct: -0.34, flag: '🇬🇧', status: 'closed', timezone: 'Europe/London', openTime: '08:00', closeTime: '16:30' },
  { id: 'dax', name: 'DAX 40', market: 'DE', marketCN: '德股', currency: 'EUR', price: 18680.00, change: 52.40, changePct: 0.28, flag: '🇩🇪', status: 'closed', timezone: 'Europe/Berlin', openTime: '09:00', closeTime: '17:30' },
  { id: 'cac40', name: 'CAC 40', market: 'FR', marketCN: '法股', currency: 'EUR', price: 8120.50, change: -28.60, changePct: -0.35, flag: '🇫🇷', status: 'closed', timezone: 'Europe/Paris', openTime: '09:00', closeTime: '17:30' },
  { id: 'aex', name: 'AEX 25', market: 'NL', marketCN: '荷兰', currency: 'EUR', price: 892.30, change: 5.20, changePct: 0.59, flag: '🇳🇱', status: 'closed', timezone: 'Europe/Amsterdam', openTime: '09:00', closeTime: '17:30' },
  { id: 'smi', name: 'SMI', market: 'CH', marketCN: '瑞士', currency: 'CHF', price: 11980.20, change: 48.50, changePct: 0.41, flag: '🇨🇭', status: 'closed', timezone: 'Europe/Zurich', openTime: '09:00', closeTime: '17:20' },
  { id: 'tasi', name: 'TASI', market: 'SA', marketCN: '沙特', currency: 'SAR', price: 12150.80, change: 85.30, changePct: 0.71, flag: '🇸🇦', status: 'closed', timezone: 'Asia/Riyadh', openTime: '10:00', closeTime: '15:00' },
  { id: 'adx', name: 'ADX', market: 'AE', marketCN: '阿联酋', currency: 'AED', price: 9420.50, change: 32.10, changePct: 0.34, flag: '🇦🇪', status: 'closed', timezone: 'Asia/Dubai', openTime: '10:00', closeTime: '15:00' },
  { id: 'ta35', name: 'TA-35', market: 'IL', marketCN: '以色列', currency: 'ILS', price: 2180.30, change: -15.40, changePct: -0.70, flag: '🇮🇱', status: 'closed', timezone: 'Asia/Jerusalem', openTime: '09:30', closeTime: '16:30' },
  { id: 'jse', name: 'JSE Top40', market: 'ZA', marketCN: '南非', currency: 'ZAR', price: 68520, change: 420, changePct: 0.62, flag: '🇿🇦', status: 'closed', timezone: 'Africa/Johannesburg', openTime: '09:00', closeTime: '17:00' },

  // ── 加密货币 (Binance WS) ──
  { id: 'btc', name: 'Bitcoin', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 98450.00, change: 1250.00, changePct: 1.29, flag: '₿', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'eth', name: 'Ethereum', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 4520.00, change: 95.00, changePct: 2.15, flag: 'Ξ', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'sol', name: 'Solana', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 285.40, change: 12.30, changePct: 4.51, flag: '◎', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'bnb', name: 'BNB', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 685.20, change: -8.40, changePct: -1.21, flag: '◆', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'xrp', name: 'XRP', market: 'CRYPTO', marketCN: '加密', currency: 'USD', price: 0.85, change: 0.02, changePct: 2.41, flag: '✕', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },

  // ── 商品期货 ──
  { id: 'gold', name: 'Gold', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 2685.30, change: 18.50, changePct: 0.69, flag: '🥇', status: 'open', timezone: 'America/New_York', openTime: '18:00', closeTime: '17:00' },
  { id: 'oil', name: 'WTI Crude', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 72.40, change: 0.85, changePct: 1.19, flag: '🛢️', status: 'open', timezone: 'America/New_York', openTime: '18:00', closeTime: '17:00' },
  { id: 'natgas', name: 'Natural Gas', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 3.25, change: -0.08, changePct: -2.40, flag: '🔥', status: 'open', timezone: 'America/New_York', openTime: '18:00', closeTime: '17:00' },
  { id: 'copper', name: 'Copper', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 4.85, change: 0.12, changePct: 2.54, flag: '🔶', status: 'open', timezone: 'America/New_York', openTime: '18:00', closeTime: '17:00' },
  { id: 'silver', name: 'Silver', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 32.80, change: 0.45, changePct: 1.39, flag: '🥈', status: 'open', timezone: 'America/New_York', openTime: '18:00', closeTime: '17:00' },
  { id: 'wheat', name: 'Wheat', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 623.50, change: -5.25, changePct: -0.83, flag: '🌾', status: 'closed', timezone: 'America/Chicago', openTime: '08:30', closeTime: '13:20' },
  { id: 'corn', name: 'Corn', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 445.25, change: 3.50, changePct: 0.79, flag: '🌽', status: 'closed', timezone: 'America/Chicago', openTime: '08:30', closeTime: '13:20' },
  { id: 'soybean', name: 'Soybean', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 1185.50, change: -12.25, changePct: -1.02, flag: '🫘', status: 'closed', timezone: 'America/Chicago', openTime: '08:30', closeTime: '13:20' },
  { id: 'platinum', name: 'Platinum', market: 'COMMODITY', marketCN: '商品', currency: 'USD', price: 1052.40, change: 8.30, changePct: 0.80, flag: '⚪', status: 'open', timezone: 'America/New_York', openTime: '18:00', closeTime: '17:00' },

  // ── 指数期货 (CME/CBOT/NYMEX/ICE) ──
  { id: 'es_f', name: 'E-mini S&P', market: 'FUTURES', marketCN: '期货', currency: 'USD', price: 6085.50, change: 28.00, changePct: 0.46, flag: '📊', status: 'open', timezone: 'America/Chicago', openTime: '17:00', closeTime: '16:00' },
  { id: 'nq_f', name: 'E-mini Nasdaq', market: 'FUTURES', marketCN: '期货', currency: 'USD', price: 21850.75, change: 142.50, changePct: 0.66, flag: '📊', status: 'open', timezone: 'America/Chicago', openTime: '17:00', closeTime: '16:00' },
  { id: 'ym_f', name: 'E-mini Dow', market: 'FUTURES', marketCN: '期货', currency: 'USD', price: 43720.00, change: -25.00, changePct: -0.06, flag: '📊', status: 'open', timezone: 'America/Chicago', openTime: '17:00', closeTime: '16:00' },
  { id: 'cl_f', name: 'Crude Oil Fut', market: 'FUTURES', marketCN: '期货', currency: 'USD', price: 72.35, change: 0.80, changePct: 1.12, flag: '🛢️', status: 'open', timezone: 'America/Chicago', openTime: '17:00', closeTime: '16:00' },
  { id: 'ng_f', name: 'Henry Hub NG', market: 'FUTURES', marketCN: '期货', currency: 'USD', price: 3.24, change: -0.07, changePct: -2.11, flag: '🔥', status: 'open', timezone: 'America/Chicago', openTime: '17:00', closeTime: '16:00' },
  { id: 'vix_f', name: 'VIX Futures', market: 'FUTURES', marketCN: '期货', currency: 'USD', price: 15.80, change: -0.65, changePct: -3.95, flag: '📊', status: 'open', timezone: 'America/Chicago', openTime: '17:00', closeTime: '16:00' },

  // ── 外汇 ──
  { id: 'eurusd', name: 'EUR/USD', market: 'FOREX', marketCN: '外汇', currency: 'USD', price: 1.0852, change: 0.0015, changePct: 0.14, flag: '💶', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'usdjpy', name: 'USD/JPY', market: 'FOREX', marketCN: '外汇', currency: 'JPY', price: 156.80, change: -0.45, changePct: -0.29, flag: '💴', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'gbpusd', name: 'GBP/USD', market: 'FOREX', marketCN: '外汇', currency: 'USD', price: 1.2745, change: 0.0021, changePct: 0.17, flag: '💷', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'usdcnh', name: 'USD/CNH', market: 'FOREX', marketCN: '外汇', currency: 'CNY', price: 7.1850, change: -0.0085, changePct: -0.12, flag: '🇨🇳', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'audusd', name: 'AUD/USD', market: 'FOREX', marketCN: '外汇', currency: 'USD', price: 0.6720, change: 0.0018, changePct: 0.27, flag: '🇦🇺', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'usdcad', name: 'USD/CAD', market: 'FOREX', marketCN: '外汇', currency: 'CAD', price: 1.3520, change: 0.0035, changePct: 0.26, flag: '🇨🇦', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'usdchf', name: 'USD/CHF', market: 'FOREX', marketCN: '外汇', currency: 'CHF', price: 0.8920, change: -0.0018, changePct: -0.20, flag: '🇨🇭', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },
  { id: 'eurjpy', name: 'EUR/JPY', market: 'FOREX', marketCN: '外汇', currency: 'JPY', price: 170.15, change: -0.25, changePct: -0.15, flag: '💴', status: 'open', timezone: 'UTC', openTime: '00:00', closeTime: '24:00' },

  // ── 期权 (指数) ──
  { id: 'spx_opt', name: 'SPX Options', market: 'OPTIONS', marketCN: '期权', currency: 'USD', price: 0, change: 0, changePct: 0, flag: '📈', status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:15' },
  { id: 'vix_opt', name: 'VIX Options', market: 'OPTIONS', marketCN: '期权', currency: 'USD', price: 0, change: 0, changePct: 0, flag: '📈', status: 'open', timezone: 'America/New_York', openTime: '09:30', closeTime: '16:15' },
];

const marketSessions: MarketSession[] = [
  // 亚太
  { market: 'JP', marketCN: '日股', timezone: 'Asia/Tokyo', utcOffset: 9, status: 'closed', openTime: '09:00', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '12:30', currentTime: new Date('2026-06-17T06:00:00+09:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+09:00'), progressPct: 0, isDST: false },
  { market: 'CN', marketCN: 'A股', timezone: 'Asia/Shanghai', utcOffset: 8, status: 'closed', openTime: '09:30', closeTime: '15:00', lunchStart: '11:30', lunchEnd: '13:00', currentTime: new Date('2026-06-17T05:00:00+08:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:30:00+08:00'), progressPct: 0, isDST: false },
  { market: 'HK', marketCN: '港股', timezone: 'Asia/Hong_Kong', utcOffset: 8, status: 'closed', openTime: '09:30', closeTime: '16:00', lunchStart: '12:00', lunchEnd: '13:00', currentTime: new Date('2026-06-17T05:00:00+08:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:30:00+08:00'), progressPct: 0, isDST: false },
  { market: 'KR', marketCN: '韩国', timezone: 'Asia/Seoul', utcOffset: 9, status: 'closed', openTime: '09:00', closeTime: '15:30', currentTime: new Date('2026-06-17T06:00:00+09:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+09:00'), progressPct: 0, isDST: false },
  { market: 'TW', marketCN: '台湾', timezone: 'Asia/Taipei', utcOffset: 8, status: 'closed', openTime: '09:00', closeTime: '13:30', currentTime: new Date('2026-06-17T05:00:00+08:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+08:00'), progressPct: 0, isDST: false },
  { market: 'IN', marketCN: '印度', timezone: 'Asia/Kolkata', utcOffset: 5.5, status: 'closed', openTime: '09:15', closeTime: '15:30', currentTime: new Date('2026-06-17T02:30:00+05:30'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:15:00+05:30'), progressPct: 0, isDST: false },
  { market: 'AU', marketCN: '澳洲', timezone: 'Australia/Sydney', utcOffset: 10, status: 'closed', openTime: '10:00', closeTime: '16:00', currentTime: new Date('2026-06-17T07:00:00+10:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T10:00:00+10:00'), progressPct: 0, isDST: false },
  // 美国
  { market: 'US', marketCN: '美股', timezone: 'America/New_York', utcOffset: -4, status: 'open', openTime: '09:30', closeTime: '16:00', currentTime: new Date('2026-06-17T11:30:00-04:00'), nextEvent: '收市', nextEventTime: new Date('2026-06-17T16:00:00-04:00'), progressPct: 42, isDST: true },
  // 美洲
  { market: 'CA', marketCN: '加拿大', timezone: 'America/Toronto', utcOffset: -4, status: 'open', openTime: '09:30', closeTime: '16:00', currentTime: new Date('2026-06-17T11:30:00-04:00'), nextEvent: '收市', nextEventTime: new Date('2026-06-17T16:00:00-04:00'), progressPct: 42, isDST: true },
  { market: 'BR', marketCN: '巴西', timezone: 'America/Sao_Paulo', utcOffset: -3, status: 'closed', openTime: '10:00', closeTime: '17:00', currentTime: new Date('2026-06-16T22:00:00-03:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T10:00:00-03:00'), progressPct: 0, isDST: false },
  // 欧洲
  { market: 'UK', marketCN: '英股', timezone: 'Europe/London', utcOffset: 1, status: 'closed', openTime: '08:00', closeTime: '16:30', currentTime: new Date('2026-06-16T22:00:00+01:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T08:00:00+01:00'), progressPct: 0, isDST: true },
  { market: 'EU', marketCN: '欧股(德/法/荷)', timezone: 'Europe/Berlin', utcOffset: 2, status: 'closed', openTime: '09:00', closeTime: '17:30', currentTime: new Date('2026-06-16T23:00:00+02:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+02:00'), progressPct: 0, isDST: true },
  { market: 'CH', marketCN: '瑞士', timezone: 'Europe/Zurich', utcOffset: 2, status: 'closed', openTime: '09:00', closeTime: '17:20', currentTime: new Date('2026-06-16T23:00:00+02:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+02:00'), progressPct: 0, isDST: true },
  // 中东
  { market: 'SA', marketCN: '沙特', timezone: 'Asia/Riyadh', utcOffset: 3, status: 'closed', openTime: '10:00', closeTime: '15:00', currentTime: new Date('2026-06-17T00:00:00+03:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T10:00:00+03:00'), progressPct: 0, isDST: false },
  { market: 'AE', marketCN: '阿联酋', timezone: 'Asia/Dubai', utcOffset: 4, status: 'closed', openTime: '10:00', closeTime: '15:00', currentTime: new Date('2026-06-17T01:00:00+04:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T10:00:00+04:00'), progressPct: 0, isDST: false },
  // 非洲
  { market: 'ZA', marketCN: '南非', timezone: 'Africa/Johannesburg', utcOffset: 2, status: 'closed', openTime: '09:00', closeTime: '17:00', currentTime: new Date('2026-06-16T23:00:00+02:00'), nextEvent: '开市', nextEventTime: new Date('2026-06-17T09:00:00+02:00'), progressPct: 0, isDST: false },
];

// ── Global Market Clock Timeline ──
const MarketClockTimeline: React.FC = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card
      title={<Space><ClockCircleOutlined /> 全球市场时钟 (北京时间 {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })})</Space>}
      size="small"
    >
      <div style={{ display: 'flex', overflowX: 'auto', gap: 0 }}>
        {marketSessions.map(session => {
          const isOpen = session.status === 'open';
          const isPre = session.status === 'pre';
          const isLunch = session.status === 'lunch';
          const isActive = isOpen || isPre;
          const bgColor = isOpen ? '#f6ffed' : isPre ? '#fffbe6' : isLunch ? '#fff7e6' : '#fafafa';
          const borderColor = isOpen ? '#52c41a' : isPre ? '#faad14' : isLunch ? '#fa8c16' : '#d9d9d9';
          const statusColor = isOpen ? 'green' : isPre ? 'gold' : isLunch ? 'orange' : 'default';

          return (
            <div key={session.market} style={{
              flex: '0 0 180px', padding: '12px', margin: '0 4px',
              background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 8,
            }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Text strong>{session.marketCN}</Text>
                <Badge
                  status={isOpen ? 'processing' : 'default'}
                  text={isOpen ? '交易中' : isPre ? '盘前' : isLunch ? '午休' : '已收市'}
                />
              </Space>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  UTC{session.utcOffset >= 0 ? '+' : ''}{session.utcOffset}:00
                  {session.isDST && <Tag style={{ fontSize: 9, marginLeft: 4 }} color="blue">夏令时</Tag>}
                </Text>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 12 }}>
                  {session.openTime} - {session.closeTime}
                </Text>
                {session.lunchStart && (
                  <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                    午休 {session.lunchStart}-{session.lunchEnd}
                  </Text>
                )}
              </div>
              {isOpen && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <Text type="secondary">进度</Text>
                    <Text>{session.progressPct}%</Text>
                  </div>
                  <Progress percent={session.progressPct} size="small" showInfo={false}
                    strokeColor={{ '0%': '#52c41a', '100%': '#1677ff' }} style={{ margin: '2px 0' }} />
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 10, color: '#999' }}>
                {session.nextEvent} {session.nextEventTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: session.timezone })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ── Global Index Ticker (horizontal scroll) ──
const GlobalIndexTicker: React.FC<{ quotes: IndexQuote[] }> = ({ quotes }) => {
  const byMarket: Record<string, IndexQuote[]> = {};
  for (const q of quotes) {
    if (!byMarket[q.marketCN]) byMarket[q.marketCN] = [];
    byMarket[q.marketCN].push(q);
  }

  return (
    <Card
      title={<Space><GlobalOutlined /> 全球指数 <Tag color="green">实时</Tag></Space>}
      size="small"
      extra={<Text type="secondary" style={{ fontSize: 11 }}>数据更新于 {new Date().toLocaleTimeString()}</Text>}
    >
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 0, minWidth: 1200 }}>
          {Object.entries(byMarket).map(([marketCN, indices]) => (
            <div key={marketCN} style={{
              flex: '0 0 auto', minWidth: 180, padding: '0 12px',
              borderRight: '1px solid #f0f0f0',
            }}>
              <Text strong style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>{marketCN}</Text>
              {indices.map(idx => {
                const isUp = idx.change >= 0;
                const statusColor = idx.status === 'open' ? 'green' : idx.status === 'pre' ? 'gold' : idx.status === 'lunch_break' ? 'orange' : 'default';
                return (
                  <div key={idx.id} style={{
                    padding: '4px 0', borderBottom: '1px solid #fafafa',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <Space size={4}>
                      <Text style={{ fontSize: 14 }}>{idx.flag}</Text>
                      <Tooltip title={idx.name}>
                        <Text strong style={{ fontSize: 12 }}>{idx.id.toUpperCase()}</Text>
                      </Tooltip>
                      <Badge status={statusColor as any} />
                    </Space>
                    <Space size={4}>
                      <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
                        {idx.price >= 1000 ? idx.price.toLocaleString() : idx.price.toFixed(2)}
                      </Text>
                      <Text
                        type={isUp ? 'success' : 'danger'}
                        strong
                        style={{ fontSize: 11 }}
                      >
                        {isUp ? <CaretUpOutlined /> : <CaretDownOutlined />}
                        {isUp ? '+' : ''}{idx.changePct.toFixed(2)}%
                      </Text>
                    </Space>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <Divider style={{ margin: '8px 0' }} />
      <Row gutter={[8, 4]}>
        {[
          { label: '上涨', count: mockIndexQuotes.filter(q => q.change >= 0).length, color: '#52c41a' },
          { label: '下跌', count: mockIndexQuotes.filter(q => q.change < 0).length, color: '#ff4d4f' },
          { label: '交易中', count: mockIndexQuotes.filter(q => q.status === 'open').length, color: '#1677ff' },
          { label: '已收市', count: mockIndexQuotes.filter(q => q.status === 'closed').length, color: '#999' },
          { label: '总指数', count: mockIndexQuotes.length, color: '#722ed1' },
          { label: '总市场', count: new Set(mockIndexQuotes.map(q => q.market)).size, color: '#eb2f96' },
        ].map(s => (
          <Col span={4} key={s.label}>
            <Space size={4}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <Text type="secondary" style={{ fontSize: 11 }}>{s.label} <Text strong>{s.count}</Text></Text>
            </Space>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

// ── Market Open/Close Calendar ──
const MarketCalendar: React.FC = () => {
  const today = new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <Card size="small" title={<Space><SunOutlined /> 今日市场</Space>}
      extra={<Text type="secondary">{today}</Text>}>
      <Row gutter={[4, 4]}>
        {[
          // 亚太 (7)
          { market: '🇯🇵 日股', time: '08:00 开市', status: 'next' },
          { market: '🇰🇷 韩国', time: '08:00 开市', status: 'next' },
          { market: '🇹🇼 台湾', time: '08:00 开市', status: 'next' },
          { market: '🇨🇳 A股', time: '09:30 开市', status: 'next' },
          { market: '🇭🇰 港股', time: '09:30 开市', status: 'next' },
          { market: '🇸🇬 新加坡', time: '09:00 开市', status: 'next' },
          { market: '🇮🇳 印度', time: '11:45 开市', status: 'next' },
          // 东南亚+大洋洲 (4)
          { market: '🇦🇺 澳洲', time: '08:00 开市', status: 'next' },
          { market: '🇮🇩 印尼', time: '10:00 开市', status: 'next' },
          { market: '🇹🇭 泰国', time: '11:00 开市', status: 'next' },
          { market: '🇻🇳 越南', time: '10:00 开市', status: 'next' },
          // 欧洲+中东+非洲 (8)
          { market: '🇸🇦 沙特', time: '15:00 开市', status: 'later' },
          { market: '🇦🇪 阿联酋', time: '14:00 开市', status: 'later' },
          { market: '🇿🇦 南非', time: '15:00 开市', status: 'later' },
          { market: '🇬🇧 英股', time: '15:00 开市', status: 'later' },
          { market: '🇩🇪 德股', time: '15:00 开市', status: 'later' },
          { market: '🇫🇷 法股', time: '15:00 开市', status: 'later' },
          { market: '🇳🇱 荷兰', time: '15:00 开市', status: 'later' },
          { market: '🇨🇭 瑞士', time: '15:00 开市', status: 'later' },
          // 美洲 (4)
          { market: '🇧🇷 巴西', time: '21:00 开市', status: 'later' },
          { market: '🇺🇸 美股', time: '21:30 开市 (现在交易中)', status: 'now' },
          { market: '🇨🇦 加拿大', time: '21:30 开市', status: 'now' },
          // 全天候 (4)
          { market: '₿ 加密货币', time: '24h 交易中', status: 'now' },
          { market: '🥇 商品期货', time: 'CME Globex 交易中', status: 'now' },
          { market: '💱 外汇', time: '24h 交易中', status: 'now' },
          { market: '📈 期权', time: '美股时段 交易中', status: 'now' },
        ].map(m => (
          <Col xs={12} sm={8} md={6} lg={4} key={m.market}>
            <div style={{
              padding: '5px 8px', borderRadius: 6,
              background: m.status === 'now' ? '#f6ffed' : m.status === 'next' ? '#e6f7ff' : m.status === 'later' ? '#fafafa' : '#fff',
              border: `1px solid ${m.status === 'now' ? '#b7eb8f' : m.status === 'next' ? '#91d5ff' : '#d9d9d9'}`,
            }}>
              <Text style={{ fontSize: 11 }}>{m.market}</Text>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{m.time}</Text>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

// ── Main Component ──
const GlobalIndexAndClock: React.FC = () => {
  const [quotes] = useState<IndexQuote[]>(mockIndexQuotes);

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      <Space style={{ marginBottom: 12 }}>
        <GlobalOutlined style={{ fontSize: 24, color: '#1677ff' }} />
        <Title level={3} style={{ margin: 0 }}>全球市场</Title>
      </Space>

      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Index Ticker */}
        <GlobalIndexTicker quotes={quotes} />

        {/* Market Clock */}
        <MarketClockTimeline />

        {/* Next Open Calendar */}
        <MarketCalendar />
      </Space>
    </div>
  );
};

export default GlobalIndexAndClock;
