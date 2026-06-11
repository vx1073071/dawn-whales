import type { Meta, StoryObj } from '@storybook/react';
import DeadLetterPanel from '../pages/Admin/DeadLetterPanel';

const meta: Meta<typeof DeadLetterPanel> = {
  title: 'Admin/DeadLetterPanel',
  component: DeadLetterPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof DeadLetterPanel>;

export const Default: Story = {};
export const WithFiltered: Story = {};
export const WithSelection: Story = {};
