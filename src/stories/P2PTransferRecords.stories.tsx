// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import P2PTransferRecords from '../components/billing/P2PTransferRecords';

const meta: Meta<typeof P2PTransferRecords> = {
  title: 'Billing/P2PTransferRecords',
  component: P2PTransferRecords,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof P2PTransferRecords>;

export const WithTransfers: Story = {};
export const Empty: Story = { args: { transfers: [] } };
export const SentOnly: Story = { args: { filter: 'sent' } };
export const ReceivedOnly: Story = { args: { filter: 'received' } };
