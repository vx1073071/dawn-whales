// Shim for Node 'events' module — used in vitest jsdom environment
// Engine files `import { EventEmitter } from 'events'` resolve to this shim
export { EventEmitter } from 'events';
