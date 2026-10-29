import type { OrderRequest } from "../types.js";
import { RateLimiter } from "../utils/rateLimiter.js";

export interface VenueStage {
  stage: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";
}

export class CompetitionClient {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly limiter: RateLimiter,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly ordersEnabled = false,
  ) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    if (this.baseUrl.protocol !== "http:" && this.baseUrl.protocol !== "https:")
      throw new Error("BOT_API_BASE must use HTTP or HTTPS");
  }

  async getStage(signal?: AbortSignal): Promise<VenueStage> {
    const value = await this.request("stage", { method: "GET", signal });
    if (!isRecord(value) || typeof value.stage !== "string" ||
        !["IDLE", "RUNNING", "PAUSED", "COMPLETED"].includes(String(value.status)))
      throw new Error("GET /stage returned an unrecognized stage response; check official API documentation.");
    return { stage: value.stage, status: value.status as VenueStage["status"] };
  }

  getStocks(signal?: AbortSignal): Promise<unknown> {
    return this.request("stocks", { method: "GET", signal });
  }

  getHistory(ticker: string, days = 90, signal?: AbortSignal): Promise<unknown> {
    if (!ticker.trim() || !Number.isInteger(days) || days < 1)
      throw new Error("A ticker and positive integer history length are required.");
    return this.request(`stocks/${encodeURIComponent(ticker)}/history?days=${days}`, {
      method: "GET", signal,
    });
  }

  getPortfolio(signal?: AbortSignal): Promise<unknown> {
    return this.request("portfolio", { method: "GET", signal });
  }

  getCash(signal?: AbortSignal): Promise<unknown> {
    return this.request("portfolio/cash", { method: "GET", signal });
  }

  async heartbeat(seq: number, signal?: AbortSignal): Promise<void> {
    if (!Number.isInteger(seq) || seq < 0) throw new Error("Heartbeat sequence must be a nonnegative integer.");
    await this.request("bot/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seq }),
      signal,
    });
  }

  async submitOrder(order: OrderRequest, signal?: AbortSignal): Promise<unknown> {
    if (!this.ordersEnabled)
      throw new Error("Order submission is disabled; explicitly enable it only after readiness and risk checks.");
    if (!Number.isInteger(order.quantity) || order.quantity <= 0 || order.quantity > 1_000_000)
      throw new Error("Order quantity must be an integer between 1 and 1,000,000.");
    return this.request("orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
      signal,
    });
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    await this.limiter.waitForSlot();
    const response = await this.fetchImpl(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...init.headers,
      },
    });
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
