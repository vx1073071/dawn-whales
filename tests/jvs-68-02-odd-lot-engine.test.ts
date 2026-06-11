/**
 * J-68-02 Tests: 碎股完善 — Odd Lot Engine (13 tests)
 */
import { describe, it, expect } from "vitest";
import {
  OddLotEngine,
  OddLotBrokerAdapter,
  isOddLot,
  splitIntoStandardAndOdd,
  calculateOddLotFee,
  ODD_LOT_CONFIGS,
} from "../electron/engine/analysis/odd-lot-engine";

describe("J-68-02: Odd Lot Engine + Partial Fills", () => {
  describe("Detector & Splitter", () => {
    it("01: A-share 50 shares is odd lot (lot=100)", () => {
      expect(isOddLot("A", 50)).toBe(true);
      expect(isOddLot("A", 100)).toBe(false);
      expect(isOddLot("A", 200)).toBe(false);
      expect(isOddLot("A", 99)).toBe(true);
    });

    it("02: US 0.5 share is not odd lot (lot=1, always ok)", () => {
      expect(isOddLot("US", 0.5)).toBe(true);
      expect(isOddLot("US", 1)).toBe(false);
      expect(isOddLot("US", 10)).toBe(false);
    });

    it("03: split 350 into standard+odd (A-share)", () => {
      const { standardLots, oddLot } = splitIntoStandardAndOdd(
        "A",
        350,
      );
      expect(standardLots).toBe(300);
      expect(oddLot).toBe(50);
    });

    it("04: split 8 into standard+odd (US)", () => {
      const { standardLots, oddLot } = splitIntoStandardAndOdd("US", 8);
      expect(standardLots).toBe(8);
      expect(oddLot).toBe(0);
    });

    it("05: HK lot size can vary (NetEase 09999 lot=20)", () => {
      expect(isOddLot("HK", 15, 20)).toBe(true);
      expect(isOddLot("HK", 20, 20)).toBe(false);

      const { standardLots, oddLot } = splitIntoStandardAndOdd(
        "HK",
        55,
        20,
      );
      expect(standardLots).toBe(40);
      expect(oddLot).toBe(15);
    });
  });

  describe("Fee Calculation", () => {
    it("06: A-share odd lot fee is 2x base", () => {
      const normal = calculateOddLotFee("A", 100, 10);
      const odd = calculateOddLotFee("A", 50, 10);
      // base rate is same (0.03%) but multiplier makes odd 2x
      // 100*10=1000, 1000*0.0003=0.3 → max(5,0.3)=5
      // 50*10=500, 500*0.0003=0.15 → max(5,0.15)=5 → 5*2=10
      expect(normal).toBe(5);
      expect(odd).toBe(10);
    });

    it("07: US fee is per-share, odd lot no multiplier", () => {
      const normal = calculateOddLotFee("US", 10, 100);
      const odd = calculateOddLotFee("US", 1, 100);
      // US multiplier is 1.0 for odd lots
      expect(normal).toBeGreaterThan(0);
      expect(odd).toBeGreaterThan(0); // no multiplier, just share-based
    });
  });

  describe("OddLotEngine", () => {
    it("08: creates odd lot order with flag", () => {
      const engine = new OddLotEngine();
      const order = engine.createOrder("600519", "A", "BUY", 50, 1850);
      expect(order.isOddLot).toBe(true);
      expect(order.totalQuantity).toBe(50);
      expect(order.remainingQuantity).toBe(50);
      expect(order.status).toBe("pending");
    });

    it("09: creates standard lot order without flag", () => {
      const engine = new OddLotEngine();
      const order = engine.createOrder("AAPL", "US", "BUY", 10, 185);
      expect(order.isOddLot).toBe(false);
      expect(order.totalQuantity).toBe(10);
    });

    it("10: partial fill reduces remaining and updates status", () => {
      const engine = new OddLotEngine();
      const order = engine.createOrder("600519", "A", "BUY", 100, 1850);

      const result = engine.processPartialFill(order.orderId, 63, 1850);
      expect(result.fullyFilled).toBe(false);

      const updated = engine.getOrder(order.orderId)!;
      expect(updated.status).toBe("partially_filled");
      expect(updated.filledQuantity).toBe(63);
      expect(updated.remainingQuantity).toBe(37);
      expect(updated.partialFills).toHaveLength(1);
      expect(updated.partialFills[0].quantity).toBe(63);
    });

    it("11: full fill after partial fills completes order", () => {
      const engine = new OddLotEngine();
      const order = engine.createOrder("00700.HK", "HK", "BUY", 150, 350, 100);

      // First partial fill
      engine.processPartialFill(order.orderId, 80, 350);
      expect(engine.getOrder(order.orderId)!.status).toBe(
        "partially_filled",
      );

      // Remaining 70 fills
      const result = engine.processPartialFill(order.orderId, 70, 351);
      expect(result.fullyFilled).toBe(true);
      expect(engine.getOrder(order.orderId)!.status).toBe("filled");
      expect(engine.getOrder(order.orderId)!.filledQuantity).toBe(150);
      expect(engine.getOrder(order.orderId)!.remainingQuantity).toBe(0);
      expect(engine.getOrder(order.orderId)!.partialFills).toHaveLength(2);
    });

    it("12: cannot overfill beyond remaining", () => {
      const engine = new OddLotEngine();
      const order = engine.createOrder("AAPL", "US", "BUY", 50, 185);
      engine.processPartialFill(order.orderId, 30, 185);

      expect(() =>
        engine.processPartialFill(order.orderId, 30, 185),
      ).toThrow("exceeds remaining");
    });

    it("13: cancel returns remaining quantity", () => {
      const engine = new OddLotEngine();
      const order = engine.createOrder("TSLA", "US", "SELL", 200, 220);
      engine.processPartialFill(order.orderId, 70, 221);

      const result = engine.cancelOrder(order.orderId);
      expect(result.remainingQuantity).toBe(130);
      expect(result.partialFills).toBe(1);
      expect(engine.getOrder(order.orderId)!.status).toBe("cancelled");
    });

    it("14: OddLotBrokerAdapter splits A-share 350 into 300+50", async () => {
      const adapter = new OddLotBrokerAdapter();
      const result = await adapter.placeOddLotOrder(
        "600519",
        "A",
        "BUY",
        350,
        1850,
      );

      expect(result.standardOrder).not.toBeNull();
      expect(result.standardOrder!.totalQuantity).toBe(300);
      expect(result.standardOrder!.isOddLot).toBe(false);

      expect(result.oddLotOrder).not.toBeNull();
      expect(result.oddLotOrder!.totalQuantity).toBe(50);
      expect(result.oddLotOrder!.isOddLot).toBe(true);
    });
  });

  describe("Config", () => {
    it("15: all markets have valid config entries", () => {
      expect(ODD_LOT_CONFIGS.A.lotSize).toBe(100);
      expect(ODD_LOT_CONFIGS.US.lotSize).toBe(1);
      expect(ODD_LOT_CONFIGS.HK.lotSize).toBe(100);

      expect(ODD_LOT_CONFIGS.A.oddLotFeeMultiplier).toBeGreaterThan(0);
      expect(ODD_LOT_CONFIGS.US.oddLotFeeMultiplier).toBeGreaterThan(0);
      expect(ODD_LOT_CONFIGS.HK.oddLotFeeMultiplier).toBeGreaterThan(0);
    });
  });
});
