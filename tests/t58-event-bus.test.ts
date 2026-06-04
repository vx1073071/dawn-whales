import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../electron/workers/event-bus';

describe('EventBus', () => {
  it('should emit and receive', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('test.event', fn);
    bus.emit('test.event', 'data');
    expect(fn).toHaveBeenCalledWith('data');
  });

  it('should support wildcard', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.on('order.*', fn);
    bus.emit('order.filled', { id: 1 });
    bus.emit('order.cancelled', { id: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith({ id: 2 });
  });

  it('should unsubscribe', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const unsub = bus.on('x', fn);
    unsub();
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });

  it('once should fire only once', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    bus.once('y', fn);
    bus.emit('y');
    bus.emit('y');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
