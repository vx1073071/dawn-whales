// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import MonteCarloPage from '../components/backtest/MonteCarloPage';

const meta: Meta<typeof MonteCarloPage> = {
  title: 'Backtest/MonteCarlo',
  component: MonteCarloPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof MonteCarloPage>;

export const Default: Story = {};
