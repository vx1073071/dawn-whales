// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import AIAdvisorPage from '../components/ai/AIAdvisorPage';

const meta: Meta<typeof AIAdvisorPage> = {
  title: 'AI/AdvisorPage',
  component: AIAdvisorPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AIAdvisorPage>;

export const Default: Story = {};
