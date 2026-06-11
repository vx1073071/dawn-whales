import type { Meta, StoryObj } from '@storybook/react';
import CreditsDashboard from '../components/billing/CreditsDashboard';

const meta: Meta<typeof CreditsDashboard> = {
  title: 'Billing/CreditsDashboard',
  component: CreditsDashboard,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof CreditsDashboard>;

export const WithBalance: Story = { args: { todayEarnings: 12.3456, monthEarnings: 234.5678, cumulativeEarnings: 1234.5678, totalFees: 5.0, tierSplit: { L1: 0.7, L2: 0.8, L3: 0.9 }, dailyEarnings: [1, 2, 0.5, 3, 1.5, 2.5, 1.8] } };
export const Empty: Story = { args: { todayEarnings: 0, monthEarnings: 0, cumulativeEarnings: 0, totalFees: 0, tierSplit: { L1: 0, L2: 0, L3: 0 }, dailyEarnings: [0, 0, 0, 0, 0, 0, 0] } };
export const Loading: Story = { args: { loading: true } };
