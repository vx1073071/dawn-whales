// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import DataExportPage from '../components/data/DataExportPage';

const meta: Meta<typeof DataExportPage> = {
  title: 'Data/ExportPage',
  component: DataExportPage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof DataExportPage>;

export const Default: Story = {};
