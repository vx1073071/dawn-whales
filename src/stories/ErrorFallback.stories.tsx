// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import ErrorFallback from '../components/common/ErrorFallback';

const meta: Meta<typeof ErrorFallback> = {
  title: 'Common/ErrorFallback',
  component: ErrorFallback,
  tags: ['autodocs'],
  argTypes: {
    severity: { control: 'select', options: ['error', 'warning', 'info'] },
    title: { control: 'text' },
    message: { control: 'text' },
    details: { control: 'text' },
    icon: { control: 'text' },
    showRetry: { control: 'boolean' },
    showHome: { control: 'boolean' },
    compact: { control: 'boolean' },
    onRetry: { action: 'retry' },
    onHome: { action: 'home' },
  },
};
export default meta;
type Story = StoryObj<typeof ErrorFallback>;

export const Default: Story = {
  args: {
    title: 'Something went wrong',
    message: 'Failed to load portfolio data. The broker connection timed out.',
    showRetry: true,
    onRetry: () => alert('Retrying...'),
  },
};

export const WithDetails: Story = {
  args: {
    title: 'API Error',
    message: 'The server returned an unexpected response.',
    details: 'Error: HTTP 500 Internal Server Error\n  at fetchPortfolio (api.ts:42)\n  at async loadData (hook.ts:18)\n  at async PortfolioPage (PortfolioPage.tsx:55)',
    showRetry: true,
    onRetry: () => alert('Retrying...'),
  },
};

export const Warning: Story = {
  args: {
    severity: 'warning',
    icon: '⚡',
    title: 'Connection unstable',
    message: 'Market data may be delayed. Auto-reconnect in progress.',
    showRetry: true,
    retryLabel: 'Reconnect now',
    onRetry: () => alert('Reconnecting...'),
  },
};

export const Info: Story = {
  args: {
    severity: 'info',
    icon: '🔧',
    title: 'Scheduled Maintenance',
    message: 'System will be down for 15 minutes for database optimization.',
    showRetry: false,
  },
};

export const WithHomeButton: Story = {
  args: {
    title: 'Page not found',
    message: 'The page you are looking for does not exist or has been moved.',
    icon: '🗺️',
    showRetry: true,
    retryLabel: 'Try again',
    showHome: true,
    homeLabel: 'Go Dashboard',
    onRetry: () => alert('Retry'),
    onHome: () => alert('Going home'),
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    title: 'Load failed',
    message: 'Could not fetch chart data.',
    showRetry: true,
    onRetry: () => alert('Retry'),
  },
};
