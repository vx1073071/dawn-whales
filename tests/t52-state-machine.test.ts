import { describe, it, expect } from 'vitest';
import { StateMachine, createOpenDStateMachine } from '../electron/workers/state-machine';

describe('StateMachine', () => {
  it('should start at DISCONNECTED', () => {
    const sm = new StateMachine();
    expect(sm.current).toBe('DISCONNECTED');
  });

  it('should allow valid transition', async () => {
    const sm = new StateMachine()
      .configure('DISCONNECTED', { allowedTransitions: ['CONNECTING'] })
      .configure('CONNECTING', { allowedTransitions: ['CONNECTED', 'DISCONNECTED'] })
      .configure('CONNECTED', { allowedTransitions: ['DISCONNECTED'] });
    
    const ok = await sm.transition('CONNECTING');
    expect(ok).toBe(true);
    expect(sm.current).toBe('CONNECTING');
  });

  it('should reject invalid transition', async () => {
    const sm = new StateMachine()
      .configure('DISCONNECTED', { allowedTransitions: ['CONNECTING'] })
      .configure('CONNECTING', { allowedTransitions: ['CONNECTED'] })
      .configure('CONNECTED', { allowedTransitions: ['DISCONNECTED'] });
    
    const ok = await sm.transition('CONNECTED'); // from DISCONNECTED to CONNECTED is invalid
    expect(ok).toBe(false);
  });

  it('should call onEnter/onExit hooks', async () => {
    const entered: string[] = [];
    const exited: string[] = [];
    const sm = new StateMachine()
      .configure('DISCONNECTED', { allowedTransitions: ['CONNECTING'], onExit: () => { exited.push('DISCONNECTED'); } })
      .configure('CONNECTING', { allowedTransitions: ['CONNECTED', 'DISCONNECTED'], onEnter: () => { entered.push('CONNECTING'); } })
      .configure('CONNECTED', { allowedTransitions: ['DISCONNECTED'] });
    
    await sm.transition('CONNECTING');
    expect(entered).toContain('CONNECTING');
    expect(exited).toContain('DISCONNECTED');
  });

  it('should track history', async () => {
    const sm = new StateMachine()
      .configure('DISCONNECTED', { allowedTransitions: ['CONNECTING'] })
      .configure('CONNECTING', { allowedTransitions: ['CONNECTED'] })
      .configure('CONNECTED', { allowedTransitions: ['DISCONNECTED'] });
    
    await sm.transition('CONNECTING');
    await sm.transition('CONNECTED');
    expect(sm.getHistory().length).toBe(2);
  });

  it('OpenD machine should have correct transitions', () => {
    const sm = createOpenDStateMachine();
    expect(sm.canTransition('CONNECTING')).toBe(true);
    expect(sm.canTransition('AUTHENTICATED')).toBe(false);
  });
});
