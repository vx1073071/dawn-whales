import type { Meta, StoryObj } from '@storybook/react';
import GreeksPanel from '../components/live/GreeksPanel';

const meta: Meta<typeof GreeksPanel> = {
  title: 'Live/GreeksPanel',
  component: GreeksPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Real-time options Greeks monitoring with Delta, Gamma, Theta, Vega, and Rho visualization.',
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

export const HighVolatility: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'High volatility scenario with elevated Vega and Gamma.',
      },
    },
  },
};

export const NearExpiry: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Near expiry scenario with accelerated Theta decay.',
      },
    },
  },
};
