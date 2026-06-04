// T67: JSON-RPC 2.0 Handler
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any[];
  id?: string | number | null;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type RpcMethodHandler = (params?: any[]) => Promise<any>;

const ErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export class JsonRpcServer {
  private methods = new Map<string, RpcMethodHandler>();

  register(name: string, handler: RpcMethodHandler): void {
    this.methods.set(name, handler);
  }

  async handle(raw: string): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    let request: JsonRpcRequest | JsonRpcRequest[];

    try {
      request = JSON.parse(raw);
    } catch {
      return { jsonrpc: '2.0', id: null, error: { code: ErrorCodes.PARSE_ERROR, message: 'Parse error' } };
    }

    // Batch
    if (Array.isArray(request)) {
      if (request.length === 0) {
        return { jsonrpc: '2.0', id: null, error: { code: ErrorCodes.INVALID_REQUEST, message: 'Empty batch' } };
      }
      const responses = await Promise.all(request.map(r => this._handleOne(r)));
      return responses.filter(r => r !== null) as JsonRpcResponse[];
    }

    return this._handleOne(request);
  }

  private async _handleOne(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    // Notification (no id) — no response
    if (req.id === undefined) {
      try {
        await this._execute(req);
      } catch { /* notification fires and forgets */ }
      return null;
    }

    try {
      const result = await this._execute(req);
      return {
        jsonrpc: '2.0',
        id: req.id ?? null,
        result,
      };
    } catch (e: any) {
      // Determine error code
      let code = e.code || ErrorCodes.INTERNAL_ERROR;
      if (!e.code) {
        if (e.message.includes('not found')) code = ErrorCodes.METHOD_NOT_FOUND;
        if (e.message.includes('Invalid params')) code = ErrorCodes.INVALID_PARAMS;
      }
      return {
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code, message: e.message, data: e.data },
      };
    }
  }

  private async _execute(req: JsonRpcRequest): Promise<any> {
    if (req.jsonrpc !== '2.0') {
      throw Object.assign(new Error('Invalid JSON-RPC version'), { code: ErrorCodes.INVALID_REQUEST });
    }
    const handler = this.methods.get(req.method);
    if (!handler) {
      throw Object.assign(new Error(`Method not found: ${req.method}`), { code: ErrorCodes.METHOD_NOT_FOUND });
    }
    return handler(req.params);
  }

  listMethods(): string[] {
    return Array.from(this.methods.keys());
  }
}
