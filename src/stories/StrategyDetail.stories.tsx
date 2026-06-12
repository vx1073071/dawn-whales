// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { StrategyDetail } from '../components/strategy/StrategyPage/StrategyDetail';

const meta: Meta<typeof StrategyDetail> = {
  title: 'Strategy/Page/StrategyDetail',
  component: StrategyDetail,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof StrategyDetail>;

export const Default: Story = { args: { strategyId: 's1', onBack: () => {}, onRefresh: () => {} } };
