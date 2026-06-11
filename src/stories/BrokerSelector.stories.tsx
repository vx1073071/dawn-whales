// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import BrokerSelector from '../components/layout/BrokerSelector';

const meta: Meta<typeof BrokerSelector> = {
  title: 'Layout/BrokerSelector',
  component: BrokerSelector,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof BrokerSelector>;

export const Default: Story = {
  render: () => <BrokerSelector />,
};
