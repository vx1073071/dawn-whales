// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { FormCreator } from '../components/strategy/StrategyPage/FormCreator';

const meta: Meta<typeof FormCreator> = {
  title: 'Strategy/Page/FormCreator',
  component: FormCreator,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof FormCreator>;

export const CreateNew: Story = { args: { onBack: () => {}, onCreated: () => {} } };
export const EditExisting: Story = { args: { onBack: () => {}, onCreated: () => {}, editId: 's1' } };
export const WithNLPrefill: Story = {
  args: {
    onBack: () => {}, onCreated: () => {},
    nlPrefill: { success: true, name: 'MA Cross', description: '50/200 MA crossover', strategy: { type: 'MA_CROSS', params: { fast: 50, slow: 200 } } },
  },
};
