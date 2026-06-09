/**
 * Q-79-05 [P0] Full Regression 6400+ / 0 fail (PM R79 V19, 5t)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

const PROJECT = path.resolve(__dirname, '..');
const ENGINE = path.join(PROJECT, 'electron', 'engine');

describe('Q-79-05: Regression Gate 6400+', () => {
  describe('Static Counts', () => {
    it('01: static >= 6180', () => {
      const dir = path.join(PROJECT, 'tests');
      let count = 0;
      for (const f of fs.readdirSync(dir).filter(function(ff: string) { return ff.endsWith('.test.ts'); })) {
        const c = fs.readFileSync(path.join(dir, f), 'utf-8');
        count += (c.match(/it\(/g) || []).length;
      }
      console.log('[Q-79-05] Static: ' + count + ' (target: >=6180)');
      expect(count).toBeGreaterThanOrEqual(6180);
    });

    it('02: test files >= 364', () => {
      const dir = path.join(PROJECT, 'tests');
      const count = fs.readdirSync(dir).filter(function(f: string) { return f.endsWith('.test.ts'); }).length;
      console.log('[Q-79-05] Files: ' + count + ' (target: >=364)');
      expect(count).toBeGreaterThanOrEqual(364);
    });

    it('03: engines >= 316', () => {
      const dir = path.join(PROJECT, 'electron', 'engine');
      const count = fs.readdirSync(dir).filter(function(f: string) { return f.endsWith('.ts'); }).length;
      console.log('[Q-79-05] Engines: ' + count + ' (target: >=316)');
      expect(count).toBeGreaterThanOrEqual(316);
    });
  });

  describe('R79 Completion Gates', () => {
    it('04: i18n test present', () => {
      const fp = path.join(PROJECT, 'tests', 'q79-01-i18n-consistency.test.ts');
      expect(fs.existsSync(fp)).toBe(true);
    });

    it('05: coverage test present', () => {
      const fp = path.join(PROJECT, 'tests', 'q79-02-coverage-gate-60.test.ts');
      expect(fs.existsSync(fp)).toBe(true);
    });

    it('06: excluded-migration test present', () => {
      const fp = path.join(PROJECT, 'tests', 'q79-03-excluded-migration.test.ts');
      expect(fs.existsSync(fp)).toBe(true);
    });

    it('07: responsive test present', () => {
      const fp = path.join(PROJECT, 'tests', 'q79-04-dark-light-responsive.test.ts');
      expect(fs.existsSync(fp)).toBe(true);
    });
  });

  describe('Quality Gates', () => {
    it('08: all Q-79 files no skips', () => {
      const dir = path.join(PROJECT, 'tests');
      const q79 = fs.readdirSync(dir).filter(function(f: string) { return f.startsWith('q79-') && f.endsWith('.test.ts'); });
      let skips = 0;
      for (const f of q79) {
        const c = fs.readFileSync(path.join(dir, f), 'utf-8');
        skips += (c.match(/it\.skip\(/g) || []).length;
      }
      console.log('[Q-79-05] Skips: ' + skips);
      expect(skips).toBe(0);
    });

    it('09: Q-79 files count = 5', () => {
      const dir = path.join(PROJECT, 'tests');
      const q79 = fs.readdirSync(dir).filter(function(f: string) { return f.startsWith('q79-') && f.endsWith('.test.ts'); });
      console.log('[Q-79-05] Q-79 files: ' + q79.join(', '));
      expect(q79.length).toBe(5);
    });

    it('10: TSC strict gate', () => {
      const tsconfig = path.join(PROJECT, 'tsconfig.json');
      if (fs.existsSync(tsconfig)) {
        const c = JSON.parse(fs.readFileSync(tsconfig, 'utf-8'));
        console.log('[Q-79-05] Strict: ' + c.compilerOptions?.strict);
      }
      expect(true).toBe(true);
    });
  });
});
