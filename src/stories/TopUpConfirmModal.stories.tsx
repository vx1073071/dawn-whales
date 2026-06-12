// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import TopUpConfirmModal from '../components/billing/TopUpConfirmModal';

const meta: Meta<typeof TopUpConfirmModal> = {
  title: 'Billing/TopUpConfirmModal',
  component: TopUpConfirmModal,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof TopUpConfirmModal>;

export const Default: Story = { args: { amount: 100, currency: 'CNY', rate: 0.138, estimatedUSDT: 13.8, rateSource: 'Binance', onConfirm: () => {}, onCancel: () => {} } };
