import type { Meta, StoryObj } from '@storybook/react';
import { BacktestPanel } from '../components/strategy/StrategyPage/BacktestPanel';

const mockResult = {
  totalReturn: 42.5, annualReturn: 15.3, sharpeRatio: 1.8, maxDrawdown: 12.4,
  winRate: 68, profitFactor: 2.1, totalTrades: 156,
  equityCurve: Array.from({ length: 100 }, (_, i) => ({ time: Date.now() - (100 - i) * 86400000, value: 100000 + Math.random() * 50000 })),
  trades: [],
};

const meta: Meta<typeof BacktestPanel> = {
  title: 'Strategy/Page/BacktestPanel',
  component: BacktestPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof BacktestPanel>;

export const PositiveResult: Story = { args: { result: mockResult } };
export const NegativeResult: Story = {
  args: {
    result: { ...mockResult, totalReturn: -15.2, annualReturn: -5.1, sharpeRatio: -0.3, maxDrawdown: 35, winRate: 42, profitFactor: 0.7 },
  },
};
