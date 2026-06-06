// Polyfill for Node `events` module in jsdom environment
// Used via vite alias: 'events' → this file
export class EventEmitter {
  private _events: Map<string | symbol, Set<Function>> = new Map();

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event)!.add(listener);
    return this;
  }

  once(event: string | symbol, listener: (...args: any[]) => void): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    this._events.get(event)?.delete(listener);
    return this;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    const listeners = this._events.get(event);
    if (listeners) {
      listeners.forEach(fn => fn(...args));
      return true;
    }
    return false;
  }

  removeAllListeners(event?: string | symbol): this {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
    return this;
  }

  listenerCount(event: string | symbol): number {
    return this._events.get(event)?.size ?? 0;
  }
}

export const defaultMaxListeners = 10;
export const EventEmitterCapture = EventEmitter;
