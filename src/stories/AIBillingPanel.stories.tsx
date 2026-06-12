// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import AIBillingPanel from '../components/billing/ai/AIBillingPanel';

const meta: Meta<typeof AIBillingPanel> = {
  title: 'Billing/AIBillingPanel',
  component: AIBillingPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'AI billing management with usage tracking, quota monitoring, payment history, and subscription plans.',
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

export const FreeTier: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Free tier user with limited AI quota.',
      },
    },
  },
};

export const PremiumTier: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: 'Premium tier user with extended AI capabilities.',
      },
    },
  },
};
