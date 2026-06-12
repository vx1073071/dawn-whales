// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import RiskDashboardPage from '../components/risk/RiskDashboardPage';

const meta: Meta<typeof RiskDashboardPage> = {
  title: 'Risk/DashboardPage',
  component: RiskDashboardPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Comprehensive risk dashboard with VaR, drawdown, volatility metrics, correlation matrix, and stress test results.',
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

export const HighRisk: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'High-risk portfolio with elevated VaR and drawdown.',
      },
    },
  },
};

export const LowRisk: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Conservative portfolio with controlled risk metrics.',
      },
    },
  },
};
