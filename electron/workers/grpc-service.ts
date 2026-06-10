// T86: gRPC Service Prototype (with local stub implementation)
// In production: @grpc/grpc-js + proto-loader for real gRPC

export interface GrpcServiceDefinition {
  package: string;
  service: string;
  methods: {
    name: string;
    requestType: string;
    responseType: string;
    streaming?: 'client' | 'server' | 'bidirectional';
  }[];
}

export interface GrpcCall {
  service: string;
  method: string;
  request: unknown;
  metadata?: Record<string, string>;
}

export interface GrpcResponse {
  data: unknown;
  metadata?: Record<string, string>;
  status: { code: number; message: string };
}

type GrpcMethodImpl = (request: unknown) => Promise<any>;

export class GrpcServer {
  private services = new Map<string, Map<string, GrpcMethodImpl>>();

  register(service: string, method: string, handler: GrpcMethodImpl): void {
    if (!this.services.has(service)) this.services.set(service, new Map());
    this.services.get(service)!.set(method, handler);
  }

  async call(call: GrpcCall): Promise<GrpcResponse> {
    const svc = this.services.get(call.service);
    if (!svc) {
      return { data: null, status: { code: 5, message: `Service ${call.service} not found` } };
    }
    const handler = svc.get(call.method);
    if (!handler) {
      return { data: null, status: { code: 12, message: `Method ${call.method} not found` } };
    }
    try {
      const data = await handler(call.request);
      return { data, status: { code: 0, message: 'OK' } };
    } catch (e) {
      return { data: null, status: { code: 2, message: e.message } };
    }
  }

  listServices(): string[] {
    return Array.from(this.services.keys());
  }
}

// Strategy gRPC service
export class StrategyGrpcService {
  private grpc: GrpcServer;

  constructor(grpc: GrpcServer) {
    this.grpc = grpc;
    grpc.register('dawnwhales.v1.StrategyService', 'CreateStrategy', async (req) => ({
      id: `strat-${Date.now()}`,
      name: req.name,
      status: 'created',
    }));
    grpc.register('dawnwhales.v1.StrategyService', 'ListStrategies', async () => ({
      strategies: [],
      total: 0,
    }));
    grpc.register('dawnwhales.v1.StrategyService', 'Backtest', async (req) => ({
      id: `bt-${Date.now()}`,
      sharpeRatio: 1.5,
      totalReturn: 0.15,
    }));
  }
}

// Market Data gRPC service
export class MarketDataGrpcService {
  private grpc: GrpcServer;

  constructor(grpc: GrpcServer) {
    this.grpc = grpc;
    grpc.register('dawnwhales.v1.MarketDataService', 'GetQuote', async (req) => ({
      symbol: req.symbol,
      price: 150.0,
      change: 0.02,
      volume: 1000000,
    }));
    grpc.register('dawnwhales.v1.MarketDataService', 'StreamQuotes', async (req) => ({
      symbols: req.symbols || [],
      quotes: [],
    }));
  }
}

export const grpcServer = new GrpcServer();
