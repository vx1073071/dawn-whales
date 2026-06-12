// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import GlobalLoading from '../components/common/GlobalLoading';

const meta: Meta<typeof GlobalLoading> = {
  title: 'Common/GlobalLoading',
  component: GlobalLoading,
  tags: ['autodocs'],
  argTypes: {
    mode: { control: 'select', options: ['overlay', 'inline', 'skeleton'] },
    text: { control: 'text' },
    skeletonRows: { control: { type: 'range', min: 1, max: 20 } },
    size: { control: { type: 'range', min: 16, max: 80 } },
  },
};
export default meta;
type Story = StoryObj<typeof GlobalLoading>;

export const Inline: Story = {
  args: { mode: 'inline', text: 'Loading data...', size: 40 },
};

export const Overlay: Story = {
  args: { mode: 'overlay', text: 'Processing transaction...', size: 48 },
  parameters: { layout: 'fullscreen' },
};

export const Skeleton: Story = {
  args: { mode: 'skeleton', skeletonRows: 8 },
};

export const NoText: Story = {
  args: { mode: 'inline', size: 60 },
};

export const SmallSpinner: Story = {
  args: { mode: 'inline', text: 'Fetching quotes...', size: 20 },
};
