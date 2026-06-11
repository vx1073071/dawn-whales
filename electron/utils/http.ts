// ── DAWN WHALES — HTTP Utilities (R83 unified) ─────────────────────────────
// Canonical HTTP GET/POST helpers. Extracted from 11 duplicates across
// electron/data/ and electron/engine/.

import http from 'http';
import { EngineError, ErrorDomain, ErrorCode } from '../engine/core/engine-error';
import https from 'https';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface HttpGetOptions {
  timeoutMs?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  followRedirects?: boolean;
}

/**
 * HTTP GET with timeout and redirect support.
 */
export function httpGet(url: string, options: HttpGetOptions = {}): Promise<string> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = DEFAULT_USER_AGENT, headers = {}, followRedirects = true } = options;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        timeout: timeoutMs,
        headers: { 'User-Agent': userAgent, Accept: 'application/json', ...headers },
      },
      (res) => {
        if (followRedirects && (res.statusCode === 301 || res.statusCode === 302)) {
          const location = res.headers.location;
          if (location) {
            httpGet(location, options).then(resolve).catch(reject);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `HTTP ${res.statusCode}: ${url}`));
          return;
        }
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString()));
        res.on('end', () => resolve(body));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `HTTP timeout: ${url}`));
    });
    req.on('error', reject);
  });
}

/**
 * HTTP POST with JSON body.
 */
export function httpPost(url: string, body: unknown, options: HttpGetOptions = {}): Promise<string> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = DEFAULT_USER_AGENT, headers = {} } = options;

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const req = client.request(
      {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload).toString(),
          'User-Agent': userAgent,
          Accept: 'application/json',
          ...headers,
        },
      },
      (res) => {
        if (res.statusCode !== 200 && res.statusCode !== 201) {
          reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `HTTP ${res.statusCode}: ${url}`));
          return;
        }
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString()));
        res.on('end', () => resolve(body));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new EngineError(ErrorDomain.SYSTEM, ErrorCode.INTERNAL_ERROR, `HTTP timeout: ${url}`));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
