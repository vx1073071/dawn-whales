import type { Meta, StoryObj } from '@storybook/react';
import DataQualityPage from '../components/data/DataQualityPage';

const meta: Meta<typeof DataQualityPage> = {
  title: 'Data/QualityPage',
  component: DataQualityPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof DataQualityPage>;

export const Default: Story = {};
