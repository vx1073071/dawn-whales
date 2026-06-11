import type { Meta, StoryObj } from '@storybook/react';
import SentimentDashboardPage from '../components/market/SentimentDashboardPage';

const meta: Meta<typeof SentimentDashboardPage> = {
  title: 'Market/SentimentDashboard',
  component: SentimentDashboardPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof SentimentDashboardPage>;

export const Default: Story = {};
