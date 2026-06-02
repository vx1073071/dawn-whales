// ── Futu OpenD TCP Client — 直连 OpenD（无需 Bridge）────────────────────────
// Ported from trading-blueprint-git/bridge-source/index.ts
// Uses futu-api protobuf definitions + raw TCP (net.Socket)

import net from 'net';
import { createHash } from 'crypto';
import log from 'electron-log';

type QuotePushCallback = (quotes: any[]) => void;

// Load futu-api protobuf definitions
let futuProtoRoot: any = null;
try {
  futuProtoRoot = require('futu-api/proto.js');
  if (futuProtoRoot?.default) futuProtoRoot = futuProtoRoot.default;
  log.info('[FutuOpenD] Protobuf loaded');
} catch (e: any) {
  log.error('[FutuOpenD] Protobuf load failed:', e.message);
}

// Market codes: Qot_Common.QotMarket
const MARKET: Record<string, number> = { HK: 1, US: 11, SH: 21, SZ: 22, CC: 91 };
const MARKET_REV: Record<number, string> = { 1: 'HK', 11: 'US', 21: 'SH', 22: 'SZ', 91: 'CC' };

// Command definitions
const CMD = {
  InitConnect: { cmd: 1001, name: 'InitConnect' },
  QotSub: { cmd: 3001, name: 'Qot_Sub' },
  QotGetBasicQot: { cmd: 3004, name: 'Qot_GetBasicQot' },
  QotGetKL: { cmd: 3006, name: 'Qot_GetKL' },
  QotRequestHistoryKL: { cmd: 3103, name: 'Qot_RequestHistoryKL' },
  TrdGetAccList: { cmd: 2001, name: 'Trd_GetAccList' },
  TrdUnlockTrade: { cmd: 2005, name: 'Trd_UnlockTrade' },
  TrdGetFunds: { cmd: 2101, name: 'Trd_GetFunds' },
  TrdGetPositionList: { cmd: 2102, name: 'Trd_GetPositionList' },
  TrdGetOrderList: { cmd: 2201, name: 'Trd_GetOrderList' },
  TrdPlaceOrder: { cmd: 2202, name: 'Trd_PlaceOrder' },
  TrdCancelOrder: { cmd: 2205, name: 'Trd_ModifyOrder' },
};

// K-line period mapping: Qot_Common.KLType
const KL_PERIOD: Record<string, number> = {
  '1m': 1, '5m': 5, '15m': 15, '30m': 30, '60m': 60,
  'daily': 4, 'weekly': 5, 'monthly': 6,
};

function marketCode(code: string): number {
  const prefix = code.split('.')[0];
  return MARKET[prefix] ?? 11;
}

function symOf(code: string): string {
  return code.split('.').slice(1).join('.');
}

// Convert protobuf Long {low, high} to number
function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && 'low' in v) {
    const lo = v.low >>> 0;
    const hi = (v.high | 0) * 0x100000000;
    return v.unsigned ? hi + lo : hi + lo;
  }
  return Number(v) || 0;
}

