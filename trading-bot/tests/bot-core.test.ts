import { describe, expect, it } from "vitest";
import { parseEvent } from "../src/kafka/eventParser.js";
import { simpleMovingAverage, movingAverageCrossover } from "../src/strategy/indicators.js";
import { DecisionEngine } from "../src/strategy/decisionEngine.js";
import { loadConfig } from "../src/config.js";
import { RiskManager } from "../src/risk/riskManager.js";
import { RateLimiter } from "../src/utils/rateLimiter.js";
import type { MarketTick, PortfolioSnapshot } from "../src/types.js";

const tick = (close: number, date = "2026-10-29"): MarketTick => ({
  event_type: "market_tick", timestamp: "2026-10-29T10:00:00Z",
  simulated_date: date, ticker: "DYNAMIC", open: close, high: close,
  low: close, close, volume: 100,
});

describe("market event parsing", () => {
  it("parses a valid market tick", () => {
    expect(parseEvent(JSON.stringify({ event_type: "market_tick", timestamp: "now",
      simulated_date: "2026-01-01", data: { ticker: "X", open: 10, high: 12, low: 9, close: 11, volume: 20 } })))
      .toMatchObject({ event_type: "market_tick", ticker: "X", close: 11 });
  });
  it("parses a valid news flash", () => {
    expect(parseEvent(JSON.stringify({ event_type: "news_flash", timestamp: "now", data: {
      ticker: "X", headline: "Growth", description: "Expansion",
    } }))).toMatchObject({ event_type: "news_flash", headline: "Growth" });
  });
  it("rejects malformed JSON and missing/invalid market prices", () => {
    expect(parseEvent("{")).toBeNull();
    expect(parseEvent(JSON.stringify({ event_type: "market_tick", timestamp: "now",
      simulated_date: "today", data: { ticker: "X", open: 1, high: 2, low: 0, close: 1, volume: 1 } })))
      .toBeNull();
  });
  it("parses preflight heartbeat sequence from documented data payload", () => {
    expect(parseEvent(JSON.stringify({ event_type: "preflight_tick", data: { seq: 14 } })))
      .toEqual({ event_type: "preflight_tick", seq: 14 });
  });
});

describe("indicators and deterministic strategy", () => {
  it("calculates SMA and identifies only genuine crossover events", () => {
    expect(simpleMovingAverage([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(movingAverageCrossover([...Array(20).fill(10), 11], 5, 20)).toBe("bullish");
    expect(movingAverageCrossover([...Array(20).fill(10), 9], 5, 20)).toBe("bearish");
    expect(movingAverageCrossover(Array(20).fill(10), 5, 20)).toBeNull();
  });
  it("keeps decisions deterministic and does not repeat one same-day crossover", () => {
    const engine = new DecisionEngine(5, 20);
    engine.addHistory("DYNAMIC", Array(20).fill(10));
    expect(engine.onTick(tick(11)).action).toBe("BUY");
    expect(engine.onTick(tick(11)).action).toBe("HOLD");
  });
  it("bounds its tracked-symbol state", () => {
    const engine = new DecisionEngine(5, 20, 250, 1);
    engine.addHistory("DYNAMIC", Array(20).fill(10));
    expect(engine.onTick({ ...tick(11), ticker: "UNSEEN" }).action).toBe("HOLD");
  });
});

function testConfig() {
  return {
    teamUsername: "", venuePortalUrl: "http://127.0.0.1:3003",
    kafkaBrokers: [], botApiBase: "", botAccessToken: "",
    tradingEnabled: false, acknowledgePreflight: false, enableShorts: false,
    fastSmaPeriod: 5, slowSmaPeriod: 20,
    cashReservePct: 25, maxPositionPct: 10, maxPortfolioExposurePct: 60,
    maxOpenPositions: 6, maxOrderQty: 1_000_000, stopLossPct: 3, requestsPerMinuteLimit: 90,
    stagePollIntervalMs: 2500, portfolioMaxAgeMs: 10000,
    supabaseUrl: "", supabaseServiceRoleKey: "",
  };
}

describe("risk management and rate limiting", () => {
  const portfolio: PortfolioSnapshot = {
    cash: 1_000_000, lockedMargin: 0, totalWealth: 1_000_000,
    positions: {}, receivedAt: Date.now(),
  };
  const context = (signalKey = "signal") => ({
    running: true, activeTickers: new Set(["DYNAMIC"]), price: 100,
    simulatedDate: "2026-10-29", portfolio, now: Date.now(), signalKey,
  });
  it("enforces reserve, active simulation, holdings, shorts, and duplicate signal rules", () => {
    const manager = new RiskManager(testConfig());
    expect(manager.validate({ ticker: "DYNAMIC", action: "BUY", quantity: 8000, date: "2026-10-29" }, context()).allowed).toBe(false);
    expect(manager.validate({ ticker: "DYNAMIC", action: "BUY", quantity: 1, date: "2026-10-29" },
      { ...context(), running: false }).allowed).toBe(false);
    expect(manager.validate({ ticker: "DYNAMIC", action: "SHORT", quantity: 1, date: "2026-10-29" }, context()).allowed).toBe(false);
    expect(manager.validate({ ticker: "DYNAMIC", action: "SELL", quantity: 1, date: "2026-10-29" }, context()).allowed).toBe(false);
    expect(manager.validate({ ticker: "DYNAMIC", action: "COVER", quantity: 1, date: "2026-10-29" }, context()).allowed).toBe(false);
    const buy = { ticker: "DYNAMIC", action: "BUY" as const, quantity: 1, date: "2026-10-29" };
    expect(manager.validate(buy, context("unique")).allowed).toBe(true);
    expect(manager.validate(buy, context("unique")).allowed).toBe(false);
    expect(manager.validate({ ...buy, quantity: 1_000_001 }, context("large")).allowed).toBe(false);
  });
  it("applies the request limiter to requests within a sliding window", async () => {
    const limiter = new RateLimiter(1, 20);
    await limiter.waitForSlot();
    const started = Date.now();
    await limiter.waitForSlot();
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });
  it("loads the default dry-run configuration without credentials", () => {
    const previous = process.env.TRADING_ENABLED;
    process.env.TRADING_ENABLED = "true";
    expect(loadConfig().tradingEnabled).toBe(false);
    if (previous !== undefined) process.env.TRADING_ENABLED = previous;
    else delete process.env.TRADING_ENABLED;
  });
});
