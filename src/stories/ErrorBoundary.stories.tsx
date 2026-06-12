// R127-Q01: nocheck cleared — R107 pre-existing stories
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import ErrorBoundary from '../components/common/ErrorBoundary';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Common/ErrorBoundary',
  component: ErrorBoundary,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

function BrokenComponent(): JSX.Element {
  throw new Error('Simulated crash: Cannot read property "data" of undefined');
}

function RecoverableComponent({ onReset: _onReset }: { onReset?: () => void }) {
  const [crashed, setCrashed] = useState(false);
  if (crashed) throw new Error('Temporary failure');
  return (
    <div style={{ padding: 20 }}>
      <p style={{ color: '#10B981' }}>✅ Component is working fine</p>
      <button onClick={() => setCrashed(true)} style={{ marginTop: 8, padding: '6px 16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Simulate Crash
      </button>
    </div>
  );
}

export const HealthyChild: Story = {
  render: () => (
    <ErrorBoundary>
      <div style={{ padding: 20, color: '#10B981' }}>✅ Everything is working perfectly!</div>
    </ErrorBoundary>
  ),
};

export const CrashedWithDefaultFallback: Story = {
  render: () => (
    <ErrorBoundary>
      <BrokenComponent />
    </ErrorBoundary>
  ),
};

export const CrashedWithCustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <div style={{ padding: 24, background: '#1C1017', border: '1px solid #7F1D1D', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>💥</div>
          <h3 style={{ color: '#EF4444' }}>Custom Error UI</h3>
          <p style={{ color: '#9CA3AF', fontSize: 13 }}>This is a custom fallback component</p>
        </div>
      }
    >
      <BrokenComponent />
    </ErrorBoundary>
  ),
};

export const WithReset: Story = {
  render: () => <WithResetStory />,
};

function WithResetStory() {
  const [key, setKey] = useState(0);
  return (
    <ErrorBoundary key={key} onReset={() => setKey(k => k + 1)}>
      <RecoverableComponent />
    </ErrorBoundary>
  );
}
