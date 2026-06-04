import { describe, it, expect } from 'vitest';
import { DeadLetterQueue } from '../electron/workers/dead-letter-queue';

describe('DeadLetterQueue', () => {
  it('should push and pop ready', () => {
    const q = new DeadLetterQueue(3, 0);
    q.push('order.create', { id: 1 }, 'timeout');
    const item = q.popReady();
    expect(item).not.toBeNull();
    expect(item!.topic).toBe('order.create');
  });

  it('should not pop if backoff not expired', () => {
    const q = new DeadLetterQueue(3, 99999);
    q.push('test', {}, 'err');
    expect(q.popReady()).toBeNull();
  });

  it('should drop after max retries', () => {
    const q = new DeadLetterQueue(2, 0);
    q.push('x', {}, 'err');
    let item = q.popReady()!;
    q.requeue(item);
    item = q.popReady()!;
    q.requeue(item);
    // 3rd attempt = maxRetries hit, should not requeue
    expect(q.size()).toBe(0);
  });

  it('should purge by topic', () => {
    const q = new DeadLetterQueue(5, 0);
    q.push('a', {}, 'e1');
    q.push('a', {}, 'e2');
    q.push('b', {}, 'e3');
    expect(q.purge('a')).toBe(2);
    expect(q.size()).toBe(1);
  });
});
