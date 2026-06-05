// T70: Time Series Ring Buffer
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export class TimeSeries {
  private buffer: TimeSeriesPoint[];
  private capacity: number;
  private head = 0;
  private count = 0;
  private sum = 0;

  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(value: number, label?: string): void {
    const point: TimeSeriesPoint = { timestamp: Date.now(), value, label };
    const idx = this.head;
    if (this.count >= this.capacity) {
      const old = this.buffer[idx];
      this.sum -= old.value;
    }
    this.buffer[idx] = point;
    this.sum += value;
    this.head = (idx + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  toArray(): TimeSeriesPoint[] {
    if (this.count === 0) return [];
    const result: TimeSeriesPoint[] = [];
    const start = (this.head - this.count + this.capacity) % this.capacity;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[(start + i) % this.capacity]);
    }
    return result;
  }

  latest(n = 10): TimeSeriesPoint[] {
    const all = this.toArray();
    return all.slice(-n);
  }

  window(from: number, to: number): TimeSeriesPoint[] {
    return this.toArray().filter(p => p.timestamp >= from && p.timestamp <= to);
  }

  stats(): { count: number; min: number; max: number; avg: number; sum: number } {
    const all = this.toArray();
    if (all.length === 0) return { count: 0, min: 0, max: 0, avg: 0, sum: 0 };
    const values = all.map(p => p.value);
    return {
      count: all.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: this.sum / all.length,
      sum: this.sum,
    };
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.sum = 0;
  }
}
