import type { BotConfig } from "../config.js";
import type { Decision, OrderAction, PortfolioSnapshot } from "../types.js";

type TableName = "bot_telemetry" | "trade_decisions" | "order_audit" | "portfolio_snapshots";
type QueuedRow = { table: TableName; row: Record<string, unknown> };

export interface TelemetryStatus {
  kafka_status: "connected" | "disconnected" | "waiting" | "error";
  gateway_status: "connected" | "disconnected" | "waiting" | "error";
  engine_status: "waiting" | "connecting" | "ready" | "running" | "paused" | "stopped" | "error";
  stage: string | null;
  heartbeat_age_ms: number | null;
  processing_latency_ms: number | null;
  latest_market_event: { ticker?: string; close?: number; at?: string } | null;
  last_order_at: string | null;
  error_count: number;
}

export class SupabaseTelemetry {
  private readonly restUrl: URL;
  private readonly queue: QueuedRow[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> | null = null;
  private closed = false;

  private constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly runId: string,
    private readonly fetchImpl: typeof fetch,
    private readonly maxQueue = 1000,
    private readonly batchSize = 100,
  ) {
    this.restUrl = new URL("rest/v1/", url.endsWith("/") ? url : `${url}/`);
  }

  static async create(
    config: BotConfig,
    label = `local-${new Date().toISOString()}`,
    fetchImpl: typeof fetch = fetch,
  ): Promise<SupabaseTelemetry | null> {
    if (!config.supabaseUrl && !config.supabaseServiceRoleKey) return null;
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey)
      throw new Error("Both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    const telemetry = new SupabaseTelemetry(config.supabaseUrl, config.supabaseServiceRoleKey, "", fetchImpl);
    const rows = await telemetry.request("bot_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        run_label: label,
        stage: "waiting",
        status: "connecting",
        starting_capital: 1_000_000,
        summary: {},
      }),
    });
    const runId = Array.isArray(rows) && isRecord(rows[0]) && typeof rows[0].id === "string"
      ? rows[0].id
      : null;
    if (!runId) throw new Error("Supabase bot_runs insert returned no run ID.");
    const instance = new SupabaseTelemetry(
      config.supabaseUrl, config.supabaseServiceRoleKey, runId, fetchImpl,
    );
    instance.scheduleFlush();
    return instance;
  }

  recordStatus(status: TelemetryStatus): void {
    this.enqueue("bot_telemetry", { run_id: this.runId, ...status });
  }

  recordDecision(decision: Decision, eventAt: string, latencyMs: number): void {
    this.enqueue("trade_decisions", {
      run_id: this.runId,
      ticker: decision.ticker,
      action: decision.action,
      reason: decision.reason,
      indicators: { signal: decision.signal, close: decision.close },
      event_at: eventAt,
      decision_latency_ms: latencyMs,
    });
  }

  recordOrder(order: {
    decision_id?: number | null;
    ticker: string;
    action: OrderAction;
    quantity: number;
    submitted_at: string;
    responded_at?: string | null;
    status: "submitted" | "executed" | "rejected" | "error";
    rejection_code?: string | null;
    execution_price?: number | null;
    execution_details?: unknown;
  }): void {
    this.enqueue("order_audit", { run_id: this.runId, ...order });
  }

  recordPortfolio(snapshot: PortfolioSnapshot, holdingsValue: number, realizedPnl = 0, unrealizedPnl = 0): void {
    this.enqueue("portfolio_snapshots", {
      run_id: this.runId,
      recorded_at: new Date(snapshot.receivedAt).toISOString(),
      available_cash: snapshot.cash,
      locked_margin: snapshot.lockedMargin,
      holdings_value: holdingsValue,
      total_wealth: snapshot.totalWealth,
      realized_pnl: realizedPnl,
      unrealized_pnl: unrealizedPnl,
    });
  }

  async close(endingWealth?: number): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    while (this.queue.length || this.flushPromise) {
      await this.flush();
      if (this.flushPromise) await this.flushPromise;
    }
    await this.request(`bot_runs?id=eq.${encodeURIComponent(this.runId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        ended_at: new Date().toISOString(),
        status: "stopped",
        ...(endingWealth === undefined ? {} : { ending_wealth: endingWealth }),
      }),
    });
  }

  private enqueue(table: TableName, row: Record<string, unknown>): void {
    if (this.closed) throw new Error("Cannot write telemetry after shutdown.");
    JSON.stringify(row);
    if (this.queue.length >= this.maxQueue) {
      this.queue.shift();
      console.warn("Supabase telemetry queue is full; discarded its oldest noncritical row.");
    }
    this.queue.push({ table, row });
    if (this.queue.length >= this.batchSize) void this.flush();
  }

  private scheduleFlush(): void {
    if (this.closed || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().finally(() => this.scheduleFlush());
    }, 1000);
    this.timer.unref?.();
  }

  private flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;
    if (this.queue.length === 0) return Promise.resolve();
    this.flushPromise = this.flushBatch().finally(() => {
      this.flushPromise = null;
      if (this.queue.length && !this.closed) void this.flush();
    });
    return this.flushPromise;
  }

  private async flushBatch(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.batchSize);
    const tables = new Map<TableName, Record<string, unknown>[]>();
    for (const item of batch) {
      const rows = tables.get(item.table) ?? [];
      rows.push(item.row);
      tables.set(item.table, rows);
    }
    for (const [table, rows] of tables) {
      try {
        await this.request(table, { method: "POST", body: JSON.stringify(rows) });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown telemetry error";
        console.error(`Supabase telemetry write failed for ${table}: ${message}`);
      }
    }
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(new URL(path, this.restUrl), {
      ...init,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Supabase request failed (${response.status}).`);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Supabase returned a non-JSON response.");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
