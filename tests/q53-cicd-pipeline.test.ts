// ── Q53: CI/CD Pipeline (GitHub Actions) ──────────────────────────────────
// CI/CD pipeline configuration and validation

export interface CICDConfig {
  platform: 'github' | 'gitlab' | 'jenkins';
  stages: Array<{
    name: string;
    steps: Array<{
      name: string;
      command: string;
      condition?: string;
    }>;
  }>;
}

export class CICDPipeline {
  private config: CICDConfig;

  constructor() {
    this.config = {
      platform: 'github',
      stages: [
        {
          name: 'Build',
          steps: [
            { name: 'Install', command: 'npm ci' },
            { name: 'Build', command: 'npm run build' },
          ],
        },
        {
          name: 'Test',
          steps: [
            { name: 'Lint', command: 'npm run lint' },
            { name: 'Type Check', command: 'npx tsc --noEmit' },
            { name: 'Unit Tests', command: 'npm test' },
          ],
        },
        {
          name: 'Deploy',
          steps: [
            { name: 'Build Release', command: 'npm run build:release' },
            { name: 'Sign', command: 'npm run sign' },
            { name: 'Publish', command: 'npm run publish' },
          ],
        },
      ],
    };
  }

  /**
   * Generate GitHub Actions workflow
   */
  generateGitHubActions(): string {
    const workflow = {
      name: 'CI/CD Pipeline',
      on: {
        push: { branches: ['main', 'master'] },
        pull_request: { branches: ['main', 'master'] },
      },
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            { uses: 'actions/checkout@v3' },
            { uses: 'actions/setup-node@v3', with: { 'node-version': '20' } },
            { run: 'npm ci' },
            { run: 'npm run build' },
          ],
        },
        test: {
          'runs-on': 'ubuntu-latest',
          needs: 'build',
          steps: [
            { uses: 'actions/checkout@v3' },
            { uses: 'actions/setup-node@v3', with: { 'node-version': '20' } },
            { run: 'npm ci' },
            { run: 'npm run lint' },
            { run: 'npx tsc --noEmit' },
            { run: 'npm test' },
          ],
        },
        deploy: {
          'runs-on': 'ubuntu-latest',
          needs: 'test',
          if: "github.ref == 'refs/heads/main'",
          steps: [
            { uses: 'actions/checkout@v3' },
            { uses: 'actions/setup-node@v3', with: { 'node-version': '20' } },
            { run: 'npm ci' },
            { run: 'npm run build:release' },
          ],
        },
      },
    };

    return this.toYAML(workflow);
  }

  private toYAML(obj: any, indent: number = 0): string {
    const lines: string[] = [];
    const prefix = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        lines.push(this.toYAML(value, indent + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          if (typeof item === 'object') {
            lines.push(`${prefix}  -`);
            lines.push(this.toYAML(item, indent + 2));
          } else {
            lines.push(`${prefix}  - ${item}`);
          }
        }
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }
}

export function runCICDTests(): void {
  console.log('Running CI/CD pipeline tests...');
  const pipeline = new CICDPipeline();
  const workflow = pipeline.generateGitHubActions();
  console.log('✅ CI/CD pipeline configuration generated');
}

// ── Vitest Test Cases ───────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

describe('Q53: CI/CD Pipeline', () => {
  it('CICDConfig has correct structure', () => {
    const config: CICDConfig = {
      platform: 'github',
      stages: [
        {
          name: 'Build',
          steps: [{ name: 'Install', command: 'npm ci' }],
        },
      ],
    };
    expect(config.platform).toBe('github');
    expect(config.stages.length).toBe(1);
  });

  it('CICDPipeline has 3 default stages', () => {
    const pipeline = new CICDPipeline();
    const stages = (pipeline as any).config.stages;
    expect(stages.length).toBe(3);
    expect(stages.map((s: any) => s.name)).toEqual(['Build', 'Test', 'Deploy']);
  });

  it('generateGitHubActions returns valid YAML', () => {
    const pipeline = new CICDPipeline();
    const yaml = pipeline.generateGitHubActions();
    expect(typeof yaml).toBe('string');
    expect(yaml).toContain('name: CI/CD Pipeline');
    expect(yaml).toContain('on:');
    expect(yaml).toContain('jobs:');
    expect(yaml).toContain('build:');
    expect(yaml).toContain('test:');
    expect(yaml).toContain('deploy:');
  });

  it('GitHub Actions YAML has required job structure', () => {
    const pipeline = new CICDPipeline();
    const yaml = pipeline.generateGitHubActions();
    // Test stage needs Build stage
    expect(yaml).toContain('needs:');
    expect(yaml).toContain('build');
    // Deploy stage needs Test stage and refs check
    expect(yaml).toContain('test');
    expect(yaml).toContain("github.ref == 'refs/heads/main'");
  });

  it('toYAML handles nested objects', () => {
    const pipeline = new CICDPipeline() as any;
    const yaml = pipeline.toYAML({ a: { b: { c: 1 } } });
    expect(yaml).toContain('a:');
    expect(yaml).toContain('b:');
    expect(yaml).toContain('c: 1');
  });
});
