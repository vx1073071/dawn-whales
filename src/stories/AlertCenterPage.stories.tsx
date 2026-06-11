import type { Meta, StoryObj } from '@storybook/react';
import AlertCenterPage from '../components/dashboard/AlertCenterPage';

const meta: Meta<typeof AlertCenterPage> = {
  title: 'Dashboard/AlertCenter',
  component: AlertCenterPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AlertCenterPage>;

export const Default: Story = {};
