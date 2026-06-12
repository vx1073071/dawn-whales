// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { MyStrategies } from '../components/strategy/StrategyPage/MyStrategies';

const mockStrategies = [
  { id: 's1', name: 'MA Cross Gold', type: 'MA_CROSS', description: '50/200 day moving average crossover', status: 'active', createdAt: Date.now() - 86400000 * 7 },
  { id: 's2', name: 'RSI Oversold', type: 'RSI', description: 'RSI < 30 entry strategy', status: 'draft', createdAt: Date.now() - 86400000 * 2 },
  { id: 's3', name: 'Bollinger Breakout', type: 'BOLLINGER', description: 'Bollinger band squeeze breakout', status: 'stopped', createdAt: Date.now() - 86400000 * 30 },
];

const meta: Meta<typeof MyStrategies> = {
  title: 'Strategy/Page/MyStrategies',
  component: MyStrategies,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MyStrategies>;

export const WithStrategies: Story = { args: { strategies: mockStrategies, onSelect: (id: any) => console.log('Select:', id), onEdit: (id: any) => console.log('Edit:', id), onDelete: (id: any) => console.log('Delete:', id), onCompare: (s: any) => console.log('Compare:', s.name) } };
export const Empty: Story = { args: { strategies: [], onSelect: () => {}, onEdit: () => {}, onDelete: () => {}, onCompare: () => {} } };
