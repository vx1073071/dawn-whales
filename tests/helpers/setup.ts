// Vitest setup — polyfill Node built-in modules for jsdom environment
// Engine files use `import { EventEmitter } from 'events'` which vitest/jsdom can't resolve
// Engine files use `import { randomBytes } from 'crypto'` which vitest/jsdom can't resolve
// Test files use `import { existsSync } from 'fs'` etc. which vitest/jsdom can't resolve

// Import the real Node events module
const { EventEmitter } = require('events');

// Import the real Node crypto module
const nodeCrypto = require('crypto');

// Import other Node built-ins (for test files that use fs/child_process/path/url)
const nodeFs = require('fs');
const nodeChildProcess = require('child_process');
const nodePath = require('path');

// Inject into global scope so engine classes can use it
Object.assign(globalThis, { EventEmitter });

// Make Node built-ins available globally for named imports in jsdom
// (vitest in jsdom mode doesn't always resolve these correctly)
const g = globalThis as any;
if (!g.existsSync) {
  Object.assign(g, {
    existsSync: nodeFs.existsSync,
    readFileSync: nodeFs.readFileSync,
    writeFileSync: nodeFs.writeFileSync,
    unlinkSync: nodeFs.unlinkSync,
    cpSync: nodeFs.cpSync,
    mkdirSync: nodeFs.mkdirSync,
    readdirSync: nodeFs.readdirSync,
    statSync: nodeFs.statSync,
    execSync: nodeChildProcess.execSync,
    join: nodePath.join,
    dirname: nodePath.dirname,
    resolve: nodePath.resolve,
    basename: nodePath.basename,
  });
}

// Inject crypto as global so named imports can resolve
// jsdom defines globalThis.crypto as a read-only getter (Web Crypto API)
// We need to override it with Node.js crypto for engine imports
Object.defineProperty(globalThis, 'crypto', {
  value: nodeCrypto,
  writable: true,
  configurable: true,
});

// [R92] localStorage polyfill for node environment
// src/i18n/index.ts accesses localStorage at module load time
// In node env (not jsdom), localStorage is not defined
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}
