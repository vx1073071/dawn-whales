// T62: Metrics Collector / Exporter
type MetricValue = number;
type LabelValues = Record<string, string>;

interface MetricPoint {
  name: string;
  value: MetricValue;
  labels: LabelValues;
  timestamp: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

class Histogram {
  private buckets: HistogramBucket[];
  private sum = 0;
  private count = 0;

  constructor(buckets: number[]) {
    this.buckets = buckets.map(le => ({ le, count: 0 }));
  }

  observe(value: number): void {
    this.sum += value;
    this.count++;
    for (const b of this.buckets) {
      if (value <= b.le) b.count++;
    }
  }

  stats(): { sum: number; count: number; avg: number; p50?: number } {
    return { sum: this.sum, count: this.count, avg: this.count > 0 ? this.sum / this.count : 0 };
  }
}

export class MetricsCollector {
  private counters = new Map<string, { value: number; labels: LabelValues }[]>();
  private gauges = new Map<string, { value: number; labels: LabelValues }[]>();
  private histograms = new Map<string, Histogram>();

  counter(name: string, labels: LabelValues = {}): void {
    this._incCounter(name, 1, labels);
  }

  counterInc(name: string, n: number, labels: LabelValues = {}): void {
    this._incCounter(name, n, labels);
  }

  gauge(name: string, value: number, labels: LabelValues = {}): void {
    if (!this.gauges.has(name)) this.gauges.set(name, []);
    const arr = this.gauges.get(name)!;
    const existing = arr.find(g => JSON.stringify(g.labels) === JSON.stringify(labels));
    if (existing) existing.value = value;
    else arr.push({ value, labels });
  }

  histogram(name: string, buckets: number[]): Histogram {
    if (!this.histograms.has(name)) this.histograms.set(name, new Histogram(buckets));
    return this.histograms.get(name)!;
  }

  collect(): MetricPoint[] {
    const points: MetricPoint[] = [];
    const now = Date.now();

    for (const [name, items] of this.counters) {
      for (const item of items) {
        points.push({ name, value: item.value, labels: item.labels, timestamp: now });
      }
    }
    for (const [name, items] of this.gauges) {
      for (const item of items) {
        points.push({ name, value: item.value, labels: item.labels, timestamp: now });
      }
    }
    for (const [name, hist] of this.histograms) {
      const s = hist.stats();
      points.push({ name: `${name}_sum`, value: s.sum, labels: {}, timestamp: now });
      points.push({ name: `${name}_count`, value: s.count, labels: {}, timestamp: now });
      points.push({ name: `${name}_avg`, value: s.avg, labels: {}, timestamp: now });
    }

    return points;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private _incCounter(name: string, n: number, labels: LabelValues): void {
    if (!this.counters.has(name)) this.counters.set(name, []);
    const arr = this.counters.get(name)!;
    const existing = arr.find(g => JSON.stringify(g.labels) === JSON.stringify(labels));
    if (existing) existing.value += n;
    else arr.push({ value: n, labels });
  }
}

export const metrics = new MetricsCollector();
