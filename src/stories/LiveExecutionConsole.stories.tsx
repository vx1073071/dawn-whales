// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import LiveExecutionConsole from '../components/trading/LiveExecutionConsole';

const meta: Meta<typeof LiveExecutionConsole> = {
  title: 'Trading/LiveExecution',
  component: LiveExecutionConsole,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof LiveExecutionConsole>;

export const Default: Story = {};
