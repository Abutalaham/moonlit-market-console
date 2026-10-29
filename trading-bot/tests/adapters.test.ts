import { describe, expect, it, vi } from "vitest";
import { CompetitionClient } from "../src/api/competitionClient.js";
import type { BotConfig } from "../src/config.js";
import { NewsSentiment } from "../src/strategy/newsSentiment.js";
import { RiskManager } from "../src/risk/riskManager.js";
import { SupabaseTelemetry } from "../src/telemetry/supabaseTelemetry.js";
import { RateLimiter } from "../src/utils/rateLimiter.js";
import type { PortfolioSnapshot } from "../src/types.js";

const config = (overrides: Partial<BotConfig> = {}): BotConfig => ({
  teamUsername: "test-team", venuePortalUrl: "http://127.0.0.1:3003",
  kafkaBrokers: [], botApiBase: "", botAccessToken: "",
  tradingEnabled: false, acknowledgePreflight: false, enableShorts: false,
  fastSmaPeriod: 5, slowSmaPeriod: 20,
  cashReservePct: 25, maxPositionPct: 10, maxPortfolioExposurePct: 60,
  maxOpenPositions: 6, maxOrderQty: 1_000_000, stopLossPct: 3,
  requestsPerMinuteLimit: 90, stagePollIntervalMs: 2500, portfolioMaxAgeMs: 10_000,
  supabaseUrl: "", supabaseServiceRoleKey: "", ...overrides,
});

const position = {
  longQuantity: 10, shortQuantity: 0, averageLongPrice: 100,
  longMarketValue: 1000, shortMarketValue: 0,
};

function context(positions: PortfolioSnapshot["positions"] = {}, overrides = {}) {
  return {
    running: true,
    activeTickers: new Set(["TICK"]),
    price: 100,
    simulatedDate: "2026-10-29",
    portfolio: {
      cash: 1_000_000, lockedMargin: 0, totalWealth: 1_000_000,
      positions, receivedAt: Date.now(),
    },
    now: Date.now(),
    signalKey: crypto.randomUUID(),
    ...overrides,
  };
}

describe("risk edge cases", () => {
  it("allows valid SELL and SHORT only for matching inventory and explicit short config", () => {
    const sellRisk = new RiskManager(config());
    expect(sellRisk.validate(
      { ticker: "TICK", action: "SELL", quantity: 5, date: "2026-10-29" },
      context({ TICK: position }),
    ).allowed).toBe(true);

    const shortRisk = new RiskManager(config({ enableShorts: true }));
    expect(shortRisk.validate(
      { ticker: "TICK", action: "SHORT", quantity: 100, date: "2026-10-29" },
      context(),
    ).allowed).toBe(true);
  });

  it("rejects malformed dates, stale snapshots, and tickers outside the universe", () => {
    const risk = new RiskManager(config());
    const request = { ticker: "TICK", action: "BUY" as const, quantity: 1, date: "2026-10-29" };
    expect(risk.validate({ ...request, date: "2026-02-31" }, context()).allowed).toBe(false);
    const stale = context();
    stale.portfolio.receivedAt -= 20_000;
    expect(risk.validate(request, stale).allowed).toBe(false);
    expect(risk.validate({ ...request, ticker: "UNKNOWN" }, context()).allowed).toBe(false);
  });

  it("rejects any buy that would exceed the exposure cap", () => {
    const risk = new RiskManager(config({ maxPortfolioExposurePct: 55 }));
    const positions = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`P${i}`, {
      ...position, longMarketValue: 100_000, longQuantity: 1000,
    }]));
    expect(risk.validate(
      { ticker: "TICK", action: "BUY", quantity: 501, date: "2026-10-29" },
      context(positions),
    ).allowed).toBe(false);
  });
});

describe("external adapters remain mockable and bounded", () => {
  it("scores news deterministically and ignores a duplicate event", () => {
    const news = new NewsSentiment(2);
    expect(news.add("TICK", "Record growth", "Profit beats estimates", "2026-10-29")).toBe(true);
    expect(news.add("TICK", "Record growth", "Profit beats estimates", "2026-10-29")).toBe(false);
    expect(news.getSentiment("TICK")).toEqual({ score: 3, sentiment: "positive" });
  });

  it("validates stage responses with mocked HTTP and uses the configured API prefix", async () => {
    const mockedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ stage: "simulation", status: "RUNNING" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    const client = new CompetitionClient(
      "http://127.0.0.1:3002/api/v1", "fixture-token", new RateLimiter(90), mockedFetch,
    );
    await expect(client.getStage()).resolves.toEqual({ stage: "simulation", status: "RUNNING" });
    expect(mockedFetch.mock.calls[0]?.[0]?.toString()).toBe("http://127.0.0.1:3002/api/v1/stage");
  });

  it("does not send or retry an order after a disabled order request", async () => {
    const mockedFetch = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const client = new CompetitionClient(
      "http://127.0.0.1:3002/api/v1", "fixture-token", new RateLimiter(90), mockedFetch,
    );
    await expect(client.submitOrder({
      ticker: "TICK", action: "BUY", quantity: 1, date: "2026-10-29",
    })).rejects.toThrow("locked off");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("skips Supabase entirely when credentials are absent", async () => {
    expect(await SupabaseTelemetry.create(config())).toBeNull();
  });
});
