import type { Meta, StoryObj } from '@storybook/react';
import AIAssistantPanel from '../components/ai/AIAssistantPanel';

const meta: Meta<typeof AIAssistantPanel> = {
  title: 'AI/AssistantPanel',
  component: AIAssistantPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AIAssistantPanel>;

export const Default: Story = {};
