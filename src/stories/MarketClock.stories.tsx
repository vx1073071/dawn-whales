// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import MarketClock from '../components/risk/MarketClock';

const meta: Meta<typeof MarketClock> = {
  title: 'Market/MarketClock',
  component: MarketClock,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MarketClock>;

export const Default: Story = {
  render: () => <MarketClock />,
};
