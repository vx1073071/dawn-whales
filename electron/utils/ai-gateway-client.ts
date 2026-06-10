/**
 * AI Gateway Client — DAWN WHALES
 * 
 * Routes all LLM calls through the server-side AI gateway endpoint,
 * eliminating direct api.deepseek.com calls with client-side keys.
 * 
 * Security model:
 * - DEEPSEEK_API_KEY only lives on the server (never in Electron client memory)
 * - Desktop client sends prompts to server gateway with session token
 * - Server handles API key injection, rate limiting, and fallback chain
 * 
 * Usage:
 *   const resp = await callChatCompletions({
 *     model: 'deepseek-chat',
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     temperature: 0.3,
 *     max_tokens: 400,
 *   });
 */

import * as https from 'https';
import * as http from 'http';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChatCompletionRequest {
  model?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  max_tokens?: number;
  provider?: string;
}

export type ChatCompletionResult = 
  | { success: true; content: string }
  | { success: false; error: string; raw?: any };

// ── Config ─────────────────────────────────────────────────────────────────

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:3001/api/ai/gateway';
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN || '';

// ── Core ───────────────────────────────────────────────────────────────────

/**
 * Call the AI gateway server for chat completions.
 * Server handles API key injection — no key on the client.
 */
export function callChatCompletions(req: ChatCompletionRequest, timeoutMs = 30000): Promise<ChatCompletionResult> {
  return new Promise((resolve) => {
    const gatewayUrl = new URL(AI_GATEWAY_URL);
    const body = JSON.stringify({
      provider: req.provider || 'deepseek',
      model: req.model || 'deepseek-chat',
      messages: req.messages,
      temperature: req.temperature ?? 0.3,
      max_tokens: req.max_tokens ?? 600,
    });

    const isHttps = gatewayUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    const port = gatewayUrl.port || (isHttps ? 443 : 80);

    const timer = setTimeout(() => {
      resolve({ success: false, error: `AI Gateway request timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    try {
      const request = lib.request(
        {
          hostname: gatewayUrl.hostname,
          port,
          path: gatewayUrl.pathname + (gatewayUrl.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AI_GATEWAY_TOKEN}`,
          },
        },
        (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => {
            clearTimeout(timer);
            try {
              const json = JSON.parse(data);
              if (res.statusCode && res.statusCode >= 400) {
                resolve({ success: false, error: `Gateway HTTP ${res.statusCode}: ${json.error || data}`, raw: json });
              } else {
                const content = json.choices?.[0]?.message?.content || json.content || '';
                resolve({ success: true, content });
              }
            } catch {
              resolve({ success: false, error: `Invalid gateway response: ${data.substring(0, 200)}` });
            }
          });
        }
      );

      request.on('error', (err: Error) => {
        clearTimeout(timer);
        resolve({ success: false, error: `Gateway connection error: ${err.message}` });
      });

      request.write(body);
      request.end();
    } catch (err: any) {
      clearTimeout(timer);
      resolve({ success: false, error: `Gateway request error: ${err.message}` });
    }
  });
}
