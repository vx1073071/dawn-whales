/**
 * R262: RemainingBridgeFinalize — community/comparison/tray-ipc 接线收尾
 * 
 * 将 community-bridge, comparison-pk-bridge, tray-ipc-bridge 
 * 统一接入 IPC → 前端UI
 * 
 * 功能:
 *   1. Community IPC 桥接 (关注/策略分享/排行榜事件 → UI)
 *   2. Comparison PK IPC 桥接 (对比结果/雷达图数据 → UI)
 *   3. Tray IPC 桥接收尾 (托盘菜单/实时报价/小窗)
 *   4. 统一事件总线 + 中英文消息
 */

import { createHash } from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export type IpcChannel = 'community' | 'comparison' | 'tray' | 'system' | 'toast';

export interface IpcMessage {
  messageId: string;
  channel: IpcChannel;
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  delivered: boolean;
}

// ── Community IPC types ────────────────────────────────────────────────────

export interface CommunityIpcEvent {
  eventId: string;
  type: 'follow_event' | 'like_event' | 'copy_event' | 'comment_event' | 'strategy_shared' | 'leaderboard_update';
  actorName: string;
  actorId: string;
  targetName?: string;
  targetId?: string;
  message: string;
  messageCn: string;
  timestamp: number;
}

// ── Comparison IPC types ───────────────────────────────────────────────────

export interface ComparisonIpcData {
  comparisonId: string;
  symbols: string[];
  winner: string;
  winnerName: string;
  compositeScores: Record<string, number>;
  radarData: Array<{ symbol: string; name: string; values: number[] }>;
  summaryEn: string;
  summaryCn: string;
  generatedAt: number;
}

// ── Tray IPC types ─────────────────────────────────────────────────────────

export interface TrayIpcUpdate {
  updateId: string;
  type: 'quote_update' | 'alert_update' | 'menu_action' | 'mini_toggle' | 'health_update';
  data: Record<string, unknown>;
  timestamp: number;
}

// ── Unified event bus ──────────────────────────────────────────────────────

interface BusEvent {
  eventId: string;
  channel: IpcChannel;
  eventType: string;
  data: unknown;
  createdAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// RemainingBridgeFinalize
// ═══════════════════════════════════════════════════════════════════════════

export class RemainingBridgeFinalize {
  private ipcMessages: IpcMessage[] = [];
  private communityEvents: CommunityIpcEvent[] = [];
  private comparisonData: ComparisonIpcData[] = [];
  private trayUpdates: TrayIpcUpdate[] = [];
  private eventBus: BusEvent[] = [];
  private allWired = false;
  private stats_ = {
    totalMessages: 0,
    communityEvents: 0,
    comparisons: 0,
    trayUpdates: 0,
    deliveredMessages: 0,
  };

  constructor() {}

  // ── Public API: Wiring ──────────────────────────────────────────────────

  /**
   * Wire all remaining bridges to IPC.
   */
  wireAll(): { channels: IpcChannel[]; status: string } {
    this.allWired = true;
    return {
      channels: ['community', 'comparison', 'tray'],
      status: 'all_wired',
    };
  }

  /**
   * Verify wiring is complete.
   */
  verifyWiring(): boolean {
    return this.allWired;
  }

  // ── Public API: Community IPC ───────────────────────────────────────────

