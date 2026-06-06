import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  NotificationEngine,
  type NotificationRule,
  type Notification,
} from '../electron/engine/notification-engine';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRule(overrides: Partial<NotificationRule> = {}): NotificationRule {
  return {
    id: 'rule-1',
    name: 'Test Rule',
    type: 'signal',
    condition: () => true,
    priority: 'normal',
    channels: ['in_app'],
    enabled: true,
    cooldownMs: 0,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('NotificationEngine', () => {
  let engine: NotificationEngine;

  beforeEach(() => {
    engine = new NotificationEngine();
  });

  // 1. addRule / removeRule
  it('should add and remove rules', () => {
    const rule = makeRule();
    engine.addRule(rule);
    expect(engine.getRules()).toHaveLength(1);

    const removed = engine.removeRule('rule-1');
    expect(removed).toBe(true);
    expect(engine.getRules()).toHaveLength(0);
  });

  // 2. removeRule returns false for missing id
  it('should return false when removing non-existent rule', () => {
    expect(engine.removeRule('nope')).toBe(false);
  });

  // 3. processEvent generates notifications
  it('should generate notifications from matching events', () => {
    engine.addRule(makeRule({ name: 'Price Alert', type: 'alert', priority: 'high' }));
    const results = engine.processEvent({ message: 'BTC > 100k' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('alert');
    expect(results[0].priority).toBe('high');
    expect(results[0].read).toBe(false);
  });

  // 4. processEvent skips disabled rules
  it('should skip disabled rules', () => {
    engine.addRule(makeRule({ enabled: false }));
    const results = engine.processEvent({ message: 'test' });
    expect(results).toHaveLength(0);
  });

  // 5. processEvent respects cooldown
  it('should respect cooldown between triggers', () => {
    engine.addRule(makeRule({ cooldownMs: 60_000 }));
    const first = engine.processEvent({ message: 'a' });
    expect(first).toHaveLength(1);

    const second = engine.processEvent({ message: 'b' });
    expect(second).toHaveLength(0);
  });

  // 6. processEvent only matches when condition returns true
  it('should only match events that satisfy condition', () => {
    engine.addRule(
      makeRule({
        condition: (e) => e.level === 'critical',
      })
    );
    expect(engine.processEvent({ level: 'info' })).toHaveLength(0);
    expect(engine.processEvent({ level: 'critical' })).toHaveLength(1);
  });

  // 7. getNotifications with filters
  it('should filter notifications by type and read status', () => {
    engine.addRule(makeRule({ id: 'r1', type: 'signal' }));
    engine.addRule(makeRule({ id: 'r2', type: 'error', priority: 'critical' }));
    engine.processEvent({ message: 'test' });

    expect(engine.getNotifications({ type: 'signal' })).toHaveLength(1);
    expect(engine.getNotifications({ type: 'error' })).toHaveLength(1);
    expect(engine.getNotifications({ read: false })).toHaveLength(2);
    expect(engine.getNotifications({ read: true })).toHaveLength(0);
  });

  // 8. getNotifications with limit
  it('should respect limit parameter', () => {
    engine.addRule(makeRule({ id: 'r1' }));
    engine.addRule(makeRule({ id: 'r2' }));
    engine.processEvent({ message: 'x' });
    expect(engine.getNotifications({ limit: 1 })).toHaveLength(1);
  });

  // 9. markRead / markAllRead
  it('should mark notifications as read', () => {
    engine.addRule(makeRule({ id: 'r1' }));
    engine.addRule(makeRule({ id: 'r2' }));
    const notifs = engine.processEvent({ message: 'hi' });

    expect(engine.markRead(notifs[0].id)).toBe(true);
    expect(engine.getUnreadCount()).toBe(1);

    engine.markAllRead();
    expect(engine.getUnreadCount()).toBe(0);
  });

  // 10. markRead returns false for missing id
  it('should return false for markRead with invalid id', () => {
    expect(engine.markRead('nonexistent')).toBe(false);
  });

  // 11. getStats
  it('should return correct stats', () => {
    engine.addRule(makeRule({ id: 'r1', type: 'signal' }));
    engine.addRule(makeRule({ id: 'r2', type: 'alert' }));
    engine.processEvent({ message: 'stats test' });

    const stats = engine.getStats();
    expect(stats.total).toBe(2);
    expect(stats.unread).toBe(2);
    expect(stats.byType.signal).toBe(1);
    expect(stats.byType.alert).toBe(1);
  });

  // 12. pruneExpired
  it('should prune expired notifications', () => {
    engine.addRule(makeRule({ id: 'r1' }));
    const notifs = engine.processEvent({ message: 'expire me' });

    // Manually set expiry to the past
    const n = engine.getNotification(notifs[0].id)!;
    // Access internal via cast for testing
    (engine as any).notifications.get(notifs[0].id)!.expiresAt = Date.now() - 1000;

    const pruned = engine.pruneExpired();
    expect(pruned).toBe(1);
    expect(engine.getStats().total).toBe(0);
  });

  // 13. EventEmitter: emits events
  it('should emit notification event when notification is created', () => {
    const handler = vi.fn();
    engine.on('notification', handler);
    engine.addRule(makeRule());
    engine.processEvent({ message: 'event test' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // 14. clear removes all notifications
  it('should clear all notifications', () => {
    engine.addRule(makeRule());
    engine.processEvent({ message: 'clear test' });
    expect(engine.getStats().total).toBe(1);

    engine.clear();
    expect(engine.getStats().total).toBe(0);
  });

  // 15. deleteNotification
  it('should delete a single notification', () => {
    engine.addRule(makeRule());
    const notifs = engine.processEvent({ message: 'del test' });
    expect(engine.deleteNotification(notifs[0].id)).toBe(true);
    expect(engine.getStats().total).toBe(0);
    expect(engine.deleteNotification('nope')).toBe(false);
  });

  // 16. priority sorting
  it('should sort notifications by priority descending', () => {
    engine.addRule(makeRule({ id: 'low', priority: 'low' }));
    engine.addRule(makeRule({ id: 'crit', priority: 'critical' }));
    engine.addRule(makeRule({ id: 'norm', priority: 'normal' }));
    engine.processEvent({ message: 'sort test' });

    const all = engine.getNotifications();
    expect(all[0].priority).toBe('critical');
    expect(all[1].priority).toBe('normal');
    expect(all[2].priority).toBe('low');
  });

  // 17. enableRule / disableRule
  it('should enable and disable rules', () => {
    engine.addRule(makeRule({ id: 'r1' }));
    engine.disableRule('r1');
    expect(engine.processEvent({ message: 'x' })).toHaveLength(0);

    engine.enableRule('r1');
    expect(engine.processEvent({ message: 'y' })).toHaveLength(1);
  });

  // 18. condition that throws is caught
  it('should handle rules whose condition throws', () => {
    engine.addRule(
      makeRule({
        condition: () => {
          throw new Error('boom');
        },
      })
    );
    const results = engine.processEvent({ message: 'error' });
    expect(results).toHaveLength(0);
  });
});
