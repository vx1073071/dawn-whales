// @ts-nocheck — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { TemplateBrowser } from '../components/strategy/StrategyPage/TemplateBrowser';

const meta: Meta<typeof TemplateBrowser> = {
  title: 'Strategy/Page/TemplateBrowser',
  component: TemplateBrowser,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof TemplateBrowser>;

export const Default: Story = { args: { onBack: () => {}, onCreated: () => {} } };