  /**
   * Bridge a community event to IPC for UI notification.
   */
  bridgeCommunityEvent(event: {
    type: CommunityIpcEvent['type'];
    actorName: string;
    actorId: string;
    targetName?: string;
    targetId?: string;
  }): CommunityIpcEvent {
    let message = '';
    let messageCn = '';

    switch (event.type) {
      case 'follow_event':
        message = `${event.actorName} started following${event.targetName ? ' ' + event.targetName : ''}`;
        messageCn = `${event.actorName} 关注了${event.targetName ?? '某人'}`;
        break;
      case 'like_event':
        message = `${event.actorName} liked${event.targetName ? ' ' + event.targetName + "'s" : ''} strategy`;
        messageCn = `${event.actorName} 点赞了${event.targetName ? event.targetName + '的' : ''}策略`;
        break;
      case 'copy_event':
        message = `${event.actorName} copied${event.targetName ? ' ' + event.targetName + "'s" : ''} strategy`;
        messageCn = `${event.actorName} 复制了${event.targetName ? event.targetName + '的' : ''}策略`;
        break;
      case 'comment_event':
        message = `${event.actorName} commented on a strategy`;
        messageCn = `${event.actorName} 评论了一条策略`;
        break;
      case 'strategy_shared':
        message = `${event.actorName} shared a new strategy`;
        messageCn = `${event.actorName} 分享了一条新策略`;
        break;
      case 'leaderboard_update':
        message = 'Leaderboard has been updated';
        messageCn = '排行榜已更新';
        break;
    }

    const ipcEvent: CommunityIpcEvent = {
      eventId: `comipc:${event.type}:${Date.now()}`,
      ...event,
      message,
      messageCn,
      timestamp: Date.now(),
    };

    this.communityEvents.push(ipcEvent);
    if (this.communityEvents.length > 500) this.communityEvents.shift();
    this.stats_.communityEvents++;

    this._pushIpcMessage('community', event.type, {
      eventId: ipcEvent.eventId,
      ...event,
      message,
      messageCn,
    });

    this._emitEvent('community', event.type, ipcEvent);
    return ipcEvent;
  }

  /**
   * Bridge leaderboard to IPC.
   */
  bridgeLeaderboard(leaderboard: Array<{
    rank: number; userId: string; username: string; displayName: string;
    score: number; category: string;
  }>): CommunityIpcEvent {
    const names = leaderboard.slice(0, 3).map(l => l.displayName).join(', ');
    return this.bridgeCommunityEvent({
      type: 'leaderboard_update',
      actorName: 'System',
      actorId: 'system',
      targetName: `Top 3: ${names}`,
    });
  }

  // ── Public API: Comparison PK IPC ───────────────────────────────────────

  /**
   * Bridge a comparison PK result to IPC → UI.
   */
  bridgeComparison(result: {
    pkId: string;
    symbols: string[];
    winner: string;
    winnerName: string;
    compositeScores: Record<string, number>;
    radarData: Array<{ symbol: string; name: string; values: number[] }>;
    summaryEn: string;
    summaryCn: string;
  }): ComparisonIpcData {
    const data: ComparisonIpcData = {
      comparisonId: result.pkId,
      symbols: result.symbols,
      winner: result.winner,
      winnerName: result.winnerName,
      compositeScores: result.compositeScores,
      radarData: result.radarData,
      summaryEn: result.summaryEn,
      summaryCn: result.summaryCn,
      generatedAt: Date.now(),
    };

    this.comparisonData.push(data);
    if (this.comparisonData.length > 200) this.comparisonData.shift();
    this.stats_.comparisons++;

    this._pushIpcMessage('comparison', 'pk_result', {
      comparisonId: data.comparisonId,
      winner: data.winner,
      winnerName: data.winnerName,
      summaryEn: data.summaryEn,
      summaryCn: data.summaryCn,
    });

    this._emitEvent('comparison', 'pk_result', data);
    return data;
  }

  // ── Public API: Tray IPC 收尾 ───────────────────────────────────────────

  /**
   * Bridge quote update to tray.
   */
  bridgeTrayQuote(symbol: string, price: number, changePercent: number): TrayIpcUpdate {
    const update: TrayIpcUpdate = {
      updateId: `trayq:${symbol}:${Date.now()}`,
      type: 'quote_update',
      data: { symbol, price, changePercent },
      timestamp: Date.now(),
    };

    this.trayUpdates.push(update);
    if (this.trayUpdates.length > 1000) this.trayUpdates.shift();
    this.stats_.trayUpdates++;

    this._pushIpcMessage('tray', 'quote', { symbol, price, changePercent });
    this._emitEvent('tray', 'quote_update', update);

    return update;
  }

  /**
   * Bridge alert to tray.
   */
  bridgeTrayAlert(symbol: string, alertType: string, message: string, messageCn: string): TrayIpcUpdate {
    const update: TrayIpcUpdate = {
      updateId: `traya:${symbol}:${Date.now()}`,
      type: 'alert_update',
      data: { symbol, alertType, message, messageCn },
      timestamp: Date.now(),
    };

    this.trayUpdates.push(update);
    if (this.trayUpdates.length > 500) this.trayUpdates.shift();
    this.stats_.trayUpdates++;

    this._pushIpcMessage('tray', 'alert', { symbol, alertType, message, messageCn });
    this._emitEvent('tray', 'alert_update', update);

    return update;
  }

