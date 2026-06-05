// Stub for realtime-news module
// TODO: Implement full realtime news aggregation logic

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  timestamp: number;
  symbol?: string;
  sentiment?: number;
}

export interface RealtimeNewsService {
  start(): void;
  stop(): void;
  getLatest(symbol?: string): NewsItem[];
  onNews(callback: (item: NewsItem) => void): () => void;
}

let instance: RealtimeNewsService | null = null;

export function getRealtimeNewsService(): RealtimeNewsService {
  if (!instance) {
    instance = {
      start() { console.warn('[realtime-news] Stub: start() called'); },
      stop() { console.warn('[realtime-news] Stub: stop() called'); },
      getLatest(symbol) {
        console.warn('[realtime-news] Stub: getLatest() returning empty');
        return [];
      },
      onNews() {
        console.warn('[realtime-news] Stub: onNews() returning no-op');
        return () => {};
      },
    };
  }
  return instance;
}

export function getRealtimeNewsFeed(...args: any[]): any { console.warn('[getRealtimeNewsFeed] Stub'); return undefined; }
