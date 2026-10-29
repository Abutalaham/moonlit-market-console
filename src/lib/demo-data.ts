// Fixed, clearly-labelled DEMO dataset. Never shown in connected mode.
// Tickers here are fictional placeholders, not the live tradable universe.
import type { NewsItem, OrderRow, Snapshot, Telemetry, WatchItem } from "./trading";

const base = Date.parse("2026-03-14T15:00:00+05:30");
const t = (sec: number) => new Date(base + sec * 1000).toISOString();

export const DEMO_TELEMETRY: Telemetry = {
  recorded_at: t(3600),
  kafka_status: "connected",
  gateway_status: "connected",
  engine_status: "running",
  stage: "simulation",
  heartbeat_age_ms: 840,
  processing_latency_ms: 18.4,
  latest_market_event: { ticker: "DEMO-ALPHA", close: 1284.5, at: t(3598) },
  last_order_at: t(3540),
  error_count: 2,
};

const wealthCurve = [
  1000000, 1001820, 999640, 1004210, 1008900, 1006350, 1011420, 1015870, 1013200,
  1019640, 1024310, 1021050, 1027780, 1031420, 1029900, 1035260, 1038110, 1036480,
  1041930, 1046270,
];

export const DEMO_SNAPSHOTS: Snapshot[] = wealthCurve.map((w, i) => {
  const cash = 1000000 - i * 31500;
  const margin = i > 8 ? 42000 : 0;
  return {
    recorded_at: t(i * 180),
    available_cash: cash,
    locked_margin: margin,
    holdings_value: w - cash - margin,
    total_wealth: w,
    realized_pnl: Math.round((w - 1000000) * 0.55),
    unrealized_pnl: Math.round((w - 1000000) * 0.45),
  };
});

export const DEMO_EXPOSURE = { long: 512400, short: 42000, openPositions: 6, maxDrawdownPct: 0.52 };

export const DEMO_WATCHLIST: WatchItem[] = [
  { ticker: "DEMO-ALPHA", last: 1284.5, change_pct: 2.31, signal: "bullish", updated_at: t(3598) },
  { ticker: "DEMO-BRAVO", last: 642.1, change_pct: -1.12, signal: "bearish", updated_at: t(3596) },
  { ticker: "DEMO-CIPHER", last: 2210.0, change_pct: 0.42, signal: "neutral", updated_at: t(3597) },
  { ticker: "DEMO-DELTA", last: 318.75, change_pct: 3.05, signal: "bullish", updated_at: t(3595) },
  { ticker: "DEMO-ECHO", last: 98.6, change_pct: -2.74, signal: "bearish", updated_at: t(3599) },
  { ticker: "DEMO-FORGE", last: 1540.2, change_pct: 0.08, signal: "neutral", updated_at: t(3594) },
];

export const DEMO_NEWS: NewsItem[] = [
  { at: t(3580), ticker: "DEMO-DELTA", headline: "Demo Delta posts record profit, announces expansion", sentiment: "positive" },
  { at: t(3490), ticker: "DEMO-ECHO", headline: "Regulator opens probe into Demo Echo accounts", sentiment: "negative" },
  { at: t(3320), ticker: null, headline: "Sector index steady ahead of policy meeting", sentiment: "neutral" },
  { at: t(3100), ticker: "DEMO-ALPHA", headline: "Demo Alpha beats estimates, analysts upgrade", sentiment: "positive" },
];

export const DEMO_ORDERS: OrderRow[] = [
  { id: 12, ticker: "DEMO-ALPHA", action: "BUY", quantity: 120, submitted_at: t(3540), responded_at: t(3540.04), status: "executed", rejection_code: null, execution_price: 1279.1, decision_latency_ms: 14.2, reason: "MA5 crossed above MA20; positive news margin +3" },
  { id: 11, ticker: "DEMO-ECHO", action: "SHORT", quantity: 400, submitted_at: t(3495), responded_at: t(3495.05), status: "executed", rejection_code: null, execution_price: 101.3, decision_latency_ms: 21.7, reason: "Negative news margin -4 (probe); trend down" },
  { id: 10, ticker: "DEMO-BRAVO", action: "SELL", quantity: 80, submitted_at: t(3410), responded_at: t(3410.03), status: "executed", rejection_code: null, execution_price: 646.0, decision_latency_ms: 11.9, reason: "Stop-loss 5% breached" },
  { id: 9, ticker: "DEMO-FORGE", action: "BUY", quantity: 300, submitted_at: t(3300), responded_at: t(3300.06), status: "rejected", rejection_code: "INSUFFICIENT_CAPITAL", execution_price: null, decision_latency_ms: 17.3, reason: "Breakout above 20-day high" },
  { id: 8, ticker: "DEMO-DELTA", action: "BUY", quantity: 500, submitted_at: t(3120), responded_at: t(3120.04), status: "executed", rejection_code: null, execution_price: 309.4, decision_latency_ms: 9.8, reason: "MA5 > MA20 with rising volume" },
  { id: 7, ticker: "DEMO-CIPHER", action: "COVER", quantity: 60, submitted_at: t(2950), responded_at: null, status: "submitted", rejection_code: null, execution_price: null, decision_latency_ms: 25.1, reason: "Trend reversal on short position" },
  { id: 6, ticker: "DEMO-ECHO", action: "COVER", quantity: 50, submitted_at: t(2700), responded_at: t(2700.02), status: "rejected", rejection_code: "NO_SHORT_POSITION", execution_price: null, decision_latency_ms: 12.6, reason: "Duplicate cover signal" },
  { id: 5, ticker: "DEMO-ALPHA", action: "BUY", quantity: 100, submitted_at: t(2400), responded_at: t(2400.03), status: "executed", rejection_code: null, execution_price: 1248.0, decision_latency_ms: 13.4, reason: "Positive news margin +2" },
];

export const DEMO_LATENCY = [
  { bucket: "<10ms", count: 14 },
  { bucket: "10–20", count: 31 },
  { bucket: "20–40", count: 12 },
  { bucket: "40–80", count: 4 },
  { bucket: ">80", count: 1 },
];
