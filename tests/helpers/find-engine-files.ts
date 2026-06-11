/**
 * R92 youdao: Recursive engine file finder
 * Fixes regression gate tests that were only counting top-level engine files
 */
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export function findEngineFiles(dir: string): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  walk(dir);
  return results;
}

export function countEngineFiles(dir: string): number {
  return findEngineFiles(dir).length;
}

export function findSrcFiles(dir: string): string[] {
  const results: string[] = [];
  
  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          walk(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  walk(dir);
  return results;
}

export function countSrcFiles(dir: string): number {
  return findSrcFiles(dir).length;
}
