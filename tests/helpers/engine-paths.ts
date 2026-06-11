/**
 * Shared engine path utilities for tests.
 * After JVS R86 engine dir restructure (flat→subdirs), tests need recursive
 * file counting and subdirectory-aware path resolution.
 */
import * as fs from 'fs';
import * as path from 'path';

const ENGINE_ROOT = path.resolve(__dirname, '../../electron/engine');

/**
 * Recursively find all .ts files under electron/engine/ (excluding .test.* and index.ts)
 */
export function countEngineFiles(): number {
  return findEngineFiles().length;
}

export function findEngineFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts') && entry.name !== 'index.ts') {
        results.push(full);
      }
    }
  }
  walk(ENGINE_ROOT);
  return results;
}

/**
 * Check if a specific engine file exists anywhere under electron/engine/
 */
export function engineFileExists(filename: string): boolean {
  return findEngineFiles().some(f => path.basename(f) === filename);
}

/**
 * Get the full path of an engine file by name (searches recursively)
 */
export function resolveEngineFile(filename: string): string | null {
  const found = findEngineFiles().find(f => path.basename(f) === filename);
  return found || null;
}

/**
 * Get all engine subdirectories
 */
export function getEngineSubdirs(): string[] {
  if (!fs.existsSync(ENGINE_ROOT)) return [];
  return fs.readdirSync(ENGINE_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

/**
 * Check if MOCK_ pattern exists in an engine file (searches recursively)
 */
export function countMockInEngine(filename: string): number {
  const filePath = resolveEngineFile(filename);
  if (!filePath) return -1; // file not found
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = content.match(/MOCK_/g);
  return matches ? matches.length : 0;
}

/**
 * Read engine file content (searches recursively)
 */
export function readEngineFile(filename: string): string | null {
  const filePath = resolveEngineFile(filename);
  if (!filePath) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
