// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import AccountSummary from '../components/dashboard/AccountSummary';

const meta: Meta<typeof AccountSummary> = {
  title: 'Dashboard/AccountSummary',
  component: AccountSummary,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AccountSummary>;

export const Default: Story = {};
