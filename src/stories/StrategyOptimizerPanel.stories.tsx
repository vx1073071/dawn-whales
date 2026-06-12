// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import StrategyOptimizerPanel from '../components/strategy/StrategyOptimizerPanel';

const meta: Meta<typeof StrategyOptimizerPanel> = {
  title: 'Strategy/OptimizerPanel',
  component: StrategyOptimizerPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Multi-objective strategy optimization with Grid/Random/Bayesian modes, parameter importance, convergence trajectory, and Pareto front.',
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

export const GridMode: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Grid search optimization mode - exhaustively searches parameter space.',
      },
    },
  },
};

export const BayesianMode: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Bayesian optimization mode - intelligent parameter space exploration.',
      },
    },
  },
};
