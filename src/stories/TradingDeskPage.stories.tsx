import type { Meta, StoryObj } from '@storybook/react';
import TradingDeskPage from '../components/trading/TradingDeskPage';

const meta: Meta<typeof TradingDeskPage> = {
  title: 'Trading/DeskPage',
  component: TradingDeskPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof TradingDeskPage>;

export const Default: Story = {};
