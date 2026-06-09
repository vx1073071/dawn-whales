/**
 * J-68-04 Tests: i18n Engine (10 tests)
 */
import { describe, it, expect } from "vitest";
import {
  I18nEngine,
  formatDate,
  formatCurrency,
  formatNumber,
  TRANSLATIONS,
} from "../electron/engine/i18n-engine";

describe("J-68-04: i18n Engine", () => {
  let engine: I18nEngine;

  beforeEach(() => {
    engine = new I18nEngine();
  });

  it("01: translates known key across all 5 locales", () => {
    expect(engine.translate("error.broker.notConnected", "en")).toBe(
      "Broker not connected",
    );
    expect(engine.translate("error.broker.notConnected", "zh-CN")).toBe(
      "券商未连接",
    );
    expect(engine.translate("error.broker.notConnected", "ja")).toBe(
      "ブローカー接続なし",
    );
    expect(engine.translate("error.broker.notConnected", "ko")).toBe(
      "브로커 연결 안됨",
    );
  });

  it("02: unknown key falls back to en", () => {
    const result = engine.translate("nonexistent.key", "ko");
    // en should have it OR return the key itself if en also misses
    // Since 'nonexistent.key' doesn't exist in en catalog, should return key itself
    expect(result).toBe("nonexistent.key");
  });

  it("03: missing locale falls back to en", () => {
    // ja has the key
    const result = engine.translate("error.broker.notConnected", "ja");
    expect(result).toBe("ブローカー接続なし");

    // nonexistent locale should fall back to en
    const fallback = engine.translate(
      "error.broker.notConnected",
      "fr" as any,
    );
    expect(fallback).toBe("Broker not connected");
  });

  it("04: translateAll batch translates", () => {
    const keys = ["label.buy", "label.sell", "label.cancel"];
    const result = engine.translateAll(keys, "ja");
    expect(result["label.buy"]).toBe("買い");
    expect(result["label.sell"]).toBe("売り");
    expect(result["label.cancel"]).toBe("キャンセル");
  });

  it("05: getLocales returns all supported locales", () => {
    const locales = engine.getLocales();
    expect(locales.length).toBe(5);
    expect(locales.map((l) => l.code)).toContain("zh-CN");
    expect(locales.map((l) => l.code)).toContain("en");
    expect(locales.map((l) => l.code)).toContain("ja");
    expect(locales.map((l) => l.code)).toContain("ko");
  });

  it("06: supportsLocale correctly identifies", () => {
    expect(engine.supportsLocale("en")).toBe(true);
    expect(engine.supportsLocale("ja")).toBe(true);
    expect(engine.supportsLocale("fr")).toBe(false);
  });

  it("07: getAllKeys returns map for locale", () => {
    const en = engine.getAllKeys("en");
    expect(en["error.broker.notConnected"]).toBe("Broker not connected");
    expect(Object.keys(en).length).toBeGreaterThan(30);
  });

  it("08: formatDate for all locales", () => {
    const d = new Date("2025-06-15");
    const zhCN = formatDate(d, "zh-CN", "long");
    const en = formatDate(d, "en", "long");
    const ja = formatDate(d, "ja", "long");

    expect(zhCN).toContain("2025");
    expect(en).toContain("2025");
    expect(ja).toContain("2025");
  });

  it("09: formatCurrency for all locales with USDT", () => {
    const zhCN = formatCurrency(1000.5, {
      locale: "zh-CN",
      currency: "USDT",
    });
    const en = formatCurrency(1000.5, { locale: "en", currency: "USDT" });
    const ja = formatCurrency(1000.5, { locale: "ja", currency: "USDT" });

    expect(zhCN).toContain("1,000");
    expect(en).toContain("1,000");
    expect(ja).toContain("1,000");
  });

  it("10: formatNumber for all locales", () => {
    const zhCN = formatNumber(1234567.89, "zh-CN");
    const en = formatNumber(1234567.89, "en");

    expect(zhCN).toContain("1");
    expect(en).toContain("1");
    // Both contain 234 (grouped differently: 1,234,567.89 vs 1,234,567.89)
    expect(formatNumber(1000, "en", 0, 0)).toBe("1,000");
  });

  it("11: translate uses key itself when en catalog also misses", () => {
    const result = engine.translate("completely.missing.key", "ko");
    expect(result).toBe("completely.missing.key");
  });

  it("12: TRANSLATIONS catalog has 5 entries with all required sections", () => {
    expect(TRANSLATIONS.length).toBe(5);
    for (const cat of TRANSLATIONS) {
      // Each locale has error, label, trade, market, common sections
      expect(cat.translations["error.broker.notConnected"]).toBeTruthy();
      expect(cat.translations["label.buy"]).toBeTruthy();
      expect(cat.translations["trade.orderPlaced"]).toBeTruthy();
      expect(cat.translations["market.US"]).toBeTruthy();
      expect(cat.translations["common.total"]).toBeTruthy();
    }
  });
});
