// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import TradingJournal from '../components/risk/TradingJournal';

const meta: Meta<typeof TradingJournal> = {
  title: 'Trading/TradingJournal',
  component: TradingJournal,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof TradingJournal>;

export const Default: Story = {
  render: () => <TradingJournal />,
};
