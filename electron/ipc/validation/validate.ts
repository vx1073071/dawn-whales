/**
 * DAWN WHALES R123-Q01 — IPC Zod Validation Wrapper
 * 
 * Wraps ipcMain.handle() with Zod request/response validation.
 * Catches ZodErrors and returns structured {success:false, error} instead of crashing.
 * 
 * Usage:
 *   import { validateHandler, validatePushHandler } from './validate';
 *   ipcMain.handle('broker:connect',
 *     validateHandler(BrokerConnectReq, BrokerConnectRes, async (req) => { ... })
 *   );
 */

import { z } from 'zod';
import type { IpcMainInvokeEvent } from 'electron';

// ═══════════ Types ════════════════════════════════════════

export interface ValidResult<T> {
  success: true;
  data: T;
}

export interface InvalidResult {
  success: false;
  error: string;
}

export type IpcResult<T> = ValidResult<T> | InvalidResult;

// ═══════════ Request → Response Handler ═══════════════════

/**
 * Create a validated ipcMain.handle handler.
 * 
 * @param reqSchema   Zod schema for the IPC request arguments
 * @param resSchema   Zod schema for the IPC response
 * @param handler     Business logic: validated request → response promise
 * @returns           ipcMain.handle callback
 * 
 * If request validation fails → returns {success:false, error:"..."}
 * If response validation fails → logs warning, returns original (not validated) for forward compat
 */
export function createValidatedHandler<Req, Res>(
  channel: string,
  reqSchema: z.ZodSchema<Req>,
  handler: (event: IpcMainInvokeEvent, req: Req) => Promise<Res>,
  resSchema?: z.ZodSchema<Res>,
): (event: IpcMainInvokeEvent, rawArgs: unknown) => Promise<Res | InvalidResult> {
  
  return async (event: IpcMainInvokeEvent, rawArgs: unknown): Promise<Res | InvalidResult> => {
    // Step 1: Validate request
    let req: Req;
    try {
      req = reqSchema.parse(rawArgs);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const messages = err.errors.map(e => 
          `${e.path.join('.') || '<root>'}: ${e.message}`
        ).join('; ');
        console.error(`[IPC:${channel}] REQUEST VALIDATION FAILED:`, messages);
        return { success: false, error: `Invalid request: ${messages}` };
      }
      throw err;
    }

    // Step 2: Execute handler
    const result = await handler(event, req);

    // Step 3: Validate response (warn only, don't block)
    if (resSchema) {
      try {
        return resSchema.parse(result);
      } catch (err) {
        if (err instanceof z.ZodError) {
          const messages = err.errors.map(e => 
            `${e.path.join('.') || '<root>'}: ${e.message}`
          ).join('; ');
          console.warn(`[IPC:${channel}] RESPONSE VALIDATION FAILED (forward-compat, not blocked):`, messages);
        }
      }
    }

    return result;
  };
}

// ═══════════ Push Handler (ipcMain.on) ═══════════════════

/**
 * Create a validated ipcMain.on handler (for fire-and-forget pushes).
 * Validation failure → logs error, does NOT crash.
 */
export function createValidatedPushHandler<Payload>(
  channel: string,
  schema: z.ZodSchema<Payload>,
  handler: (event: IpcMainInvokeEvent, payload: Payload) => void,
): (event: IpcMainInvokeEvent, rawPayload: unknown) => void {
  
  return (event: IpcMainInvokeEvent, rawPayload: unknown) => {
    try {
      const payload = schema.parse(rawPayload);
      handler(event, payload);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error(`[IPC:${channel}] PUSH VALIDATION FAILED:`,
          err.errors.map(e => `${e.path.join('.') || '<root>'}: ${e.message}`).join('; '));
      } else {
        console.error(`[IPC:${channel}] PUSH HANDLER ERROR:`, err);
      }
    }
  };
}

// ═══════════ Guard: Only validate in development (performance) ═══════════

const ENABLE_VALIDATION = 
  process.env.NODE_ENV === 'development' || 
  process.env.VALIDATE_IPC === '1';

/**
 * Conditionally wrap handler with validation.
 * In production, skips validation for performance.
 * Trade/risk channels ALWAYS validated regardless of env.
 */
export function autoValidateHandler<Req, Res>(
  channel: string,
  reqSchema: z.ZodSchema<Req>,
  handler: (event: IpcMainInvokeEvent, req: Req) => Promise<Res>,
  resSchema?: z.ZodSchema<Res>,
): (event: IpcMainInvokeEvent, rawArgs: unknown) => Promise<Res | InvalidResult> {
  
  const alwaysValidate = 
    channel.startsWith('trade:') || 
    channel.startsWith('risk:');
  
  if (ENABLE_VALIDATION || alwaysValidate) {
    return createValidatedHandler(channel, reqSchema, handler, resSchema);
  }

  // Fast path: no validation
  return async (_event: IpcMainInvokeEvent, rawArgs: unknown) => {
    return handler(_event, rawArgs as Req);
  };
}
