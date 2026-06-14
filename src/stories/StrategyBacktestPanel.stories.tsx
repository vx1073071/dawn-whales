// R161 ML: Updated to match new BacktestPanel props (strategyId + onBack)
import type { Meta, StoryObj } from '@storybook/react';
import { BacktestPanel } from '../components/strategy/StrategyPage/BacktestPanel';

const meta: Meta<typeof BacktestPanel> = {
  title: 'Strategy/Page/BacktestPanel',
  component: BacktestPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof BacktestPanel>;

export const Default: Story = {
  args: { strategyId: 'bt-demo-001', strategyName: 'MACD Dual MA', onBack: () => {} },
};