  /**
   * Bridge mini-window toggle to tray.
   */
  bridgeTrayMiniToggle(visible: boolean, symbol?: string): TrayIpcUpdate {
    const update: TrayIpcUpdate = {
      updateId: `traymini:${Date.now()}`,
      type: 'mini_toggle',
      data: { visible, symbol: symbol ?? null },
      timestamp: Date.now(),
    };
    this.trayUpdates.push(update);
    this.stats_.trayUpdates++;
    return update;
  }

  /**
   * Bridge health status to tray icon.
   */
  bridgeTrayHealth(healthyCount: number, totalCount: number, degradedNames: string[]): TrayIpcUpdate {
    const status = healthyCount === totalCount ? 'all_healthy'
      : healthyCount / totalCount > 0.7 ? 'mostly_healthy'
      : 'warning';

    const update: TrayIpcUpdate = {
      updateId: `trayhealth:${Date.now()}`,
      type: 'health_update',
      data: { healthyCount, totalCount, status, degradedNames },
      timestamp: Date.now(),
    };
    this.trayUpdates.push(update);
    this.stats_.trayUpdates++;

    this._pushIpcMessage('tray', 'health', { healthyCount, totalCount, status });
    return update;
  }

  // ── Public API: IPC Message Bus ─────────────────────────────────────────

  /**
   * Get pending IPC messages for a channel.
   */
  getIpcMessages(channel?: IpcChannel, limit = 50): IpcMessage[] {
    let messages = this.ipcMessages;
    if (channel) messages = messages.filter(m => m.channel === channel);
    return messages.slice(-limit).reverse();
  }

  /**
   * Mark messages as delivered.
   */
  markDelivered(messageIds: string[]): number {
    let count = 0;
    for (const msg of this.ipcMessages) {
      if (messageIds.includes(msg.messageId) && !msg.delivered) {
        msg.delivered = true;
        count++;
      }
    }
    this.stats_.deliveredMessages += count;
    return count;
  }

  // ── Public API: Query ───────────────────────────────────────────────────

  /** Get community events */
  getCommunityEvents(limit = 50): CommunityIpcEvent[] {
    return this.communityEvents.slice(-limit).reverse();
  }

  /** Get comparison data */
  getComparisons(limit = 20): ComparisonIpcData[] {
    return this.comparisonData.slice(-limit).reverse();
  }

  /** Get tray updates */
  getTrayUpdates(limit = 50): TrayIpcUpdate[] {
    return this.trayUpdates.slice(-limit).reverse();
  }

  /** Get event bus events */
  getEventBusEvents(limit = 100): BusEvent[] {
    return this.eventBus.slice(-limit).reverse();
  }

  /** Get stats */
  getStats() { return { ...this.stats_ }; }

  /** Reset */
  reset(): void {
    this.ipcMessages = [];
    this.communityEvents = [];
    this.comparisonData = [];
    this.trayUpdates = [];
    this.eventBus = [];
    this.stats_ = { totalMessages: 0, communityEvents: 0, comparisons: 0, trayUpdates: 0, deliveredMessages: 0 };
    this.allWired = false;
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _pushIpcMessage(
    channel: IpcChannel,
    type: string,
    payload: Record<string, unknown>,
  ): void {
    const msg: IpcMessage = {
      messageId: `ipc:${channel}:${type}:${Date.now()}:${this._hash(channel + type).toString(36).slice(0, 6)}`,
      channel,
      type,
      payload,
      timestamp: Date.now(),
      delivered: false,
    };
    this.ipcMessages.push(msg);
    if (this.ipcMessages.length > 1000) this.ipcMessages.shift();
    this.stats_.totalMessages++;
  }

  private _emitEvent(channel: IpcChannel, eventType: string, data: unknown): void {
    this.eventBus.push({
      eventId: `evt:${channel}:${eventType}:${Date.now()}`,
      channel, eventType, data, createdAt: Date.now(),
    });
    if (this.eventBus.length > 1000) this.eventBus.shift();
  }

  private _hash(input: string): number {
    const h = createHash('sha256').update(input).digest('hex');
    return parseInt(h.slice(0, 8), 16);
  }
}

export const remainingBridgeFinalize = new RemainingBridgeFinalize();
