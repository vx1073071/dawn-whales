// electron/engine/utils/http.ts — HTTP utility functions
// [R92] Created to resolve missing import from capital-flow-rank.ts

import http from 'http';
import https from 'https';

/**
 * Simple HTTP GET request returning response body as string.
 * Follows redirects (up to 3).
 */
export function httpGet(url: string, options?: { timeout?: number; headers?: Record<string, string> }): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout ?? 10000;
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'DAWN-WHALES/1.0',
        'Accept': 'application/json, text/plain, */*',
        ...options?.headers,
      },
    }, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location, options).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`HTTP GET timeout: ${url}`)); });
  });
}

/**
 * Simple HTTP POST request.
 */
export function httpPost(url: string, body: string | object, options?: { timeout?: number; headers?: Record<string, string> }): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout ?? 10000;
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    const req = client.request(url, {
      method: 'POST',
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'DAWN-WHALES/1.0',
        ...options?.headers,
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`HTTP POST timeout: ${url}`)); });
    req.write(bodyStr);
    req.end();
  });
}
