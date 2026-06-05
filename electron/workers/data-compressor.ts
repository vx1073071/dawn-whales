// T96: Data Compression Service
import * as zlib from 'zlib';

export type CompressionAlgorithm = 'gzip' | 'deflate' | 'brotli' | 'none';

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  algorithm: CompressionAlgorithm;
  duration: number;
}

export class DataCompressor {
  private stats: { totalOriginal: number; totalCompressed: number; calls: number } = { totalOriginal: 0, totalCompressed: 0, calls: 0 };

  async compress(data: string | Buffer, algorithm: CompressionAlgorithm = 'gzip'): Promise<{ buffer: Buffer; result: CompressionResult }> {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const start = Date.now();
    let compressed: Buffer;

    switch (algorithm) {
      case 'gzip':
        compressed = zlib.gzipSync(buf);
        break;
      case 'deflate':
        compressed = zlib.deflateSync(buf);
        break;
      case 'brotli':
        compressed = zlib.brotliCompressSync(buf);
        break;
      default:
        compressed = buf;
    }

    const duration = Date.now() - start;
    const result: CompressionResult = {
      originalSize: buf.length,
      compressedSize: compressed.length,
      ratio: compressed.length / buf.length,
      algorithm,
      duration,
    };

    this.stats.totalOriginal += buf.length;
    this.stats.totalCompressed += compressed.length;
    this.stats.calls++;

    return { buffer: compressed, result };
  }

  async decompress(data: Buffer, algorithm: CompressionAlgorithm): Promise<Buffer> {
    switch (algorithm) {
      case 'gzip': return zlib.gunzipSync(data);
      case 'deflate': return zlib.inflateSync(data);
      case 'brotli': return zlib.brotliDecompressSync(data);
      default: return data;
    }
  }

  autoCompress(data: string | Buffer): { buffer: Buffer; result: CompressionResult } {
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;

    // Small data: no compression
    if (buf.length < 1024) {
      return {
        buffer: buf,
        result: { originalSize: buf.length, compressedSize: buf.length, ratio: 1, algorithm: 'none', duration: 0 },
      };
    }

    // Medium: deflate (faster)
    if (buf.length < 65536) {
      const compressed = zlib.deflateSync(buf);
      return {
        buffer: compressed,
        result: { originalSize: buf.length, compressedSize: compressed.length, ratio: compressed.length / buf.length, algorithm: 'deflate', duration: 0 },
      };
    }

    // Large: brotli (better ratio)
    const compressed = zlib.brotliCompressSync(buf);
    return {
      buffer: compressed,
      result: { originalSize: buf.length, compressedSize: compressed.length, ratio: compressed.length / buf.length, algorithm: 'brotli', duration: 0 },
    };
  }

  getStats(): typeof this.stats {
    return { ...this.stats };
  }
}
