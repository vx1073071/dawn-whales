// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { AICreator } from '../components/strategy/StrategyPage/AICreator';

const meta: Meta<typeof AICreator> = {
  title: 'Strategy/Page/AICreator',
  component: AICreator,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AICreator>;

export const Default: Story = { args: { onBack: () => {}, onCreated: () => {}, onFillForm: (parsed) => console.log('Fill form:', parsed) } };
