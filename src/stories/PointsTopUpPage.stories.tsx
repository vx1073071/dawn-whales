import type { Meta, StoryObj } from '@storybook/react';
import PointsTopUpPage from '../components/billing/PointsTopUpPage';

const meta: Meta<typeof PointsTopUpPage> = {
  title: 'Billing/PointsTopUpPage',
  component: PointsTopUpPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof PointsTopUpPage>;

export const Default: Story = {};
export const WithBalance: Story = { args: { balance: 100.5 } };
export const Empty: Story = { args: { balance: 0 } };
