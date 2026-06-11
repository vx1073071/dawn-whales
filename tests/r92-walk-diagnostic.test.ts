/**
 * R92 youdao: Quick vitest diagnostic - test _walkRecursive in vitest context
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

// Original broken version (uses require)
function _walkRecursiveRequire(dir: string): string[] {
  let r: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true } as any)) {
    if ((e as any).isDirectory()) r = r.concat(_walkRecursiveRequire(require('path').join(dir, (e as any).name)));
    else r.push((e as any).name);
  }
  return r;
}

// Fixed version (uses imported path)
function _walkRecursiveImport(dir: string): string[] {
  let r: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true } as any)) {
    if ((e as any).isDirectory()) r = r.concat(_walkRecursiveImport(path.join(dir, (e as any).name)));
    else r.push((e as any).name);
  }
  return r;
}

const engineDir = path.resolve(__dirname, '..', 'electron', 'engine');

describe('R92 walk diagnostic', () => {
  it('require version', () => {
    const count = _walkRecursiveRequire(engineDir).filter(f => f.endsWith('.ts')).length;
    console.log('[require] engine .ts files:', count);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('import version', () => {
    const count = _walkRecursiveImport(engineDir).filter(f => f.endsWith('.ts')).length;
    console.log('[import] engine .ts files:', count);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('typeof require', () => {
    console.log('[check] typeof require:', typeof require);
    expect(typeof require).toBe('function');
  });
});
