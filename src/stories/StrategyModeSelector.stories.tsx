// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { ModeSelector } from '../components/strategy/StrategyPage/ModeSelector';

const meta: Meta<typeof ModeSelector> = {
  title: 'Strategy/Page/ModeSelector',
  component: ModeSelector,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ModeSelector>;

export const Default: Story = { args: { onSelect: (m: any) => console.log('Selected:', m) } };
