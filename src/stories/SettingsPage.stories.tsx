import type { Meta, StoryObj } from '@storybook/react';
import SettingsPage from '../components/settings/SettingsPage';

const meta: Meta<typeof SettingsPage> = {
  title: 'Settings/SettingsPage',
  component: SettingsPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Application settings with MCP configuration, broker connections, risk parameters, and user preferences.',
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

export const MCPConfig: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'MCP (Model Context Protocol) configuration panel.',
      },
    },
  },
};

export const BrokerSettings: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Broker connection and API configuration.',
      },
    },
  },
};
