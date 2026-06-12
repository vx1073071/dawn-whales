// R127-Q01: nocheck cleared — R107 pre-existing stories
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
