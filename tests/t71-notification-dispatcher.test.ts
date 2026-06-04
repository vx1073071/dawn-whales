import { describe, it, expect, vi } from 'vitest';
import { NotificationDispatcher } from '../electron/workers/notification-dispatcher';

describe('NotificationDispatcher', () => {
  it('should dispatch to registered channels', async () => {
    const d = new NotificationDispatcher();
    const h1 = vi.fn().mockResolvedValue(undefined);
    d.registerChannel('toast', { name: 'toast', enabled: true, minPriority: 'low' }, h1);

    const result = await d.dispatch({ title: 'Test', body: 'msg', priority: 'normal' });
    expect(result.delivered).toContain('toast');
    expect(h1).toHaveBeenCalledOnce();
  });

  it('should skip disabled channels', async () => {
    const d = new NotificationDispatcher();
    const h1 = vi.fn();
    d.registerChannel('email', { name: 'email', enabled: false, minPriority: 'low' }, h1);

    await d.dispatch({ title: 'Test', body: 'msg', priority: 'normal' });
    expect(h1).not.toHaveBeenCalled();
  });

  it('should filter by priority', async () => {
    const d = new NotificationDispatcher();
    const h1 = vi.fn();
    d.registerChannel('critical-only', { name: 'c', enabled: true, minPriority: 'critical' }, h1);

    await d.dispatch({ title: 'T', body: 'b', priority: 'low' });
    expect(h1).not.toHaveBeenCalled();

    await d.dispatch({ title: 'T', body: 'b', priority: 'critical' });
    expect(h1).toHaveBeenCalledOnce();
  });

  it('should keep history', async () => {
    const d = new NotificationDispatcher();
    await d.dispatch({ title: 'H1', body: '', priority: 'normal' });
    await d.dispatch({ title: 'H2', body: '', priority: 'normal' });
    const hist = d.getHistory();
    expect(hist.length).toBe(2);
  });
});
