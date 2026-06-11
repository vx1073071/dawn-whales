import type { Meta, StoryObj } from '@storybook/react';
import BacktestReportPage from '../components/backtest/BacktestReportPage';

const meta: Meta<typeof BacktestReportPage> = {
  title: 'Backtest/ReportPage',
  component: BacktestReportPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Comprehensive backtest report with equity curve, drawdown analysis, trade statistics, and performance metrics.',
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

export const ProfitableStrategy: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Profitable strategy with positive returns and controlled drawdown.',
      },
    },
  },
};

export const LosingStrategy: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Losing strategy showing risk metrics and drawdown patterns.',
      },
    },
  },
};
