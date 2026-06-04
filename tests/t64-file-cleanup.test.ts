import { describe, it, expect } from 'vitest';
import { FileCleanup } from '../electron/workers/file-cleanup';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('FileCleanup', () => {
  it('should delete old files', async () => {
    const tmpDir = path.join(os.tmpdir(), 'dw-test-' + Date.now());
    fs.mkdirSync(tmpDir);

    const oldFile = path.join(tmpDir, 'old.log');
    const newFile = path.join(tmpDir, 'new.log');

    fs.writeFileSync(oldFile, 'test');
    // Set mtime to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    fs.utimesSync(oldFile, twoHoursAgo, twoHoursAgo);

    fs.writeFileSync(newFile, 'test');

    const fc = new FileCleanup();
    fc.addRule({ dir: tmpDir, pattern: /\.log$/, maxAgeMs: 3600000 });

    const result = await fc.cleanup();
    expect(result.deleted).toBe(1);
    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
