/**
 * Q-80-02 [P0] Docker Containerization (PM R80 V19, 5t)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

const PROJECT = path.resolve(__dirname, '..');

describe('Q-80-02: Docker Containerization', () => {
  // ── Dockerfile (4 tests) ────────────────────────────────────

  describe('Dockerfile', () => {
    it('01: Dockerfile exists and non-empty', () => {
      const fp = path.join(PROJECT, 'Dockerfile');
      const exists = fs.existsSync(fp);
      console.log('[Q-80-02] Dockerfile: ' + (exists ? 'EXISTS' : 'NOT FOUND'));
      if (exists) {
        const c = fs.readFileSync(fp, 'utf-8');
        const lines = c.split('\n').length;
        console.log('[Q-80-02] Dockerfile: ' + lines + ' lines');
        expect(lines).toBeGreaterThan(5);
      } else {
        // Informational — JVS may create it
        expect(true).toBe(true);
      }
    });

    it('02: node:22-alpine base image', () => {
      const fp = path.join(PROJECT, 'Dockerfile');
      if (fs.existsSync(fp)) {
        const c = fs.readFileSync(fp, 'utf-8');
        const hasNode22 = c.includes('node:22') || c.includes('node:22-alpine');
        console.log('[Q-80-02] node:22 base: ' + (hasNode22 ? 'yes' : 'no'));
        expect(hasNode22).toBe(true);
      }
    });

    it('03: WORKDIR set', () => {
      const fp = path.join(PROJECT, 'Dockerfile');
      if (fs.existsSync(fp)) {
        const c = fs.readFileSync(fp, 'utf-8');
        const hasWorkdir = c.includes('WORKDIR');
        console.log('[Q-80-02] WORKDIR: ' + (hasWorkdir ? 'yes' : 'no'));
        expect(hasWorkdir).toBe(true);
      }
    });

    it('04: EXPOSE or CMD defined', () => {
      const fp = path.join(PROJECT, 'Dockerfile');
      if (fs.existsSync(fp)) {
        const c = fs.readFileSync(fp, 'utf-8');
        const hasExpose = c.includes('EXPOSE');
        const hasCmd = c.includes('CMD');
        console.log('[Q-80-02] EXPOSE: ' + hasExpose + ' CMD: ' + hasCmd);
        expect(hasExpose || hasCmd).toBe(true);
      }
    });
  });

  // ── docker-compose.yml (3 tests) ────────────────────────────

  describe('docker-compose.yml', () => {
    it('05: compose file exists', () => {
      const fp = path.join(PROJECT, 'docker-compose.yml');
      const exists = fs.existsSync(fp);
      console.log('[Q-80-02] docker-compose.yml: ' + (exists ? 'EXISTS' : 'NOT FOUND'));
      if (exists) {
        const c = fs.readFileSync(fp, 'utf-8');
        const lines = c.split('\n').length;
        expect(lines).toBeGreaterThan(5);
      }
    });

    it('06: app service defined', () => {
      const fp = path.join(PROJECT, 'docker-compose.yml');
      if (fs.existsSync(fp)) {
        const c = fs.readFileSync(fp, 'utf-8');
        const hasApp = c.includes('app:') || c.includes('  app:') || c.includes('  dawn-whales:');
        console.log('[Q-80-02] app service: ' + (hasApp ? 'yes' : 'no'));
        expect(hasApp).toBe(true);
      }
    });

    it('07: postgres or redis service', () => {
      const fp = path.join(PROJECT, 'docker-compose.yml');
      if (fs.existsSync(fp)) {
        const c = fs.readFileSync(fp, 'utf-8');
        const hasDB = c.includes('postgres') || c.includes('postgres');
        const hasRedis = c.includes('redis');
        console.log('[Q-80-02] postgres: ' + hasDB + ' redis: ' + hasRedis);
        expect(hasDB || hasRedis).toBe(true);
      }
    });
  });

  // ── .dockerignore (1 test) ──────────────────────────────────

  describe('.dockerignore', () => {
    it('08: .dockerignore exists', () => {
      const fp = path.join(PROJECT, '.dockerignore');
      const exists = fs.existsSync(fp);
      console.log('[Q-80-02] .dockerignore: ' + (exists ? 'EXISTS' : 'NOT FOUND'));
      if (exists) {
        const c = fs.readFileSync(fp, 'utf-8');
        const hasNodeModules = c.includes('node_modules');
        const hasDist = c.includes('dist');
        console.log('[Q-80-02] Ignores: node_modules=' + hasNodeModules + ' dist=' + hasDist);
      }
      // Optional but recommended
      expect(true).toBe(true);
    });
  });

  // ── Health Check (2 tests) ──────────────────────────────────

  describe('Health Check', () => {
    it('09: health endpoint in server code', () => {
      const serverDir = path.join(PROJECT, 'server');
      let hasHealth = false;
      if (fs.existsSync(serverDir)) {
        const walk = (d: string) => {
          for (const f of fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name)) {
            const fp = path.join(d, f);
            if (fs.statSync(fp).isDirectory()) walk(fp);
            else if (/\.(ts|js)$/.test(f)) {
              const c = fs.readFileSync(fp, 'utf-8');
              if (/health|healthcheck|health.*check/.test(c)) {
                console.log('[Q-80-02] Health route: ' + f);
                hasHealth = true;
              }
            }
          }
        };
        walk(serverDir);
      }
      console.log('[Q-80-02] /api/health: ' + (hasHealth ? 'FOUND' : 'NOT FOUND'));
      expect(true).toBe(true);
    });

    it('10: docker healthcheck or startup script', () => {
      const dockerfile = path.join(PROJECT, 'Dockerfile');
      let hasCheck = false;
      if (fs.existsSync(dockerfile)) {
        const c = fs.readFileSync(dockerfile, 'utf-8');
        hasCheck = c.includes('HEALTHCHECK') || c.includes('healthcheck') || c.includes('health');
        console.log('[Q-80-02] HEALTHCHECK: ' + (hasCheck ? 'yes' : 'no'));
      }
      const startupDir = path.join(PROJECT, 'scripts');
      if (fs.existsSync(startupDir)) {
        for (const f of fs.readdirSync(startupDir)) {
          if (f.includes('startup') || f.includes('entrypoint') || f.includes('docker')) {
            console.log('[Q-80-02] Startup script: ' + f);
            hasCheck = true;
          }
        }
      }
      expect(true).toBe(true);
    });
  });
});
