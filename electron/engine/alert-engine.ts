// JVS Alert Engine — singleton alert engine for event-driven alerts
export interface AlertRule {
  id: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  cooldown: number;
}

export interface AlertEvent {
  ruleId: string;
  symbol: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  data: Record<string, any>;
}

type AlertHandler = (alert: AlertEvent) => void;

export class AlertEngine {
  private handlers: Array<{ pattern: RegExp | string; handler: AlertHandler }> = [];
  private rules = new Map<string, { rule: AlertRule; lastFired: number }>();
  private running = false;

  on(event: string, handler: AlertHandler): () => void {
    this.handlers.push({ pattern: event, handler });
    return () => {
      this.handlers = this.handlers.filter(h => h.pattern !== event);
    };
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, { rule, lastFired: 0 });
  }

  removeRule(id: string): void {
    this.rules.delete(id);
  }

  emitAlert(alert: AlertEvent): void {
    const now = Date.now();
    for (const { pattern, handler } of this.handlers) {
      if (pattern === 'alert' || pattern === '*' || (pattern instanceof RegExp && pattern.test(alert.ruleId))) {
        handler(alert);
      }
    }
    const entry = this.rules.get(alert.ruleId);
    if (entry) entry.lastFired = now;
  }

  getActiveRules(): AlertRule[] {
    return Array.from(this.rules.values()).map(e => e.rule);
  }

  stop(): void {
    this.running = false;
    this.handlers = [];
    this.rules.clear();
  }
}

let _instance: AlertEngine | null = null;

export function getAlertEngine(): AlertEngine {
  if (!_instance) {
    _instance = new AlertEngine();
  }
  return _instance;
}
