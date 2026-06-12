// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import StatusBar from '../components/layout/StatusBar';

const meta: Meta<typeof StatusBar> = {
  title: 'Layout/StatusBar',
  component: StatusBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof StatusBar>;

export const Default: Story = {
  render: () => <StatusBar />,
};
