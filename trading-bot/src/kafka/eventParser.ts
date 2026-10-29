import type { MarketTick, NewsFlash, PreflightTick } from "../types.js";

export type ParsedEvent = MarketTick | NewsFlash | PreflightTick;
const MAX_EVENT_BYTES = 1_048_576;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function parseEvent(raw: string): ParsedEvent | null {
  if (raw.length > MAX_EVENT_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const root = record(parsed);
  if (!root || !nonEmptyString(root.event_type)) return null;
  const data = record(root.data);

  if (root.event_type === "preflight_tick") {
    const seq = data?.seq;
    return Number.isInteger(seq) && Number(seq) >= 0
      ? { event_type: "preflight_tick", seq: Number(seq) }
      : null;
  }

  if (!data || !nonEmptyString(root.timestamp)) return null;
  if (root.event_type === "market_tick") {
    const { ticker, open, high, low, close, volume } = data;
    if (
      !nonEmptyString(root.simulated_date) ||
      !nonEmptyString(ticker) ||
      !positiveFinite(open) ||
      !positiveFinite(high) ||
      !positiveFinite(low) ||
      !positiveFinite(close) ||
      !Number.isSafeInteger(volume) ||
      Number(volume) <= 0 ||
      Number(high) < Math.max(Number(open), Number(close), Number(low)) ||
      Number(low) > Math.min(Number(open), Number(close), Number(high))
    ) return null;
    return {
      event_type: "market_tick",
      timestamp: root.timestamp,
      simulated_date: root.simulated_date,
      ticker: ticker.trim(),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    };
  }

  if (root.event_type === "news_flash") {
    const { ticker, headline, description } = data;
    if (!nonEmptyString(ticker) || !nonEmptyString(headline) || !nonEmptyString(description))
      return null;
    if (root.simulated_date !== undefined && !nonEmptyString(root.simulated_date)) return null;
    return {
      event_type: "news_flash",
      timestamp: root.timestamp,
      ...(typeof root.simulated_date === "string" ? { simulated_date: root.simulated_date } : {}),
      ticker: ticker.trim(),
      headline: headline.trim(),
      description: description.trim(),
    };
  }
  return null;
}
