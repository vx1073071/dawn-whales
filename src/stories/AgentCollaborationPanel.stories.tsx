// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import AgentCollaborationPanel from '../components/agent/AgentCollaborationPanel';

const meta: Meta<typeof AgentCollaborationPanel> = {
  title: 'Agent/CollaborationPanel',
  component: AgentCollaborationPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AgentCollaborationPanel>;

export const Default: Story = {};
