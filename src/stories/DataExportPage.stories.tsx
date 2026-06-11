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
