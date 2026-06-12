// @ts-nocheck
/**
 * DAWN WHALES R132 J03 — WebSocket Push Enhancement
 * 
 * Extends WSPushService with real-time broker status pushing and alert broadcasting.
 * 
 * New features:
 *  - Notification push (broadcast to all users or per-user)
 *  - Alert push system: price alerts, margin calls, circuit breaker trips
 *  - Unified push event type registry
 * 
 * This module hooks into the existing WSPushService via the push events below.
 */

import { WebSocket } from 'ws';

// ═══════════════ Notification Types ══════════════════════

export type NotificationLevel = 'info' | 'warning' | 'error' | 'success';

export interface WSPushNotification {
  id: string;
  userId: string;
  level: NotificationLevel;
  title: string;
  message: string;
  category: 'trade' | 'system' | 'alert' | 'signal' | 'pnl' | 'connection';
  data?: Record<string, unknown>;
  createdAt: number;
}

// ═══════════════ Alert Types ═════════════════════════════

export type AlertType = 'price' | 'margin' | 'breaker' | 'liquidation' | 'drawdown' | 'connection';

export interface WSAlert {
  id: string;
  userId: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  symbol?: string;
  price?: number;
  brokerId?: string;
  autoResolve?: boolean;
  resolvedAt?: number;
  createdAt: number;
}

// ═══════════════ Push Event Registry ═════════════════════

export const PUSH_EVENT_TYPES = {
  // Quotes
  QUOTE_UPDATE: 'quote:update',
  DEPTH_UPDATE: 'depth:update',

  // Orders
  ORDER_PLACED: 'order:placed',
  ORDER_FILLED: 'order:filled',
  ORDER_CANCELED: 'order:canceled',
  ORDER_FAILED: 'order:failed',

  // Copy Trade
  COPYTRADE_EXECUTED: 'copytrade:executed',
  COPYTRADE_FAILED: 'copytrade:failed',
  COPYTRADE_SKIPPED: 'copytrade:skipped',

  // Signals
  SIGNAL_RECEIVED: 'signal:received',
  SIGNAL_QUEUED: 'signal:queued',
  SIGNAL_EXPIRED: 'signal:expired',

  // Broker Status
  BROKER_CONNECTED: 'broker:connected',
  BROKER_DISCONNECTED: 'broker:disconnected',
  BROKER_ERROR: 'broker:error',
  BROKER_HEALTH: 'broker:health',

  // Circuit Breaker
  BREAKER_OPENED: 'breaker:opened',
  BREAKER_CLOSED: 'breaker:closed',
  BREAKER_HALF_OPEN: 'breaker:half_open',

  // Notifications
  NOTIFICATION: 'notification',
  ALERT: 'alert',

  // System
  SYSTEM_HEARTBEAT: 'system:heartbeat',
  SYSTEM_MAINTENANCE: 'system:maintenance',
} as const;

export type PushEventType = typeof PUSH_EVENT_TYPES[keyof typeof PUSH_EVENT_TYPES];

// ═══════════════ Notification Store Interface ═══════════

interface NotificationStore {
  save(notification: WSPushNotification): Promise<void>;
  saveAlert(alert: WSAlert): Promise<void>;
  getByUser(userId: string, options?: { category?: string; level?: NotificationLevel; limit?: number; offset?: number }): Promise<WSPushNotification[]>;
  getAlerts(userId: string, options?: { type?: AlertType; severity?: string; limit?: number }): Promise<WSAlert[]>;
  markRead(notificationId: string): Promise<void>;
  markAlertResolved(alertId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}

// ═══════════════ Push Enhancer ═══════════════════════════

interface WSPushServiceLike {
  getWs(): any;
  send(sock: WebSocket, msg: any): void;
}

export class WSPushEnhancer {
  private wsService: WSPushServiceLike;
  private notificationStore?: NotificationStore;

  constructor(wsService: WSPushServiceLike, notificationStore?: NotificationStore) {
    this.wsService = wsService;
    this.notificationStore = notificationStore;
  }

