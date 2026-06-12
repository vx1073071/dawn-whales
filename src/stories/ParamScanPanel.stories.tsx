// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import ParamScanPanel from '../components/backtest/ParamScanPanel';

const meta: Meta<typeof ParamScanPanel> = {
  title: 'Backtest/ParamScanPanel',
  component: ParamScanPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Parameter scanning and sensitivity analysis with heatmap visualization and optimal parameter identification.',
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

export const TwoParameters: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Two-parameter scan showing interaction effects.',
      },
    },
  },
};

export const MultiParameter: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Multi-parameter scan with dimensionality reduction.',
      },
    },
  },
};