export class FutuOpenDClient {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private serial = 1000;
  private connID = 0;
  private buffer = Buffer.alloc(0);
  private pending = new Map<number, { resolve: (v: Buffer) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private pushCallback: QuotePushCallback | null = null;
  public connected = false;

  constructor(host: string = '127.0.0.1', port: number = 11111) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    if (!futuProtoRoot) throw new Error('Protobuf definitions not loaded');

    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection({ host: this.host, port: this.port });
      const timer = setTimeout(() => { s.destroy(); reject(new Error(`Connection timeout to ${this.port}`)); }, 5000);
      s.once('connect', () => { clearTimeout(timer); resolve(s); });
      s.once('error', (e) => { clearTimeout(timer); reject(e); });
    });

    this.socket.setKeepAlive(true, 30000);
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('close', () => {
      this.connected = false;
      this.rejectAll(new Error('OpenD disconnected'));
      log.info('[FutuOpenD] Disconnected');
    });

    // InitConnect handshake
    const res = await this.send(CMD.InitConnect, {
      c2s: {
        clientVer: 106,
        clientID: 'DawnWhales-Desktop',
        recvNotify: true,
        packetEncAlgo: -1,
        pushProtoFmt: 0,
        programmingLanguage: 'TypeScript',
      },
    }, 10000);

    this.connID = Number(res?.s2c?.connID ?? 0);
    this.connected = true;
    log.info(`[FutuOpenD] Connected to ${this.host}:${this.port}, connID=${this.connID}`);
  }

  disconnect() {
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
    this.rejectAll(new Error('Disconnected'));
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 44) {
      if (this.buffer.subarray(0, 2).toString() !== 'FT') {
        this.rejectAll(new Error('Invalid OpenD response'));
        this.socket?.destroy();
        return;
      }
      const protoID = this.buffer.readUInt32LE(2);
      const serial = this.buffer.readUInt32LE(8);
      const bodyLen = this.buffer.readUInt32LE(12);
      if (this.buffer.length < 44 + bodyLen) return;

      const body = this.buffer.subarray(44, 44 + bodyLen);
      this.buffer = this.buffer.subarray(44 + bodyLen);

      // Push: protoID 3005 = QotUpdateBasicQot
      if (protoID === 3005 && this.pushCallback) {
        try {
          const PushResp = futuProtoRoot.lookup('Qot_UpdateBasicQot.Response');
          const decoded = PushResp.decode(body);
          if (decoded?.retType === 0) {
            const quotes = this.parsePushQuotes(decoded);
            if (quotes.length > 0) this.pushCallback(quotes);
          }
        } catch (e: any) {
          log.warn('[FutuOpenD] Push decode error:', e.message);
        }
        continue;
      }

      const item = this.pending.get(serial);
      if (item) {
        clearTimeout(item.timer);
        this.pending.delete(serial);
        item.resolve(body);
      }
    }
  }

  private rejectAll(error: Error) {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    this.pending.clear();
  }

  private async send(cmd: { cmd: number; name: string }, req: Record<string, unknown>, timeout = 15000): Promise<any> {
    if (!this.socket) throw new Error('Not connected');
    const Request = futuProtoRoot.lookup(`${cmd.name}.Request`);
    const Response = futuProtoRoot.lookup(`${cmd.name}.Response`);
    const body = Buffer.from(Request.encode(Request.create(req)).finish());
    const serial = ++this.serial;

    const header = Buffer.alloc(44);
    header.write('FT', 0, 'ascii');
    header.writeUInt32LE(cmd.cmd, 2);
    header.writeUInt8(0, 6);
    header.writeUInt8(0, 7);
    header.writeUInt32LE(serial, 8);
    header.writeUInt32LE(body.length, 12);
    createHash('sha1').update(body).digest().copy(header, 16);

    const raw = await new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(serial); reject(new Error(`${cmd.name} timeout`)); }, timeout);
      this.pending.set(serial, { resolve, reject, timer });
      this.socket!.write(Buffer.concat([header, body]));
    });

    const decoded = Response.decode(raw);
    if (decoded?.retType !== 0) throw new Error(decoded?.retMsg ?? `${cmd.name} failed`);
    return decoded;
  }

  // ── Push 实时行情（<50ms 延迟）─────────────────────────────────────

  onQuotePush(callback: QuotePushCallback) {
    this.pushCallback = callback;
  }

  async subscribeAndPush(codes: string[]): Promise<void> {
    const securityList = codes.map((c) => ({ market: marketCode(c), code: symOf(c) }));
    await this.send(CMD.QotSub, {
      c2s: {
        securityList,
        subTypeList: [1],
        isSubOrUnSub: true,
        isRegOrUnRegPush: true,
        isFirstPush: true,
      },
    });
    log.info(`[FutuOpenD] Subscribed + push: ${codes.join(', ')}`);
  }

  private parsePushQuotes(decoded: any): any[] {
    return (decoded?.s2c?.basicQotList ?? []).map((q: any) => {
      const prefix = MARKET_REV[q.security?.market] ?? 'US';
      const code = `${prefix}.${q.security?.code}`;
      const prevClose = toNum(q.prevClosePrice);
      const price = toNum(q.curPrice);
      return {
        code, price,
        change: prevClose > 0 ? Math.round((price - prevClose) * 100) / 100 : 0,
        changePct: prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0,
        volume: toNum(q.volume), amount: toNum(q.turnover),
        open: toNum(q.openPrice), high: toNum(q.highPrice),
        low: toNum(q.lowPrice), prevClose,
        updateTime: new Date().toISOString(),
      };
    });
  }

  // ── Market Data ────────────────────────────────────────────────────────

  async getQuotes(codes: string[]): Promise<any[]> {
    const securityList = codes.map((c) => ({ market: marketCode(c), code: symOf(c) }));

    // Subscribe first (no push, for one-shot pull)
    await this.send(CMD.QotSub, {
      c2s: { securityList, subTypeList: [1], isSubOrUnSub: true, isRegOrUnRegPush: false, isFirstPush: true },
    });

    // Get quotes
    const res: any = await this.send(CMD.QotGetBasicQot, { c2s: { securityList } });
    return (res?.s2c?.basicQotList ?? []).map((q: any) => {
      const prefix = MARKET_REV[q.security?.market] ?? 'US';
      const code = `${prefix}.${q.security?.code}`;
      const prevClose = toNum(q.prevClosePrice);
      const price = toNum(q.curPrice);
      const open = toNum(q.openPrice);
      const high = toNum(q.highPrice);
      const low = toNum(q.lowPrice);
      const volume = toNum(q.volume);
      const change = prevClose > 0 ? price - prevClose : 0;
      const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
      const amplitude = prevClose > 0 ? ((high - low) / prevClose) * 100 : 0;

      return {
        code, name: q.name ?? code, price, prevClose, open, high, low, volume,
        change: Math.round(change * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        amplitude: Math.round(amplitude * 100) / 100,
        updateTime: new Date().toISOString(),
      };
    });
  }

  async getKlines(code: string, period: string = 'daily', count: number = 200): Promise<any[]> {
    const klType = KL_PERIOD[period] ?? 4;
    const security = { market: marketCode(code), code: symOf(code) };

    const res: any = await this.send(CMD.QotGetKL, {
      c2s: { security, reqType: 1, subType: klType, kLineCount: count, needField: 0 },
    }, 20000);

    return (res?.s2c?.kLineList ?? []).map((k: any) => ({
      time: k.timeKey ? Math.floor(k.timeKey / 1000) : 0,
      open: toNum(k.openPrice),
      high: toNum(k.highPrice),
      low: toNum(k.lowPrice),
      close: toNum(k.closePrice),
      volume: toNum(k.volume),
    })).filter((k: any) => k.open > 0);
  }

  // ── Trading ────────────────────────────────────────────────────────────

  async getAccounts(): Promise<any[]> {
    const res: any = await this.send(CMD.TrdGetAccList, { c2s: { userID: 0 } }, 10000);
    return (res?.s2c?.accList ?? [])
      .filter((a: any) => a.trdEnv === 1)  // REAL env only
      .map((a: any) => ({ accId: String(a.accID), trdEnv: 'REAL' }));
  }

  async getFunds(accountId: string): Promise<any> {
    const trdHeader = { trdEnv: 1, accID: Number(accountId), trdMarket: 11 };
    const res: any = await this.send(CMD.TrdGetFunds, { c2s: { header: trdHeader } });
    const f = res?.s2c?.funds;
    if (!f) return null;
    return {
      totalAssets: toNum(f.totalAssets),
      cash: toNum(f.cash),
      power: toNum(f.maxPowerShort ?? f.buyingPower ?? f.cash),
      marketVal: toNum(f.marketVal),
      frozenCash: toNum(f.frozenCash),
      todayPnl: toNum(f.todayPnl ?? f.todayPl ?? 0),
      currency: 'USD',
    };
  }

  async getPositions(accountId: string): Promise<any[]> {
    const trdHeader = { trdEnv: 1, accID: Number(accountId), trdMarket: 11 };
    const res: any = await this.send(CMD.TrdGetPositionList, {
      c2s: { header: trdHeader, filterConditions: { filterPLRatioMin: -999, filterPLRatioMax: 999 } },
    });

    return (res?.s2c?.positionList ?? []).map((p: any) => {
      const code = `${MARKET_REV[p.security?.market] ?? 'US'}.${p.security?.code}`;
      const qty = toNum(p.qty);
      const canSell = toNum(p.canSellQty);
      const avgCost = toNum(p.costPrice);
      const curPrice = toNum(p.valuationPrice ?? p.curPrice ?? 0);
      const marketVal = toNum(p.valuationPrice ?? 0) * qty;
      const pnl = toNum(p.plVal ?? 0);
      const pnlPct = avgCost > 0 ? ((curPrice - avgCost) / avgCost) * 100 : 0;

      return { code, name: p.name ?? code, qty, canSellQty: canSell, avgCost, curPrice, marketVal, pnl, pnlPct: Math.round(pnlPct * 100) / 100 };
    });
  }

  async getOrders(accountId: string): Promise<any[]> {
    const trdHeader = { trdEnv: 1, accID: Number(accountId), trdMarket: 11 };
    const res: any = await this.send(CMD.TrdGetOrderList, { c2s: { header: trdHeader } });

    return (res?.s2c?.orderList ?? []).map((o: any) => ({
      orderId: String(o.orderID ?? o.orderIDEx ?? ''),
      code: `${MARKET_REV[o.security?.market] ?? 'US'}.${o.security?.code}`,
      name: o.name ?? '',
      side: o.trdSide === 1 ? 'BUY' : 'SELL',
      orderType: o.orderType,
      qty: toNum(o.qty),
      price: toNum(o.price),
      filledQty: toNum(o.dealQty ?? 0),
      filledPrice: toNum(o.dealAvgPrice ?? 0),
      status: ['SUBMITTED', 'WAITING', 'FILLED', 'PARTIAL', 'CANCELLED', 'REJECTED', ''][o.orderStatus ?? 0] ?? 'UNKNOWN',
      createTime: o.createTime ?? '',
      updateTime: o.updateTime ?? '',
    }));
  }

  async placeOrder(order: any): Promise<any> {
    const trdHeader = { trdEnv: order.trdEnv === 'SIMULATE' ? 0 : 1, accID: Number(order.accountId), trdMarket: marketCode(order.code) };
    const res: any = await this.send(CMD.TrdPlaceOrder, {
      c2s: {
        header: trdHeader,
        trdSide: order.side === 'BUY' ? 1 : 2,
        orderType: order.orderType === 'LIMIT' ? 1 : 2,
        qty: order.qty,
        price: order.price ?? 0,
        code: symOf(order.code),
        remark: order.remark ?? '',
      },
    });
    const orderId = String(res?.s2c?.orderID ?? res?.s2c?.orderIDEx ?? '');
    log.info('[FutuOpenD] Order placed:', orderId, order.code, order.side, order.qty);
    return { orderId };
  }

  async cancelOrder(orderId: string, accountId: string, code: string): Promise<void> {
    const trdHeader = { trdEnv: 1, accID: Number(accountId), trdMarket: marketCode(code) };
    await this.send(CMD.TrdCancelOrder, {
      c2s: { header: trdHeader, orderID: Number(orderId), modifyOrderOp: 3 },
    });
    log.info('[FutuOpenD] Order cancelled:', orderId);
  }
}
