import type { OrderRequest } from "../types.js";
import { RateLimiter } from "../utils/rateLimiter.js";

export interface VenueStage {
  stage: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
}

export interface SimulationClock {
  raw: unknown;
  schemaVerified: false;
}

export class CompetitionClient {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly limiter: RateLimiter,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    if (this.baseUrl.protocol !== "http:" && this.baseUrl.protocol !== "https:")
      throw new Error("BOT_API_BASE must use HTTP or HTTPS");
  }

  async getStage(signal?: AbortSignal): Promise<VenueStage> {
    const value = await this.request("stage", { method: "GET", signal }, false);
    return parseVenueStage(value);
  }

  async getClock(signal?: AbortSignal): Promise<SimulationClock> {
    const raw = await this.request("simulation/clock", { method: "GET", signal }, false);
    if (!isRecord(raw)) throw new Error("GET /simulation/clock returned a non-object JSON response.");
    return { raw, schemaVerified: false };
  }

  getStocks(signal?: AbortSignal): Promise<unknown> {
    return this.request("stocks", { method: "GET", signal }, true);
  }

  getHistory(ticker: string, days = 90, signal?: AbortSignal): Promise<unknown> {
    if (!ticker.trim() || !Number.isInteger(days) || days < 1)
      throw new Error("A ticker and positive integer history length are required.");
    return this.request(`stocks/${encodeURIComponent(ticker)}/history?days=${days}`, {
      method: "GET", signal,
    }, true);
  }

  getPortfolio(signal?: AbortSignal): Promise<unknown> {
    return this.request("portfolio", { method: "GET", signal }, true);
  }

  getCash(signal?: AbortSignal): Promise<unknown> {
    return this.request("portfolio/cash", { method: "GET", signal }, true);
  }

  async heartbeat(seq: number, signal?: AbortSignal): Promise<void> {
    if (!Number.isInteger(seq) || seq < 0) throw new Error("Heartbeat sequence must be a nonnegative integer.");
    await this.request("bot/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seq }),
      signal,
    }, true);
  }

  async submitOrder(order: OrderRequest, signal?: AbortSignal): Promise<unknown> {
    void order;
    void signal;
    throw new Error("Live order submission is locked off in this phase.");
  }

  private async request(path: string, init: RequestInit, authenticated: boolean): Promise<unknown> {
    await this.limiter.waitForSlot();
    const timeout = AbortSignal.timeout(3000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (authenticated) {
      if (!this.token) throw new Error("This endpoint requires BOT_ACCESS_TOKEN.");
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      ...init,
      signal,
      headers,
    });
    if (
      response.ok &&
      !(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")
    ) throw new Error(`Venue API returned a non-JSON response (${response.status}).`);
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`Venue API returned non-JSON data (${response.status}).`);
      }
    }
    if (!response.ok) throw new Error(`Venue API request failed (${response.status}).`);
    return body;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseVenueStage(value: unknown): VenueStage {
  const stages = ["development", "ready", "preflight", "simulation"];
  const statuses = ["IDLE", "RUNNING", "PAUSED", "COMPLETED"];
  if (
    !isRecord(value) ||
    typeof value.stage !== "string" ||
    !stages.includes(value.stage) ||
    typeof value.status !== "string" ||
    !statuses.includes(value.status)
  ) throw new Error("GET /stage returned an unrecognized schema.");
  return { stage: value.stage, status: value.status as VenueStage["status"] };
}