  /**
   * Push a notification to a specific user or broadcast to all.
   * Notification is also persisted to the store.
   */
  async pushNotification(notification: Omit<WSPushNotification, 'id' | 'createdAt'>): Promise<WSPushNotification> {
    const fullNotification: WSPushNotification = {
      ...notification,
      id: this.generateId(),
      createdAt: Date.now(),
    };

    // Persist
    if (this.notificationStore) {
      await this.notificationStore.save(fullNotification);
    }

    // Send to connected sockets
    this.sendToUser(notification.userId, {
      type: PUSH_EVENT_TYPES.NOTIFICATION,
      payload: fullNotification,
    });

    return fullNotification;
  }

  /**
   * Broadcast a notification to ALL connected users.
   */
  async broadcastNotification(
    level: NotificationLevel,
    title: string,
    message: string,
    category: WSPushNotification['category'] = 'system',
  ): Promise<void> {
    const notification: WSPushNotification = {
      id: this.generateId(),
      userId: '*',
      level,
      title,
      message,
      category,
      createdAt: Date.now(),
    };

    if (this.notificationStore) {
      // System broadcast — save with userId='*'
    }

    this.broadcast({
      type: PUSH_EVENT_TYPES.NOTIFICATION,
      payload: notification,
    });
  }

  /**
   * Push an alert (price/margin/breaker/liquidation/drawdown).
   */
  async pushAlert(alert: Omit<WSAlert, 'id' | 'createdAt'>): Promise<WSAlert> {
    const fullAlert: WSAlert = {
      ...alert,
      id: this.generateId(),
      createdAt: Date.now(),
    };

    if (this.notificationStore) {
      await this.notificationStore.saveAlert(fullAlert);
    }

    // Send with high priority
    this.sendToUser(alert.userId, {
      type: PUSH_EVENT_TYPES.ALERT,
      payload: fullAlert,
    });

    return fullAlert;
  }

  /**
   * Push circuit breaker status change.
   */
  pushBreakerStatus(userId: string, brokerId: string, status: 'open' | 'closed' | 'half_open', failures: number): void {
    const eventType = status === 'open' ? PUSH_EVENT_TYPES.BREAKER_OPENED :
      status === 'closed' ? PUSH_EVENT_TYPES.BREAKER_CLOSED :
      PUSH_EVENT_TYPES.BREAKER_HALF_OPEN;

    this.sendToUser(userId, {
      type: eventType,
      payload: { brokerId, status, failures, timestamp: Date.now() },
    });
  }

  /**
   * Push copy trade execution result.
   */
  pushCopyTradeResult(userId: string, result: {
    signalId: string; success: boolean; orderId?: string; brokerId: string; error?: string;
  }): void {
    this.sendToUser(userId, {
      type: result.success ? PUSH_EVENT_TYPES.COPYTRADE_EXECUTED : PUSH_EVENT_TYPES.COPYTRADE_FAILED,
      payload: { ...result, timestamp: Date.now() },
    });
  }

  /**
   * Push broker health status.
   */
  pushBrokerHealth(userId: string, brokerId: string, healthy: boolean, latencyMs: number): void {
    this.sendToUser(userId, {
      type: PUSH_EVENT_TYPES.BROKER_HEALTH,
      payload: { brokerId, healthy, latencyMs, timestamp: Date.now() },
    });
  }

  // ═══════════════ Private ═══════════════════════════════

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  private sendToUser(userId: string, message: { type: string; payload: Record<string, unknown> }): void {
    // We access the WS server to find sockets for this user
    const ws = this.wsService.getWs();
    if (!ws?.clients) return;

    ws.clients.forEach((client: WebSocket) => {
      const authClient = client as any;
      if (authClient.userId === userId || userId === '*') {
        authClient.send(JSON.stringify({ ...message, timestamp: Date.now() }));
      }
    });
  }

  private broadcast(message: { type: string; payload: Record<string, unknown> }): void {
    const ws = this.wsService.getWs();
    if (!ws?.clients) return;

    ws.clients.forEach((client: WebSocket) => {
      client.send(JSON.stringify({ ...message, timestamp: Date.now() }));
    });
  }
}
