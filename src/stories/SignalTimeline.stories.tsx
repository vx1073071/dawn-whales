// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import SignalTimeline from '../components/risk/SignalTimeline';

const meta: Meta<typeof SignalTimeline> = {
  title: 'Trading/SignalTimeline',
  component: SignalTimeline,
  tags: ['autodocs'],
  argTypes: {
    strategyId: { control: 'text' },
    maxItems: { control: { type: 'range', min: 5, max: 100 } },
    autoRefresh: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof SignalTimeline>;

export const Default: Story = {
  args: {
    strategyId: 'demo-strategy-001',
    maxItems: 20,
    autoRefresh: false,
  },
};

export const NoAutoRefresh: Story = {
  args: {
    strategyId: 'all',
    maxItems: 50,
    autoRefresh: false,
  },
};
