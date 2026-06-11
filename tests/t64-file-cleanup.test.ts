import { describe, it, expect } from 'vitest';
import { FileCleanup } from '../electron/workers/file-cleanup';

describe('FileCleanup', () => {
  it('should construct FileCleanup and add rules', () => {
    const fc = new FileCleanup();
    fc.addRule({ dir: '/tmp/test', pattern: /\.log$/, maxAgeMs: 3600000 });
    expect(fc).toBeDefined();
  });

  it('cleanup returns { deleted, errors } structure', async () => {
    const fc = new FileCleanup();
    // Rule on a non-existent dir should just return 0 deleted, no crash
    fc.addRule({ dir: '/dev/null/nonexistent-' + Date.now(), pattern: /\.log$/, maxAgeMs: 1000 });
    const result = await fc.cleanup();
    expect(result).toHaveProperty('deleted');
    expect(result).toHaveProperty('errors');
  });

  it('schedule and stop work without errors', () => {
    const fc = new FileCleanup();
    fc.schedule(999999); // very long interval
    fc.stop();
    expect(fc).toBeDefined();
  });
});
