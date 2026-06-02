import { create } from 'zustand';
import type { Strategy, StrategyStatus, BacktestResult } from '@/lib/types';

interface StrategyStore {
  strategies: Strategy[];
  activeStrategyId: string | null;
  backtestResults: Record<string, BacktestResult[]>;

  addStrategy: (s: Strategy) => void;
  updateStrategy: (id: string, patch: Partial<Strategy>) => void;
  removeStrategy: (id: string) => void;
  setActive: (id: string | null) => void;
  setStatus: (id: string, status: StrategyStatus) => void;
  addBacktestResult: (strategyId: string, result: BacktestResult) => void;
}

export const useStrategyStore = create<StrategyStore>((set) => ({
  strategies: [],
  activeStrategyId: null,
  backtestResults: {},

  addStrategy: (s) => set((state) => ({ strategies: [...state.strategies, s] })),
  updateStrategy: (id, patch) =>
    set((state) => ({
      strategies: state.strategies.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)),
    })),
  removeStrategy: (id) =>
    set((state) => ({ strategies: state.strategies.filter((s) => s.id !== id) })),
  setActive: (id) => set({ activeStrategyId: id }),
  setStatus: (id, status) =>
    set((state) => ({
      strategies: state.strategies.map((s) => (s.id === id ? { ...s, status } : s)),
    })),
  addBacktestResult: (strategyId, result) =>
    set((state) => ({
      backtestResults: {
        ...state.backtestResults,
        [strategyId]: [...(state.backtestResults[strategyId] || []), result],
      },
    })),
}));
