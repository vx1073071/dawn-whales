// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import EmptyState from '../components/common/EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Common/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    icon: { control: 'text' },
    title: { control: 'text' },
    description: { control: 'text' },
    actionLabel: { control: 'text' },
    secondaryLabel: { control: 'text' },
    variant: { control: 'select', options: ['default', 'compact', 'illustration'] },
    theme: { control: 'select', options: ['dark', 'light'] },
    onAction: { action: 'action' },
    onSecondaryAction: { action: 'secondary' },
  },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoStrategies: Story = {
  args: {
    icon: '🎯',
    title: 'No strategies yet',
    description: 'Create your first quantitative strategy using natural language, templates, or manual configuration.',
    actionLabel: 'Create Strategy',
    secondaryLabel: 'Browse Templates',
    onAction: () => alert('Create'),
    onSecondaryAction: () => alert('Templates'),
  },
};

export const NoOrders: Story = {
  args: {
    icon: '📦',
    title: 'No orders',
    description: 'Your order history is empty. Place a trade to get started.',
    actionLabel: 'Place Order',
    onAction: () => alert('Order'),
  },
};

export const NoSearchResults: Story = {
  args: {
    icon: '🔍',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters.',
  },
};

export const NoNotifications: Story = {
  args: {
    icon: '🔔',
    title: 'All caught up!',
    description: 'No new notifications at this time.',
    variant: 'compact',
  },
};

export const LightTheme: Story = {
  args: {
    icon: '📊',
    title: 'No chart data',
    description: 'Add a stock to your watchlist to see chart data here.',
    actionLabel: 'Add Stock',
    theme: 'light',
    onAction: () => alert('Add'),
  },
};

export const Compact: Story = {
  args: {
    icon: '💼',
    title: 'Portfolio empty',
    description: 'No positions held.',
    variant: 'compact',
    actionLabel: 'Buy',
    onAction: () => alert('Buy'),
  },
};
