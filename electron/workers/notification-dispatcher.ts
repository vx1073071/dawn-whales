// T71: Multi-Channel Notification Dispatcher
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Notification {
  id: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  channel?: string;
  action?: { label: string; callback: string };
  data?: Record<string, any>;
  createdAt: number;
}

export interface ChannelConfig {
  name: string;
  enabled: boolean;
  minPriority: NotificationPriority;
}

export type NotificationHandler = (notification: Notification) => Promise<void>;

const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  low: 0, normal: 1, high: 2, critical: 3,
};

export class NotificationDispatcher {
  private channels = new Map<string, { config: ChannelConfig; handler: NotificationHandler }>();
  private history: Notification[] = [];
  private maxHistory = 500;

  registerChannel(name: string, config: ChannelConfig, handler: NotificationHandler): void {
    this.channels.set(name, { config, handler });
  }

  async dispatch(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<{ id: string; delivered: string[]; failed: string[] }> {
    const full: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };

    this.history.unshift(full);
    if (this.history.length > this.maxHistory) this.history.pop();

    const priorityLevel = PRIORITY_ORDER[full.priority];
    const delivered: string[] = [];
    const failed: string[] = [];

    const channelName = full.channel;
    if (channelName && this.channels.has(channelName)) {
      const ch = this.channels.get(channelName)!;
      if (ch.config.enabled && PRIORITY_ORDER[ch.config.minPriority] <= priorityLevel) {
        try {
          await ch.handler(full);
          delivered.push(channelName);
        } catch {
          failed.push(channelName);
        }
      }
    } else {
      // Broadcast to all eligible channels
      for (const [name, ch] of this.channels) {
        if (!ch.config.enabled) continue;
        if (PRIORITY_ORDER[ch.config.minPriority] > priorityLevel) continue;
        try {
          await ch.handler(full);
          delivered.push(name);
        } catch {
          failed.push(name);
        }
      }
    }

    return { id: full.id, delivered, failed };
  }

  getHistory(limit = 50): Notification[] {
    return this.history.slice(0, limit);
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const notificationDispatcher = new NotificationDispatcher();
