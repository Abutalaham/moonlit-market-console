import { describe, expect, it, vi } from "vitest";
import { BotRuntime } from "../src/runtime.js";
import { parseVenueStage } from "../src/api/competitionClient.js";
import type { BotConfig } from "../src/config.js";

const config: BotConfig = {
  teamUsername: "offline-team",
  venuePortalUrl: "http://127.0.0.1:3003",
  kafkaBrokers: [],
  botApiBase: "",
  botAccessToken: "",
  tradingEnabled: false,
  acknowledgePreflight: false,
  enableShorts: false,
  fastSmaPeriod: 5,
  slowSmaPeriod: 20,
  cashReservePct: 25,
  maxPositionPct: 10,
  maxPortfolioExposurePct: 60,
  maxOpenPositions: 6,
  maxOrderQty: 1_000_000,
  stopLossPct: 3,
  requestsPerMinuteLimit: 90,
  stagePollIntervalMs: 2500,
  portfolioMaxAgeMs: 10_000,
  supabaseUrl: "",
  supabaseServiceRoleKey: "",
};

function message(close: number, eventType = "market_tick", seq?: number): string {
  return JSON.stringify(eventType === "preflight_tick"
    ? { event_type: eventType, data: { seq } }
    : {
      event_type: eventType,
      timestamp: "2026-10-29T10:00:00Z",
      simulated_date: "2026-10-29",
      data: { ticker: "TICK", open: close, high: close, low: close, close, volume: 100 },
    });
}

describe("dry-run runtime controls", () => {
  it("uses only documented stage values and rejects unknown response schemas", () => {
    expect(parseVenueStage({ stage: "simulation", status: "RUNNING" })).toEqual({
      stage: "simulation", status: "RUNNING",
    });
    expect(() => parseVenueStage({ running: true })).toThrow("unrecognized schema");
  });

  it("evaluates a real signal, runs risk checks and never submits an order", async () => {
    const output: string[] = [];
    const logger = {
      info: vi.fn((line: string) => output.push(line)),
      warn: vi.fn((line: string) => output.push(line)),
      error: vi.fn((line: string) => output.push(line)),
    };
    const runtime = new BotRuntime(config, logger);
    runtime.setUniverse(["TICK"]);
    runtime.updateVenueStage({ stage: "simulation", status: "RUNNING" });

    for (let i = 0; i < 20; i += 1)
      await runtime.handleMessage("market.ticks", message(10));
    await runtime.handleMessage("market.ticks", message(11));

    expect(output.some((line) => line.startsWith("[SIGNAL]") && line.includes("action=BUY"))).toBe(true);
    expect(output.some((line) => line.startsWith("[RISK]") && line.includes("REJECTED"))).toBe(true);
    expect(output.some((line) => line.includes("No verified authoritative portfolio"))).toBe(true);
    expect(output.some((line) => line.startsWith("[HYPOTHETICAL ORDER]"))).toBe(false);
    expect(output.some((line) => line.includes("/orders"))).toBe(false);
  });

  it("keeps duplicate preflight heartbeats from being acknowledged", async () => {
    const output: string[] = [];
    const logger = {
      info: vi.fn((line: string) => output.push(line)),
      warn: vi.fn((line: string) => output.push(line)),
      error: vi.fn((line: string) => output.push(line)),
    };
    const runtime = new BotRuntime(config, logger);
    await runtime.handleMessage("market.ticks", message(0, "preflight_tick", 7));
    await runtime.handleMessage("market.ticks", message(0, "preflight_tick", 7));
    expect(output.filter((line) => line.startsWith("[HEARTBEAT]"))).toHaveLength(2);
    expect(output.every((line) => line.includes("disabled"))).toBe(true);
  });
});
