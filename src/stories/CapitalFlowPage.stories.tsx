// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import CapitalFlowPage from '../components/market/CapitalFlowPage';

const meta: Meta<typeof CapitalFlowPage> = {
  title: 'Market/CapitalFlowPage',
  component: CapitalFlowPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Capital flow analysis with sector rotation, stock-level flow tracking, and institutional activity monitoring.',
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

export const BullMarket: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Bull market scenario with strong capital inflows.',
      },
    },
  },
};

export const BearMarket: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Bear market scenario with capital outflows and defensive positioning.',
      },
    },
  },
};
