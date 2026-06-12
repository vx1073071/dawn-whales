// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import QuickTrade from '../components/risk/QuickTrade';

const meta: Meta<typeof QuickTrade> = {
  title: 'Trading/QuickTrade',
  component: QuickTrade,
  tags: ['autodocs'],
  argTypes: {
    onPlaceOrder: { action: 'placeOrder' },
  },
};
export default meta;
type Story = StoryObj<typeof QuickTrade>;

export const Default: Story = {
  args: {
    onPlaceOrder: (order) => {
      alert(`Order: ${order.side} ${order.qty} x ${order.code} @ ${order.price}`);
    },
  },
};
