// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import SettlementTimeline from '../components/billing/SettlementTimeline';

const meta: Meta<typeof SettlementTimeline> = {
  title: 'Billing/SettlementTimeline',
  component: SettlementTimeline,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SettlementTimeline>;

export const All: Story = {};
export const IncomeOnly: Story = { args: { filter: 'income' } };
export const ExpenseOnly: Story = { args: { filter: 'expense' } };
export const FeeOnly: Story = { args: { filter: 'fee' } };
export const Empty: Story = { args: { transactions: [] } };
