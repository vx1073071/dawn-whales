import { describe, it, expect, vi } from 'vitest';
import { MessageQueueService } from '../electron/workers/message-queue';

describe('MessageQueueService', () => {
  it('should produce and consume', async () => {
    const mq = new MessageQueueService();
    const fn = vi.fn();
    await mq.consume('orders', fn);
    await mq.produce('orders', '{"type":"buy"}');
    expect(fn).toHaveBeenCalled();
    expect(fn.mock.calls[0][0].value).toBe('{"type":"buy"}');
  });

  it('should retrieve messages by offset', async () => {
    const mq = new MessageQueueService();
    await mq.produce('trades', '1');
    await mq.produce('trades', '2');
    await mq.produce('trades', '3');
    const msgs = await mq.getMessages('trades', 1, 1);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].value).toBe('2');
  });

  it('should report topic stats', async () => {
    const mq = new MessageQueueService();
    await mq.produce('signals', 'buy');
    await mq.consume('signals', async () => {});
    const stats = mq.topicStats();
    expect(stats.signals.messages).toBe(1);
    expect(stats.signals.consumers).toBe(1);
  });
});
