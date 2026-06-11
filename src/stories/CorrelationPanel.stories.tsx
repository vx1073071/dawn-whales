// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import CorrelationPanel from '../components/strategy/CorrelationPanel';

const meta: Meta<typeof CorrelationPanel> = {
  title: 'Strategy/CorrelationPanel',
  component: CorrelationPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Asset correlation matrix visualization with heatmap and clustering analysis.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const HighCorrelation: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'High correlation scenario - assets move together.',
      },
    },
  },
};

export const LowCorrelation: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Low correlation scenario - diversified portfolio.',
      },
    },
  },
};
