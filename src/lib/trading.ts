// Shared types and pure rules for the MANTHAN EDGE console.
// The browser NEVER talks to the venue API; these types mirror what the local
// bot process writes into Lovable Cloud tables.

export type OrderAction = "BUY" | "SELL" | "SHORT" | "COVER";
export const ORDER_ACTIONS: OrderAction[] = ["BUY", "SELL", "SHORT", "COVER"];
export type OrderStatus = "submitted" | "executed" | "rejected" | "error";
export const ORDER_STATUSES: OrderStatus[] = ["submitted", "executed", "rejected", "error"];

/** Venue stage values from GET /api/v1/stage. */
export type VenueStage = "development" | "ready" | "preflight" | "simulation";
export type VenueStatus = "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED";

export type LinkState = "connected" | "disconnected" | "waiting" | "error";
export type EngineState = "waiting" | "connecting" | "ready" | "running" | "paused" | "stopped" | "error";

export const STARTING_CAPITAL = 1_000_000;
export const BROKERAGE_FEE = 20;
/** A heartbeat older than this means the bot process is considered offline. */
export const HEARTBEAT_STALE_MS = 15_000;

export interface Telemetry {
  recorded_at: string;
  kafka_status: LinkState;
  gateway_status: LinkState;
  engine_status: EngineState;
  stage: string | null;
  heartbeat_age_ms: number | null;
  processing_latency_ms: number | null;
  latest_market_event: { ticker?: string; close?: number; at?: string } | null;
  last_order_at: string | null;
  error_count: number;
}

export interface OrderRow {
  id: number;
  ticker: string;
  action: OrderAction;
  quantity: number;
  submitted_at: string;
  responded_at: string | null;
  status: OrderStatus;
  rejection_code: string | null;
  execution_price: number | null;
  decision_latency_ms: number | null;
  reason: string | null;
}

export interface Snapshot {
  recorded_at: string;
  available_cash: number;
  locked_margin: number;
  holdings_value: number;
  total_wealth: number;
  realized_pnl: number;
  unrealized_pnl: number;
}

export interface WatchItem {
  ticker: string;
  last: number;
  change_pct: number;
  signal: "bullish" | "bearish" | "neutral";
  updated_at: string;
}

export interface NewsItem {
  at: string;
  ticker: string | null;
  headline: string;
  sentiment: "positive" | "negative" | "neutral";
}

/** Total Wealth = Available Cash + Margin Locked + Long Market Value + Short Market Value (problem statement §7). */
export function totalWealth(cash: number, margin: number, longMV: number, shortMV: number) {
  return cash + margin + longMV + shortMV;
}

/** Share of starting capital that is deployed (not idle cash). */
export function cashUtilization(availableCash: number, wealth: number) {
  if (wealth <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - availableCash / wealth));
}

export type BotState =
  | "no-data"
  | "offline"
  | "waiting-venue"
  | "connected-not-ready"
  | "ready"
  | "running"
  | "paused"
  | "error";

/** Derive the overall bot state strictly from the latest telemetry row. */
export function deriveBotState(t: Telemetry | null, now: number): BotState {
  if (!t) return "no-data";
  if (now - new Date(t.recorded_at).getTime() > HEARTBEAT_STALE_MS) return "offline";
  if (t.engine_status === "error") return "error";
  if (t.kafka_status !== "connected" || t.gateway_status !== "connected") return "waiting-venue";
  if (t.engine_status === "running") return "running";
  if (t.engine_status === "paused") return "paused";
  if (t.engine_status === "ready") return "ready";
  return "connected-not-ready";
}

export const BOT_STATE_LABEL: Record<BotState, string> = {
  "no-data": "No data received yet",
  offline: "Bot offline (heartbeat stale)",
  "waiting-venue": "Waiting for venue connectivity",
  "connected-not-ready": "Connected, not ready",
  ready: "Bot ready",
  running: "Live simulation running",
  paused: "Paused",
  error: "Error",
};

export function formatINR(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour12: false });
}
