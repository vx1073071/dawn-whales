import type { Meta, StoryObj } from '@storybook/react';
import FactorExposurePage from '../components/analysis/FactorExposurePage';

const meta: Meta<typeof FactorExposurePage> = {
  title: 'Analysis/FactorExposure',
  component: FactorExposurePage,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof FactorExposurePage>;

export const Default: Story = {};
