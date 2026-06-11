import type { Meta, StoryObj } from '@storybook/react';
import PerformanceMonitorPanel from '../components/dashboard/PerformanceMonitorPanel';

const meta: Meta<typeof PerformanceMonitorPanel> = {
  title: 'Dashboard/PerformanceMonitor',
  component: PerformanceMonitorPanel,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof PerformanceMonitorPanel>;

export const Default: Story = {};
export const NoData: Story = { args: {} };
