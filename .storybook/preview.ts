import type { Preview } from '@storybook/react';
import React from 'react';

// Mock react-i18next for components that use useTranslation
const mockI18n = {
  t: (key: string) => key.split('.').pop() || key,
  i18n: { changeLanguage: () => Promise.resolve(), language: 'en' },
};

// Mock window.electronAPI for IPC-dependent components
(globalThis as any).window = globalThis;
(globalThis as any).window.electronAPI = {
  getWatchlist: async () => ['AAPL', 'TSLA', 'NVDA', '03416', '07552'],
  getQuote: async (code: string) => ({ code, price: 150 + Math.random() * 50, change: (Math.random() - 0.5) * 5, changePct: (Math.random() - 0.5) * 3 }),
  getBrokerStatus: async () => ([
    { id: 'futu', name: 'Futu OpenD', type: 'futu', connected: true, accountCount: 2 },
    { id: 'ibkr', name: 'IBKR TWS', type: 'ibkr', connected: false, accountCount: 1, lastError: 'Connection refused' },
  ]),
  getSignals: async () => [],
  getOrders: async () => [],
  getPortfolio: async () => ({ totalValue: 1500000, positions: [] }),
  getNotifications: async () => [],
  getSystemInfo: async () => ({ memoryUsed: 512, memoryTotal: 1024, cpuUsage: 15, uptime: 3600 }),
  placeOrder: async () => ({ success: true, orderId: 'mock-001' }),
  onSignal: () => () => {},
  onOrderUpdate: () => () => {},
  onNotification: () => () => {},
};

// Mock react-i18next module
const mockReactI18next = {
  useTranslation: () => mockI18n,
  initReactI18next: { type: '3rdParty', init: () => {} },
};

// Register module mock via vite resolve
(globalThis as any).__mocks = { 'react-i18next': mockReactI18next };

/** Global dark background for Dawn Whales theme */
const DawnWhalesTheme = ({ children, theme }: { children: React.ReactNode; theme: string }) => {
  const bg = theme === 'light' ? '#F9FAFB' : '#0B0E14';
  return React.createElement('div', {
    style: {
      background: bg,
      minHeight: '100vh',
      padding: '24px',
      color: theme === 'light' ? '#111827' : '#F9FAFB',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
  }, children);
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0B0E14' },
        { name: 'light', value: '#F9FAFB' },
        { name: 'card-dark', value: '#111827' },
        { name: 'card-light', value: '#FFFFFF' },
      ],
    },
    layout: 'centered',
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Dawn Whales dark/light theme',
      defaultValue: 'dark',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'dark', icon: 'moon', title: 'Dark' },
          { value: 'light', icon: 'sun', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'dark';
      return React.createElement(DawnWhalesTheme, { theme }, React.createElement(Story));
    },
  ],
};

export default preview;
