// Vitest setup — make Node `events` EventEmitter available in jsdom
import { EventEmitter } from 'events';
Object.assign(globalThis, { EventEmitter });
