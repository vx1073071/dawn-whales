// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import OnboardingFullKit from '../components/onboarding/OnboardingFullKit';

const meta: Meta<typeof OnboardingFullKit> = {
  title: 'Onboarding/FullKit',
  component: OnboardingFullKit,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof OnboardingFullKit>;

export const Default: Story = {};
