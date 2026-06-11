// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import AgentDataSourcePanel from '../components/agent/AgentDataSourcePanel';

const meta: Meta<typeof AgentDataSourcePanel> = {
  title: 'Agent/DataSourcePanel',
  component: AgentDataSourcePanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AgentDataSourcePanel>;

export const Default: Story = {};
