import type { Meta, StoryObj } from '@storybook/react';
import WatchlistManager from '../components/risk/WatchlistManager';

const meta: Meta<typeof WatchlistManager> = {
  title: 'Market/WatchlistManager',
  component: WatchlistManager,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof WatchlistManager>;

export const Default: Story = {
  render: () => <WatchlistManager />,
};
