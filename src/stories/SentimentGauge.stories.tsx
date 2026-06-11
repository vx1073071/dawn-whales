import type { Meta, StoryObj } from '@storybook/react';
import SentimentGauge from '../components/risk/SentimentGauge';

const meta: Meta<typeof SentimentGauge> = {
  title: 'Market/SentimentGauge',
  component: SentimentGauge,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SentimentGauge>;

export const Default: Story = {
  render: () => <SentimentGauge />,
};
