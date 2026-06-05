// T103: Lambda Architecture — Stream + Batch Unified Processor
export interface StreamEvent {
  id: string;
  timestamp: number;
  data: Record<string, any>;
}

export interface BatchResult {
  window: { start: number; end: number };
  data: Record<string, any>[];
  aggregations: Record<string, number>;
}

type StreamHandler = (event: StreamEvent) => void;
type BatchHandler = (events: StreamEvent[]) => Promise<Record<string, number>>;

export class StreamBatchProcessor {
  private streamHandlers: StreamHandler[] = [];
  private batchHandlers = new Map<string, BatchHandler>();
  private buffer: StreamEvent[] = [];
  private batchWindows = new Map<string, { windowMs: number; handler: string }>();
  private timer: NodeJS.Timeout | null = null;

  onStream(handler: StreamHandler): void {
    this.streamHandlers.push(handler);
  }

  addBatchWindow(name: string, windowMs: number, handlerId: string): void {
    this.batchWindows.set(name, { windowMs, handler: handlerId });
  }

  registerBatchHandler(id: string, handler: BatchHandler): void {
    this.batchHandlers.set(id, handler);
  }

  ingest(event: StreamEvent): void {
    // Stream processing — immediate
    for (const h of this.streamHandlers) {
      try { h(event); } catch (e) { /* log */ }
    }

    // Buffer for batch
    this.buffer.push(event);
  }

  ingestMany(events: StreamEvent[]): void {
    for (const e of events) this.ingest(e);
  }

  async processBatch(windowName: string): Promise<BatchResult> {
    const config = this.batchWindows.get(windowName);
    if (!config) throw new Error(`Window ${windowName} not found`);

    const now = Date.now();
    const start = now - config.windowMs;
    const events = this.buffer.filter(e => e.timestamp >= start && e.timestamp <= now);

    const handler = this.batchHandlers.get(config.handler);
    if (!handler) throw new Error(`Handler ${config.handler} not found`);

    const aggregations = await handler(events);

    // Clean processed events from buffer — remove events with timestamp <= now
    // (events with timestamp > now are future events, keep them)
    this.buffer = this.buffer.filter(e => e.timestamp > now);

    return {
      window: { start, end: now },
      data: events.slice(), // return a copy so buffer cleanup doesn't affect the returned data
      aggregations,
    };
  }

  startAutoBatch(intervalMs = 60000): void {
    this.timer = setInterval(async () => {
      for (const [name] of this.batchWindows) {
        try { await this.processBatch(name); } catch (e) { /* log */ }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getBufferSample(count = 10): StreamEvent[] {
    return this.buffer.slice(-count);
  }
}
