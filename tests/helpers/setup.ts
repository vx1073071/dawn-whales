// Vitest setup — polyfill Node `events` module for jsdom environment
// Engine files use `import { EventEmitter } from 'events'` which vitest/jsdom can't resolve

// Import the real Node events module
const { EventEmitter } = require('events');

// Inject into global scope so engine classes can use it
Object.assign(globalThis, { EventEmitter });
