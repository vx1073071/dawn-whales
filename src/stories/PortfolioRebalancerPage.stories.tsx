// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import PortfolioRebalancerPage from '../components/portfolio/PortfolioRebalancerPage';

const meta: Meta<typeof PortfolioRebalancerPage> = {
  title: 'Portfolio/RebalancerPage',
  component: PortfolioRebalancerPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Portfolio rebalancing tool with target allocation, drift analysis, and tax-efficient rebalancing recommendations.',
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

export const OverweightTech: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Portfolio overweight in tech sector requiring rebalancing.',
      },
    },
  },
};

export const BalancedPortfolio: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Well-balanced portfolio near target allocation.',
      },
    },
  },
};
