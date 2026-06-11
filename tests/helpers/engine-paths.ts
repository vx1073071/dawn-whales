// tests/helpers/engine-paths.ts — Recursive engine directory utilities
// [R92] Created to handle JVS engine restructure (flat → 8 subdirectories)
import fs from 'fs';
import path from 'path';

const ENGINE_DIR = path.resolve(__dirname, '../../electron/engine');

/**
 * Recursively walk a directory and return all file names.
 */
export function walkDir(dir: string): string[] {
  let results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(walkDir(full));
      } else {
        results.push(entry.name);
      }
    }
  } catch { /* ignore */ }
  return results;
}

/**
 * Get all .ts engine files (recursive), excluding index.ts and .d.ts.
 */
export function getEngineFiles(): string[] {
  return walkDir(ENGINE_DIR).filter(f =>
    f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.d.ts')
  );
}

/**
 * Count engine .ts files (recursive).
 */
export function countEngineFiles(): number {
  return getEngineFiles().length;
}

/**
 * Check if a specific engine module exists (recursive search).
 */
export function engineFileExists(moduleName: string): boolean {
  const target = moduleName.endsWith('.ts') ? moduleName : `${moduleName}.ts`;
  return getEngineFiles().some(f => f === target);
}

/**
 * Find the full relative path of an engine module (recursive).
 */
export function findEngineFile(moduleName: string): string | null {
  const target = moduleName.endsWith('.ts') ? moduleName : `${moduleName}.ts`;
  const all = walkDir(ENGINE_DIR);
  const found = all.find(f => f === target);
  return found || null;
}

/**
 * Get all engine subdirectories.
 */
export function getEngineSubdirs(): string[] {
  return fs.readdirSync(ENGINE_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

export { ENGINE_DIR };
