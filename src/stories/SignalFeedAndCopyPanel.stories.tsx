import type { Meta, StoryObj } from '@storybook/react';
import SignalFeedAndCopyPanel from '../components/trading/SignalFeedAndCopyPanel';

const meta: Meta<typeof SignalFeedAndCopyPanel> = {
  title: 'Trading/SignalFeed',
  component: SignalFeedAndCopyPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SignalFeedAndCopyPanel>;

export const Default: Story = {};
