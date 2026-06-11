// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import BrokerConfigSelector from '../components/settings/BrokerConfigSelector';

const meta: Meta<typeof BrokerConfigSelector> = {
  title: 'Settings/BrokerConfigSelector',
  component: BrokerConfigSelector,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof BrokerConfigSelector>;

export const Default: Story = {};
