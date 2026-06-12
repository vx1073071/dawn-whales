// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import StrategyMarketplace from '../components/strategy/StrategyMarketplace';

const meta: Meta<typeof StrategyMarketplace> = {
  title: 'Strategy/Marketplace',
  component: StrategyMarketplace,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof StrategyMarketplace>;

export const Default: Story = {};
