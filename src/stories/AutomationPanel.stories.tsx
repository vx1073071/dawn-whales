// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import AutomationPanel from '../components/trading/AutomationPanel';

const meta: Meta<typeof AutomationPanel> = {
  title: 'Trading/AutomationPanel',
  component: AutomationPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AutomationPanel>;

export const Default: Story = {};
export const WithRules: Story = {};
