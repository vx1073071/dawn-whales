// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import LoadingSpinner from '../components/common/LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Common/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'range', min: 12, max: 80 } },
    label: { control: 'text' },
    center: { control: 'boolean' },
    fullscreen: { control: 'boolean' },
    color: { control: 'text' },
  },
};
export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Default: Story = {
  args: { size: 32, label: 'Loading...' },
};

export const Large: Story = {
  args: { size: 64, label: 'Processing...' },
};

export const NoLabel: Story = {
  args: { size: 40 },
};

export const Fullscreen: Story = {
  args: { size: 48, label: 'Connecting to broker...', fullscreen: true },
  parameters: { layout: 'fullscreen' },
};

export const Small: Story = {
  args: { size: 16, label: 'Fetching...', center: false },
};
