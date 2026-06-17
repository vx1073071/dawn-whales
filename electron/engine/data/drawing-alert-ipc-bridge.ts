/**
 * R266: DrawingAlertIpcBridge — 画线→提醒IPC桥接
 * 
 * 功能:
 *   1. 画线→自动创建告警 (趋势线穿越/支撑突破/阻力突破/通道突破/斐波那契命中)
 *   2. 告警生命周期: create → arm → trigger → dismiss/re-arm
 *   3. 告警条件自动计算 (从画线坐标→价格条件)
 *   4. 告警→推送系统桥接 (对接 push-ipc-bridge)
 *   5. 批量告警管理 (按symbol/类型/状态查询)
 *   6. 告警触发历史+统计
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DrawingAlertConfig {
  alertId: string;
  drawingId: string;       // linked drawing id
  symbol: string;
  drawingType: string;     // trend-line, horizontal-line, fib-retracement, etc.
  alertType: DrawingAlertType;
  condition: DrawingAlertCondition;
  message: string;
  messageCn: string;
  severity: 'info' | 'warning' | 'critical';
  cooldownMs: number;      // re-arm cooldown
  createdAt: number;
}

export type DrawingAlertType =
  | 'price_cross_trendline'
  | 'price_touch_support'
  | 'price_break_support'
  | 'price_touch_resistance'
  | 'price_break_resistance'
  | 'price_enter_channel'
  | 'price_breakout_channel'
  | 'price_hit_fib_level'
  | 'price_cross_ma';

export interface DrawingAlertCondition {
  type: DrawingAlertType;
  price: number;           // target price level
  direction?: 'above' | 'below' | 'cross';  // trigger condition
  fibLevel?: number;       // 0.236, 0.382, 0.5, 0.618, 0.786
  tolerance: number;       // % tolerance around the price
  channelLow?: number;
  channelHigh?: number;
}

export interface DrawingAlertState {
  alertId: string;
  status: 'active' | 'armed' | 'triggered' | 'dismissed' | 'cooldown';
  triggeredAt: number | null;
  triggerPrice: number | null;
  dismissReason?: string;
  dismissReasonCn?: string;
  lastResetAt: number;
  triggerCount: number;
}

export interface DrawingAlertEvent {
  eventId: string;
  alertId: string;
  drawingId: string;
  symbol: string;
  type: DrawingAlertType;
  price: number;
  timestamp: number;
  message: string;
  messageCn: string;
  severity: 'info' | 'warning' | 'critical';
  pushSent: boolean;
}

// ── Drawing alert factory ──────────────────────────────────────────────────

interface DrawingToAlertParams {
  drawingId: string;
  drawingType: string;
  symbol: string;
  // Trend line
  trendStart?: { price: number; time: number };
  trendEnd?: { price: number; time: number };
  // Horizontal line
  horizontalPrice?: number;
  // Fib retracement
  fibHigh?: number;
  fibLow?: number;
  // Channel
  channelUpper?: number;
  channelLower?: number;
  // General
  cooldownMs?: number;
  severity?: DrawingAlertConfig['severity'];
}

// ═══════════════════════════════════════════════════════════════════════════
// DrawingAlertIpcBridge
// ═══════════════════════════════════════════════════════════════════════════

export class DrawingAlertIpcBridge {
  private alerts: Map<string, DrawingAlertConfig> = new Map();
  private states: Map<string, DrawingAlertState> = new Map();
  private events: DrawingAlertEvent[] = [];
  private drawingAlertMap: Map<string, string[]> = new Map(); // drawingId → [alertIds]
  private stats_ = { totalAlerts: 0, totalTriggers: 0, activeAlerts: 0 };

  constructor() {}

  // ── Public API: Create Alert from Drawing ───────────────────────────────

  /**
   * Auto-generate alerts from a drawing's parameters.
   * Returns the created alert configs.
   */
  createAlertsFromDrawing(params: DrawingToAlertParams): DrawingAlertConfig[] {
    const configs: DrawingAlertConfig[] = [];
    const baseId = `da:${params.drawingId}`;

    switch (params.drawingType) {
      case 'trend-line':
        if (params.trendStart && params.trendEnd) {
          // Alert on price breaking trendline (cross above = bull break, below = bear break)
          const midPrice = (params.trendStart.price + params.trendEnd.price) / 2;
          const isUpTrend = params.trendEnd.price > params.trendStart.price;
          configs.push(...this._createAlert(baseId, params, {
            alertType: isUpTrend ? 'price_touch_support' : 'price_touch_resistance',
            price: midPrice,
            direction: isUpTrend ? 'below' : 'above',
            tolerance: 0.5,
            label: 'Trend Line Support/Resistance',
            labelCn: '趋势线支撑/阻力',
            severity: 'warning',
          }));
          configs.push(...this._createAlert(baseId, params, {
            alertType: 'price_break_support',
            price: params.trendEnd.price,
            direction: 'below',
            tolerance: 0.3,
            label: 'Trendline Break (Bear)',
            labelCn: '趋势线跌破',
            severity: 'critical',
          }));
        }
        break;

      case 'horizontal-line':
        if (params.horizontalPrice) {
          configs.push(...this._createAlert(baseId, params, {
            alertType: 'price_break_resistance',
            price: params.horizontalPrice,
            direction: 'above',
            tolerance: 0.3,
            label: 'Resistance Breakout',
            labelCn: '阻力突破',
            severity: 'warning',
          }));
          configs.push(...this._createAlert(baseId, params, {
            alertType: 'price_break_support',
            price: params.horizontalPrice,
            direction: 'below',
            tolerance: 0.3,
            label: 'Support Breakdown',
            labelCn: '支撑跌破',
            severity: 'critical',
          }));
        }
        break;

      case 'fib-retracement':
        if (params.fibHigh && params.fibLow) {
          const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const isUpward = params.fibHigh > params.fibLow;
          for (const level of fibLevels) {
            const price = isUpward
              ? params.fibHigh - (params.fibHigh - params.fibLow) * level
              : params.fibLow + (params.fibHigh - params.fibLow) * level;
            configs.push(...this._createAlert(baseId + `:fib:${level}`, params, {
              alertType: 'price_hit_fib_level',
              price,
              fibLevel: level,
              tolerance: 0.2,
              label: `Fib ${(level * 100).toFixed(1)}%`,
              labelCn: `斐波那契 ${(level * 100).toFixed(1)}%`,
              severity: level === 0.618 ? 'warning' : 'info',
            }));
          }
        }
        break;

      case 'parallel-channel':
        if (params.channelUpper && params.channelLower) {
          configs.push(...this._createAlert(baseId + ':upper', params, {
            alertType: 'price_breakout_channel',
            price: params.channelUpper,
            direction: 'above',
            tolerance: 0.3,
            label: 'Channel Upper Breakout',
            labelCn: '通道上沿突破',
            severity: 'warning',
          }));
          configs.push(...this._createAlert(baseId + ':lower', params, {
            alertType: 'price_breakout_channel',
            price: params.channelLower,
            direction: 'below',
            tolerance: 0.3,
            label: 'Channel Lower Breakdown',
            labelCn: '通道下沿跌破',
            severity: 'critical',
          }));
        }
        break;

      case 'rectangle':
        if (params.channelUpper && params.channelLower) {
          configs.push(...this._createAlert(baseId + ':resistance', params, {
            alertType: 'price_break_resistance',
            price: params.channelUpper,
            direction: 'above',
            tolerance: 0.3,
            label: 'Range High Breakout',
            labelCn: '区间上破',
            severity: 'warning',
          }));
          configs.push(...this._createAlert(baseId + ':support', params, {
            alertType: 'price_break_support',
            price: params.channelLower,
            direction: 'below',
            tolerance: 0.3,
            label: 'Range Low Breakdown',
            labelCn: '区间下破',
            severity: 'critical',
          }));
        }
        break;

      default:
        break;
    }

    return configs;
  }

  // ── Public API: Alert Lifecycle ─────────────────────────────────────────

  /**
   * Check if current price triggers any alerts.
   */
  checkPrice(params: {
    symbol: string;
    price: number;
    timestamp: number;
  }): DrawingAlertEvent[] {
    const triggered: DrawingAlertEvent[] = [];

    for (const [, alert] of this.alerts) {
      if (alert.symbol !== params.symbol) continue;

      const state = this.states.get(alert.alertId);
      if (!state || state.status === 'dismissed') continue;

      // Check cooldown
      if (state.status === 'cooldown' && Date.now() - state.lastResetAt < alert.cooldownMs) continue;

      // Check trigger condition
      if (this._checkCondition(params.price, alert.condition)) {
        state.status = 'triggered';
        state.triggeredAt = params.timestamp;
        state.triggerPrice = params.price;
        state.triggerCount++;
        this.stats_.totalTriggers++;
        this.stats_.activeAlerts--;

        const event: DrawingAlertEvent = {
          eventId: `dae:${alert.alertId}:${params.timestamp}`,
          alertId: alert.alertId,
          drawingId: alert.drawingId,
          symbol: alert.symbol,
          type: alert.alertType,
          price: params.price,
          timestamp: params.timestamp,
          message: `[${alert.symbol}] ${alert.message}: $${params.price}`,
          messageCn: `[${alert.symbol}] ${alert.messageCn} @ ${params.price}`,
          severity: alert.severity,
          pushSent: false,
        };

        this.events.push(event);
        if (this.events.length > 500) this.events.shift();

        triggered.push(event);
      }
    }

    return triggered;
  }

  /**
   * Re-arm an alert after it was triggered.
   */
  reArmAlert(alertId: string): boolean {
    const state = this.states.get(alertId);
    if (!state) return false;

    state.status = 'armed';
    state.lastResetAt = Date.now();
    this.stats_.activeAlerts++;
    return true;
  }

  /**
   * Dismiss an alert.
   */
  dismissAlert(alertId: string, reason?: string, reasonCn?: string): boolean {
    const state = this.states.get(alertId);
    if (!state) return false;

    state.status = 'dismissed';
    state.dismissReason = reason;
    state.dismissReasonCn = reasonCn;
    this.stats_.activeAlerts--;
    return true;
  }

  // ── Public API: Mark Push Sent ──────────────────────────────────────────

  markPushSent(eventId: string): boolean {
    const event = this.events.find(e => e.eventId === eventId);
    if (!event) return false;
    event.pushSent = true;
    return true;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get alerts by symbol */
  getAlertsBySymbol(symbol: string): DrawingAlertConfig[] {
    return Array.from(this.alerts.values()).filter(a => a.symbol === symbol);
  }

  /** Get alerts by drawing */
  getAlertsByDrawing(drawingId: string): DrawingAlertConfig[] {
    const ids = this.drawingAlertMap.get(drawingId) ?? [];
    return ids.map(id => this.alerts.get(id)!).filter(Boolean);
  }

  /** Get alert state */
  getAlertState(alertId: string): DrawingAlertState | null {
    return this.states.get(alertId) ?? null;
  }

  /** Get triggered events */
  getTriggeredEvents(limit = 50): DrawingAlertEvent[] {
    return this.events.filter(e => !e.pushSent).slice(-limit).reverse();
  }

  /** Get all alerts */
  getAllAlerts(): DrawingAlertConfig[] {
    return Array.from(this.alerts.values());
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.alerts.clear();
    this.states.clear();
    this.events = [];
    this.drawingAlertMap.clear();
    this.stats_ = { totalAlerts: 0, totalTriggers: 0, activeAlerts: 0 };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _createAlert(
    idPrefix: string,
    params: DrawingToAlertParams,
    spec: {
      alertType: DrawingAlertType;
      price: number;
      direction?: 'above' | 'below' | 'cross';
      fibLevel?: number;
      tolerance: number;
      label: string;
      labelCn: string;
      severity: DrawingAlertConfig['severity'];
    },
  ): DrawingAlertConfig[] {
    const alertId = `${idPrefix}:${spec.alertType}:${Math.random().toString(36).slice(2, 6)}`;
    const config: DrawingAlertConfig = {
      alertId,
      drawingId: params.drawingId,
      symbol: params.symbol,
      drawingType: params.drawingType,
      alertType: spec.alertType,
      condition: {
        type: spec.alertType,
        price: spec.price,
        direction: spec.direction,
        fibLevel: spec.fibLevel,
        tolerance: spec.tolerance,
      },
      message: `${spec.label} at $${spec.price}`,
      messageCn: `${spec.labelCn} @ ${spec.price}`,
      severity: spec.severity,
      cooldownMs: params.cooldownMs ?? 300_000, // 5 min default
      createdAt: Date.now(),
    };

    this.alerts.set(alertId, config);

    // Link drawing to alert
    const drawingAlerts = this.drawingAlertMap.get(params.drawingId) ?? [];
    drawingAlerts.push(alertId);
    this.drawingAlertMap.set(params.drawingId, drawingAlerts);

    // Initialize state
    this.states.set(alertId, {
      alertId,
      status: 'armed',
      triggeredAt: null,
      triggerPrice: null,
      lastResetAt: Date.now(),
      triggerCount: 0,
    });

    this.stats_.totalAlerts++;
    this.stats_.activeAlerts++;

    return [config];
  }

  private _checkCondition(price: number, cond: DrawingAlertCondition): boolean {
    const { price: target, direction, tolerance } = cond;
    const threshold = target * (tolerance / 100);
    const upper = target + threshold;
    const lower = target - threshold;

    switch (direction) {
      case 'above': return price >= lower;  // price crosses above the level
      case 'below': return price <= upper;  // price crosses below the level
      case 'cross': return price >= upper || price <= lower;
      default: return price >= lower && price <= upper; // touch within tolerance
    }
  }
}

export const drawingAlertIpcBridge = new DrawingAlertIpcBridge();
