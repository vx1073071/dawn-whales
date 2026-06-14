// R161 ML: Updated to match new MyStrategies props
import type { Meta, StoryObj } from '@storybook/react';
import { MyStrategies } from '../components/strategy/StrategyPage/MyStrategies';

const mockStrategies = [
  { id: 's1', name: 'MA Cross Gold', category: 'momentum', description: '50/200 day moving average crossover', status: 'running', createdAt: Date.now() - 86400000 * 7, tags: ['MA', 'trend'], totalReturn: 0.42, sharpeRatio: 1.8 },
  { id: 's2', name: 'RSI Oversold', category: 'mean_reversion', description: 'RSI < 30 entry strategy', status: 'draft', createdAt: Date.now() - 86400000 * 2, tags: ['RSI'], totalReturn: 0.15, sharpeRatio: 0.9 },
  { id: 's3', name: 'Bollinger Breakout', category: 'breakout', description: 'Bollinger band squeeze breakout', status: 'stopped', createdAt: Date.now() - 86400000 * 30, tags: ['Bollinger', 'volatility'], totalReturn: -0.08, sharpeRatio: -0.3 },
];

const meta: Meta<typeof MyStrategies> = {
  title: 'Strategy/Page/MyStrategies',
  component: MyStrategies,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MyStrategies>;

export const WithStrategies: Story = {
  args: {
    strategies: mockStrategies,
    onSelect: (id: string) => console.log('Select:', id),
    onEdit: (id: string) => console.log('Edit:', id),
    onDelete: (id: string) => console.log('Delete:', id),
    onCompare: (s: any) => console.log('Compare:', s.name),
  },
};
export const Empty: Story = {
  args: { strategies: [], onSelect: () => {}, onEdit: () => {}, onDelete: () => {}, onCompare: () => {} },
};
