/**
 * QUANT MOO R123-Q01 — IPC Validation Module Index
 * 
 * Barrel export for all Zod schemas + validation utilities.
 * 
 * Usage in ipc-setup.ts:
 *   import { 
 *     BrokerConnectRequest, BrokerConnectResponse, 
 *     createValidatedHandler 
 *   } from './validation';
 *   
 *   ipcMain.handle('broker:connect',
 *     createValidatedHandler('broker:connect', BrokerConnectRequest, 
 *       async (event, req) => { ... }, BrokerConnectResponse)
 *   );
 */

// ═══════════ Wrapper ════════════════════════════════════
export {
  createValidatedHandler,
  createValidatedPushHandler,
  autoValidateHandler,
} from './validate';

export type {
  IpcResult,
  ValidResult,
  InvalidResult,
} from './validate';

// ═══════════ Tier 1: Broker (10 channels) ══════════════
export {
  BrokerConnectRequest, BrokerConnectResponse,
  BrokerDisconnectRequest, BrokerDisconnectResponse,
  BrokerGetQuotesRequest, BrokerGetQuotesResponse,
  BrokerSubscribeRequest, BrokerSubscribeResponse,
  BrokerGetAccountsRequest, BrokerGetAccountsResponse,
  BrokerGetPositionsRequest, BrokerGetPositionsResponse,
  BrokerPlaceOrderRequest, BrokerPlaceOrderResponse,
  BrokerCancelOrderRequest, BrokerCancelOrderResponse,
  BrokerGetOrdersRequest, BrokerGetOrdersResponse,
  BrokerGetStatusRequest, BrokerGetStatusResponse,
} from './schemas/broker';

// ═══════════ Tier 1: Trade (6 channels) ════════════════
export {
  TradeExecuteRequest, TradeExecuteResponse,
  TradeCancelRequest, TradeCancelResponse,
  EmergencyStopRequest, EmergencyStopResponse,
  TradeGetOrdersRequest, TradeGetOrdersResponse,
  TradeGetSummaryRequest, TradeGetSummaryResponse,
  TradeGetPositionsRequest, TradeGetPositionsResponse,
  TradeConfirmSignalRequest, TradeConfirmSignalResponse,
} from './schemas/trade';

// ═══════════ Tier 1: Risk (5 channels) ═════════════════
export {
  RiskSnapshotRequest, RiskSnapshotResponse,
  RiskAlertsRequest, RiskAlertsResponse,
  RiskConfigUpdateRequest, RiskConfigUpdateResponse,
  DrawdownStateRequest, DrawdownStateResponse,
  KellyStatsRequest, KellyStatsResponse,
} from './schemas/risk';

// ═══════════ Tier 2: Chart / Data (10 channels) ════════
export {
  GetKlinesRequest, GetKlinesResponse,
  IndicatorComputeRequest, IndicatorComputeResponse,
  GetOrderBookRequest, GetOrderBookResponse,
  AlertSubscribeRequest,
  ScannerSearchRequest,
  DataNewsRequest, DataNewsResponse,
  FundFlowRequest,
  WsConnectRequest,
  WsSubscribeRequest,
} from './schemas/chart';

// ═══════════ Tier 3: Management (15 channels) ══════════
export {
  CacheGetRequest, CacheSetRequest, CacheDeleteRequest,
  CacheStatsResponse,
  DbGetSettingsResponse, DbSaveSettingsRequest,
  PrefsGetRequest, PrefsSetRequest,
  NotificationSendRequest,
  CronScheduleRequest,
  SnapshotCaptureRequest, SnapshotListRequest,
  VersionGetRequest,
  DashboardSummaryResponse,
  ConditionRulesResponse,
} from './schemas/management';
