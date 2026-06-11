// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import NotificationCenter from '../components/risk/NotificationCenter';

const meta: Meta<typeof NotificationCenter> = {
  title: 'Common/NotificationCenter',
  component: NotificationCenter,
  tags: ['autodocs'],
  argTypes: {
    notifications: { control: 'object' },
    onClear: { action: 'clear' },
    onMarkRead: { action: 'markRead' },
  },
};
export default meta;
type Story = StoryObj<typeof NotificationCenter>;

const mockNotifications = [
  {
    id: 'n1',
    type: 'risk' as const,
    title: 'Daily Loss Limit Warning',
    message: 'Portfolio has reached 80% of daily loss limit (-$4,000 / -$5,000)',
    timestamp: Date.now() - 60000,
    read: false,
    severity: 'warning' as const,
  },
  {
    id: 'n2',
    type: 'order' as const,
    title: 'Order Filled',
    message: 'BUY 100 AAPL @ $187.50 filled successfully',
    timestamp: Date.now() - 300000,
    read: false,
    severity: 'info' as const,
  },
  {
    id: 'n3',
    type: 'signal' as const,
    title: 'New Signal: TSLA',
    message: 'MA5 crossed above MA20 — BUY signal triggered',
    timestamp: Date.now() - 600000,
    read: true,
    severity: 'info' as const,
  },
  {
    id: 'n4',
    type: 'system' as const,
    title: 'Connection Lost',
    message: 'Futu OpenD connection dropped. Attempting reconnect...',
    timestamp: Date.now() - 900000,
    read: true,
    severity: 'critical' as const,
  },
  {
    id: 'n5',
    type: 'market' as const,
    title: 'Market Close',
    message: 'US markets closing in 30 minutes',
    timestamp: Date.now() - 1200000,
    read: true,
    severity: 'info' as const,
  },
];

export const WithNotifications: Story = {
  args: {
    notifications: mockNotifications,
    onClear: () => console.log('Clear all'),
    onMarkRead: (id: string) => console.log('Mark read:', id),
  },
};

export const Empty: Story = {
  args: {
    notifications: [],
    onClear: () => {},
    onMarkRead: () => {},
  },
};

export const AllUnread: Story = {
  args: {
    notifications: mockNotifications.map(n => ({ ...n, read: false })),
    onClear: () => console.log('Clear all'),
    onMarkRead: (id: string) => console.log('Mark read:', id),
  },
};

export const CriticalOnly: Story = {
  args: {
    notifications: mockNotifications.filter(n => n.severity === 'critical'),
    onClear: () => console.log('Clear all'),
    onMarkRead: (id: string) => console.log('Mark read:', id),
  },
};
