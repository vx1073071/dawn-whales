// T58: Lightweight Event Bus with wildcard matching
type EventHandler = (...args: any[]) => void;

interface Subscription {
  pattern: RegExp;
  handler: EventHandler;
  once: boolean;
}

export class EventBus {
  private subs: Subscription[] = [];

  on(event: string, handler: EventHandler): () => void {
    const pattern = this._pattern(event);
    const sub: Subscription = { pattern, handler, once: false };
    this.subs.push(sub);
    return () => { this.subs = this.subs.filter(s => s !== sub); };
  }

  once(event: string, handler: EventHandler): () => void {
    const pattern = this._pattern(event);
    const sub: Subscription = { pattern, handler, once: true };
    this.subs.push(sub);
    return () => { this.subs = this.subs.filter(s => s !== sub); };
  }

  emit(event: string, ...args: any[]): void {
    for (const sub of [...this.subs]) {
      if (sub.pattern.test(event)) {
        sub.handler(...args);
      }
    }
    this.subs = this.subs.filter(s => !s.once || !s.pattern.test(event));
  }

  async emitAsync(event: string, ...args: any[]): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const sub of [...this.subs]) {
      if (sub.pattern.test(event)) {
        promises.push(
          Promise.resolve(sub.handler(...args)).catch(e =>
            log.error(`EventBus handler error [${event}]:`, e)
          )
        );
      }
    }
    this.subs = this.subs.filter(s => !s.once || !s.pattern.test(event));
    await Promise.allSettled(promises);
  }

  removeAll(): void {
    this.subs = [];
  }

  private _pattern(event: string): RegExp {
    // Escape dots first, then convert * to .* wildcard
    const regexStr = '^' + event.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
    return new RegExp(regexStr);
  }
}

export const appEventBus = new EventBus();
