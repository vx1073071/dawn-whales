// T85: Kafka Message Service (with in-memory fallback)
export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: string;
  partition?: number;
  offset?: number;
  timestamp: number;
}

type MessageHandler = (msg: KafkaMessage) => Promise<void>;

export class MessageQueueService {
  private topics = new Map<string, KafkaMessage[]>();
  private consumers = new Map<string, MessageHandler[]>();
  private maxQueueSize: number;
  private retentionMs: number;

  constructor(maxQueueSize = 10000, retentionMs = 3600000) {
    this.maxQueueSize = maxQueueSize;
    this.retentionMs = retentionMs;
  }

  async connect(): Promise<void> { /* In prod: kafkajs consumer */ }

  async disconnect(): Promise<void> { this.topics.clear(); }

  async produce(topic: string, value: string, key?: string): Promise<void> {
    this._ensureTopic(topic);
    const msg: KafkaMessage = {
      topic, key, value,
      timestamp: Date.now(),
      partition: 0,
      offset: this.topics.get(topic)!.length,
    };
    this.topics.get(topic)!.push(msg);
    this._trim(topic);
    await this._dispatch(msg);
  }

  async consume(topic: string, handler: MessageHandler): Promise<void> {
    if (!this.consumers.has(topic)) this.consumers.set(topic, []);
    this.consumers.get(topic)!.push(handler);
  }

  async getMessages(topic: string, fromOffset = 0, maxCount = 100): Promise<KafkaMessage[]> {
    const messages = this.topics.get(topic) || [];
    return messages.slice(fromOffset, fromOffset + maxCount);
  }

  async getLatestOffset(topic: string): Promise<number> {
    return this.topics.get(topic)?.length || 0;
  }

  topicStats(): Record<string, { messages: number; consumers: number }> {
    const result: Record<string, any> = {};
    for (const [topic, msgs] of this.topics) {
      result[topic] = {
        messages: msgs.length,
        consumers: this.consumers.get(topic)?.length || 0,
      };
    }
    return result;
  }

  private _ensureTopic(topic: string): void {
    if (!this.topics.has(topic)) this.topics.set(topic, []);
  }

  private _trim(topic: string): void {
    const msgs = this.topics.get(topic)!;
    while (msgs.length > this.maxQueueSize) msgs.shift();
    const cutoff = Date.now() - this.retentionMs;
    while (msgs.length > 0 && msgs[0].timestamp < cutoff) msgs.shift();
  }

  private async _dispatch(msg: KafkaMessage): Promise<void> {
    const handlers = this.consumers.get(msg.topic) || [];
    for (const handler of handlers) {
      try { await handler(msg); } catch (e) { /* log */ }
    }
  }
}

export const messageQueue = new MessageQueueService();
