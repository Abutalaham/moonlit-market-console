import { describe, expect, it } from "vitest";
import { deriveBotState, totalWealth, type Telemetry } from "@/lib/trading";
import { DEFAULT_STRATEGY, validateStrategy } from "@/lib/strategy";

const now = Date.parse("2026-03-14T10:00:00Z");
const tel = (over: Partial<Telemetry>): Telemetry => ({
  recorded_at: new Date(now - 1000).toISOString(),
  kafka_status: "connected", gateway_status: "connected", engine_status: "running",
  stage: "simulation", heartbeat_age_ms: 500, processing_latency_ms: 10,
  latest_market_event: null, last_order_at: null, error_count: 0, ...over,
});

describe("trading rules", () => {
  it("total wealth adds cash, margin, long and short value", () => {
    expect(totalWealth(600000, 50000, 300000, 20000)).toBe(970000);
  });
  it("no telemetry means no data, never ready", () => {
    expect(deriveBotState(null, now)).toBe("no-data");
  });
  it("heartbeat older than 15s is offline", () => {
    expect(deriveBotState(tel({ recorded_at: new Date(now - 16000).toISOString() }), now)).toBe("offline");
  });
  it("kafka down means waiting for venue even if engine says running", () => {
    expect(deriveBotState(tel({ kafka_status: "disconnected" }), now)).toBe("waiting-venue");
  });
  it("default strategy keeps a 25% cash reserve and is valid", () => {
    expect(DEFAULT_STRATEGY.risk.minCashReservePct).toBe(25);
    expect(validateStrategy(DEFAULT_STRATEGY)).toEqual({});
  });
  it("rejects slow lookback not longer than fast", () => {
    const c = structuredClone(DEFAULT_STRATEGY);
    c.trend.slowLookback = 5;
    expect(validateStrategy(c)["trend.slowLookback"]).toBeDefined();
  });
  it("rejects order quantity above the venue limit of 1,000,000", () => {
    const c = structuredClone(DEFAULT_STRATEGY);
    c.risk.maxOrderQty = 1_000_001;
    expect(validateStrategy(c)["risk.maxOrderQty"]).toBeDefined();
  });
});
