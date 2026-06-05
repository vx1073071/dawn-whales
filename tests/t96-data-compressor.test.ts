import { describe, it, expect } from 'vitest';
import { DataCompressor } from '../electron/workers/data-compressor';

describe('DataCompressor', () => {
  const dc = new DataCompressor();

  it('should compress with gzip', async () => {
    const data = 'Hello DAWN WHALES! '.repeat(100);
    const { buffer, result } = await dc.compress(data, 'gzip');
    expect(buffer.length).toBeLessThan(data.length);
    expect(result.ratio).toBeLessThan(1);
    expect(result.algorithm).toBe('gzip');
  });

  it('should decompress correctly', async () => {
    const data = 'Test data for round trip compression';
    const { buffer } = await dc.compress(data, 'gzip');
    const decompressed = await dc.decompress(buffer, 'gzip');
    expect(decompressed.toString('utf-8')).toBe(data);
  });

  it('should auto-select algorithm', () => {
    const small = 'small';
    const smallResult = dc.autoCompress(small);
    expect(smallResult.result.algorithm).toBe('none');

    const large = 'x'.repeat(100000);
    const largeResult = dc.autoCompress(large);
    expect(largeResult.result.algorithm).toBe('brotli');
  });
});
