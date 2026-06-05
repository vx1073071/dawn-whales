import { describe, it, expect } from 'vitest';
import { GitOpsPipeline } from '../electron/workers/gitops-pipeline';

describe('GitOpsPipeline', () => {
  const config = {
    gitRepo: 'github.com/vx1073071/dawn-whales',
    branch: 'master',
    deployPath: '/app',
    autoDeploy: true,
    preDeployChecks: { tests: true, build: true, lint: false, securityScan: false },
    environments: [
      { name: 'staging', branch: 'develop' },
      { name: 'production', branch: 'master' },
    ],
  };

  it('should deploy to staging', async () => {
    const pipeline = new GitOpsPipeline(config);
    const result = await pipeline.deploy('staging', 'v0.8.0', 'abc123');
    expect(result.status).toBe('deployed');
    expect(result.env).toBe('staging');
  });

  it('should fail for unknown environment', async () => {
    const pipeline = new GitOpsPipeline(config);
    const result = await pipeline.deploy('unknown-env', 'v1.0', 'xyz');
    expect(result.status).toBe('failed');
  });

  it('should rollback', async () => {
    const pipeline = new GitOpsPipeline(config);
    await pipeline.deploy('production', 'v1.0.0', 'aaa');
    await pipeline.deploy('production', 'v1.1.0', 'bbb');
    const rollback = await pipeline.rollback('production');
    expect(rollback.version).toBe('v1.0.0');
    expect(rollback.status).toBe('deployed');
  });
});
