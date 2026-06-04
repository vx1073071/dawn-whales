// T52: State Machine for OpenD Connection
export type ConnState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'AUTHENTICATED' | 'STREAMING' | 'ERROR';

export interface StateConfig {
  onEnter?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
  timeout?: number;
  maxRetries?: number;
  allowedTransitions: ConnState[];
}

export class StateMachine {
  private state: ConnState = 'DISCONNECTED';
  private states: Map<ConnState, StateConfig> = new Map();
  private listeners: Array<(from: ConnState, to: ConnState) => void> = [];
  private history: Array<{ from: ConnState; to: ConnState; time: number }> = [];

  configure(state: ConnState, config: StateConfig) {
    this.states.set(state, config);
    return this;
  }

  get current(): ConnState { return this.state; }

  async transition(to: ConnState): Promise<boolean> {
    const from = this.state;
    const config = this.states.get(to);
    if (!config) throw new Error(`Unknown state: ${to}`);
    if (!config.allowedTransitions.includes(from)) {
      return false; // invalid transition
    }

    // exit current state
    const exitConfig = this.states.get(from);
    if (exitConfig?.onExit) await exitConfig.onExit();

    // enter new state
    this.state = to;
    if (config.onEnter) await config.onEnter();

    this.history.push({ from, to, time: Date.now() });
    this.listeners.forEach(l => l(from, to));
    return true;
  }

  onChange(fn: (from: ConnState, to: ConnState) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  getHistory() { return [...this.history]; }
  isDisconnected() { return this.state === 'DISCONNECTED'; }
  isConnected() { return ['CONNECTED', 'AUTHENTICATED', 'STREAMING'].includes(this.state); }
  canTransition(to: ConnState): boolean {
    const config = this.states.get(to);
    return config ? config.allowedTransitions.includes(this.state) : false;
  }
}

// Pre-configured OpenD state machine
export function createOpenDStateMachine(): StateMachine {
  return new StateMachine()
    .configure('DISCONNECTED', { allowedTransitions: ['CONNECTING'], timeout: 0, maxRetries: 0 })
    .configure('CONNECTING', { allowedTransitions: ['CONNECTED', 'ERROR', 'DISCONNECTED'], timeout: 10000, maxRetries: 50 })
    .configure('CONNECTED', { allowedTransitions: ['AUTHENTICATED', 'DISCONNECTED', 'ERROR'], timeout: 0, maxRetries: 0 })
    .configure('AUTHENTICATED', { allowedTransitions: ['STREAMING', 'DISCONNECTED', 'ERROR'], timeout: 5000, maxRetries: 3 })
    .configure('STREAMING', { allowedTransitions: ['DISCONNECTED', 'ERROR'], timeout: 0, maxRetries: 0 })
    .configure('ERROR', { allowedTransitions: ['DISCONNECTED', 'CONNECTING'], timeout: 30000, maxRetries: 3 });
}
