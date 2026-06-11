import type { Meta, StoryObj } from '@storybook/react';
import StrategyExplainCard from '../components/strategy/StrategyExplainCard';

const meta: Meta<typeof StrategyExplainCard> = {
  title: 'Strategy/StrategyExplainCard',
  component: StrategyExplainCard,
  tags: ['autodocs'],
  argTypes: {
    strategy: { control: 'object' },
    onExplain: { action: 'explain' },
  },
};
export default meta;
type Story = StoryObj<typeof StrategyExplainCard>;

export const TrendFollowing: Story = {
  args: {
    strategy: {
      id: 'trend-001',
      name: 'MA Cross Strategy',
      type: 'trend-following',
      description: 'Buy when MA5 crosses above MA20, sell when it crosses below.',
      indicators: ['MA5', 'MA20', 'RSI'],
      params: { maFast: 5, maSlow: 20, rsiOverbought: 70, rsiOversold: 30 },
      backtest: { totalReturn: 0.245, sharpe: 1.12, maxDrawdown: -0.15, winRate: 0.58 },
    },
    onExplain: (explanation: string) => alert(explanation),
  },
};

export const MeanReversion: Story = {
  args: {
    strategy: {
      id: 'mr-001',
      name: 'Bollinger Mean Reversion',
      type: 'mean-reversion',
      description: 'Buy at lower Bollinger Band, sell at upper band.',
      indicators: ['BB(20,2)', 'RSI'],
      params: { bbPeriod: 20, bbStdDev: 2, rsiThreshold: 30 },
      backtest: { totalReturn: 0.18, sharpe: 0.95, maxDrawdown: -0.12, winRate: 0.62 },
    },
    onExplain: (explanation: string) => alert(explanation),
  },
};

export const MinimalStrategy: Story = {
  args: {
    strategy: {
      id: 'simple-001',
      name: 'Simple RSI',
      type: 'oscillator',
      params: { rsiPeriod: 14 },
    },
    onExplain: (explanation: string) => alert(explanation),
  },
};
