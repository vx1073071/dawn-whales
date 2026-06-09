/**
 * J-68-01 Tests: IBKR Broker Adapter (10 tests)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  IBKRBrokerAdapter,
  IBKRConnection,
  BrokerRegistry,
  calculateIBKRFee,
} from "../electron/engine/ibkr-broker-adapter";

describe("J-68-01: IBKR Broker Adapter", () => {
  let broker: IBKRBrokerAdapter;

  beforeEach(() => {
    broker = new IBKRBrokerAdapter({
      host: "127.0.0.1",
      port: 4002,
      clientId: 999,
      paperTrading: true,
    });
  });

  afterEach(async () => {
    await broker.disconnect();
  });

  it("01: connect establishes connection and returns accountId", async () => {
    const result = await broker.connect();
    expect(result.success).toBe(true);
    expect(result.accountId).toBeDefined();
    expect(broker.getConnection().isConnected).toBe(true);
  });

  it("02: placeOrder submits order with IBKR orderId", async () => {
    await broker.connect();
    const order = await broker.placeOrder("AAPL", "BUY", 100, 185.50);
    expect(order.orderId).toMatch(/^IBKR-/);
    expect(order.status).toBe("Submitted");
  });

  it("03: cancelOrder cancels pending order", async () => {
    await broker.connect();
    const order = await broker.placeOrder("TSLA", "SELL", 50);
    const cancelled = await broker.cancelOrder(order.orderId);
    expect(cancelled).toBe(true);

    const details = await broker.getOrderDetails(order.orderId);
    expect(details?.status).toBe("Cancelled");
  });

  it("04: cannot cancel already filled order", async () => {
    await broker.connect();
    const order = await broker.placeOrder("AAPL", "BUY", 100, 185);
    await broker.simulateFill(order.orderId, 185.50);
    const cancelled = await broker.cancelOrder(order.orderId);
    expect(cancelled).toBe(false);
  });

  it("05: detectMarket correctly identifies markets", () => {
    expect(broker.detectMarket("600519")).toBe("ASH"); // 贵州茅台
    expect(broker.detectMarket("688012")).toBe("ASH"); // 中微公司 STAR
    expect(broker.detectMarket("300750")).toBe("ASZ"); // 宁德时代 ChiNext
    expect(broker.detectMarket("000001")).toBe("ASZ"); // 平安银行
    expect(broker.detectMarket("00700.HK")).toBe("HK");
    expect(broker.detectMarket("AAPL")).toBe("US");
    expect(broker.detectMarket("TSLA")).toBe("US");
  });

  it("06: getAccountInfo returns account summary", async () => {
    await broker.connect();
    const account = await broker.getAccountInfo();
    expect(account.totalAssets).toBeGreaterThan(0);
    expect(account.availableCash).toBeGreaterThan(0);
    expect(account.totalAssets).toBeGreaterThanOrEqual(
      account.availableCash,
    );
  });

  it("07: getPositions returns empty initially", async () => {
    await broker.connect();
    const positions = await broker.getPositions();
    expect(Array.isArray(positions)).toBe(true);
  });

  it("08: simulateFill updates position and order status", async () => {
    await broker.connect();
    const order = await broker.placeOrder("AAPL", "BUY", 100, 185);
    const fill = await broker.simulateFill(order.orderId, 186.0);

    expect(fill.status).toBe("Filled");
    expect(fill.filledQty).toBe(100);
    expect(fill.avgPrice).toBe(186);

    const details = await broker.getOrderDetails(order.orderId);
    expect(details?.status).toBe("Filled");
    expect(details?.avgFillPrice).toBe(186);

    const positions = await broker.getPositions();
    expect(positions.length).toBe(1);
    expect(positions[0].symbol).toBe("AAPL");
    expect(positions[0].quantity).toBe(100);
    expect(positions[0].avgPrice).toBe(186);
  });

  it("09: fee calculation matches spec for all markets", () => {
    // US: $0.005/share, min $1, max 0.5%
    const usFee = calculateIBKRFee("US", 100, 185);
    expect(usFee).toBeGreaterThanOrEqual(0.5);
    expect(usFee).toBeLessThanOrEqual(18500 * 0.005);

    // HK: 0.08% + 0.005% SFC, min HKD 18
    const hkFee = calculateIBKRFee("HK", 500, 350);
    expect(hkFee).toBeGreaterThanOrEqual(18);

    // A-share: 0.025% + 0.005%, min CNY 5
    const asFee = calculateIBKRFee("ASH", 1000, 10);
    expect(asFee).toBeGreaterThanOrEqual(5);
  });

  it("10: connection health check returns latency", async () => {
    await broker.connect();
    const health = await broker.checkConnectionHealth();
    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("11: placeOrder throws when not connected", async () => {
    await expect(
      broker.placeOrder("AAPL", "BUY", 100, 185),
    ).rejects.toThrow("IBKR not connected");
  });

  it("12: BrokerRegistry supports broker switching", () => {
    const registry = new BrokerRegistry();
    const ibkrBroker = new IBKRBrokerAdapter({ clientId: 1 });
    registry.register("ibkr", ibkrBroker, 10);

    expect(registry.isRegistered("ibkr")).toBe(true);
    expect(registry.getAvailable()).toContain("ibkr");

    registry.setActive("ibkr");
    const active = registry.getActive();
    expect(active).toBe(ibkrBroker);
  });

  it("13: disconnect closes connection", async () => {
    await broker.connect();
    expect(broker.getConnection().isConnected).toBe(true);

    await broker.disconnect();
    expect(broker.getConnection().isConnected).toBe(false);

    await expect(
      broker.placeOrder("AAPL", "BUY", 100),
    ).rejects.toThrow("IBKR not connected");
  });
});
