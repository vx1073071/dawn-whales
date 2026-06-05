// Stub for signal-backtesting module
// TODO: Implement full signal backtesting logic

export interface SignalBacktester {
  run(params: Record<string, unknown>): Promise<{
    signals: unknown[];
    summary: Record<string, unknown>;
  }>;
  dispose(): void;
}

let instance: SignalBacktester | null = null;

export function getSignalBacktester(): SignalBacktester {
  if (!instance) {
    instance = {
      async run(params) {
        console.warn('[signal-backtesting] Stub implementation, returning empty results');
        return { signals: [], summary: { total: 0, passRate: 0 } };
      },
      dispose() {
        instance = null;
      },
    };
  }
  return instance;
}
