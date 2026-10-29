// Strategy configuration shape consumed later by the local bot process.
// Saving here only stores settings; it never triggers trading.

export interface StrategyConfig {
  trend: { fastLookback: number; slowLookback: number; minHistory: number };
  news: { positiveKeywords: string; negativeKeywords: string; minSentimentMargin: number };
  risk: {
    maxPositionPct: number;
    maxExposurePct: number;
    minCashReservePct: number;
    maxOpenPositions: number;
    stopLossPct: number;
    shortingEnabled: boolean;
    maxOrderQty: number;
  };
}

export const DEFAULT_STRATEGY: StrategyConfig = {
  trend: { fastLookback: 5, slowLookback: 20, minHistory: 20 },
  news: {
    positiveKeywords: "beats, upgrade, record profit, expansion, acquisition, dividend",
    negativeKeywords: "miss, downgrade, fraud, probe, loss, recall, default",
    minSentimentMargin: 2,
  },
  risk: {
    maxPositionPct: 10,
    maxExposurePct: 75,
    minCashReservePct: 25,
    maxOpenPositions: 8,
    stopLossPct: 5,
    shortingEnabled: false,
    maxOrderQty: 500,
  },
};

type Range = { min: number; max: number; integer?: boolean; label: string };

export const LIMITS = {
  "trend.fastLookback": { min: 2, max: 50, integer: true, label: "Fast MA lookback" },
  "trend.slowLookback": { min: 5, max: 200, integer: true, label: "Slow MA lookback" },
  "trend.minHistory": { min: 5, max: 250, integer: true, label: "Minimum history" },
  "news.minSentimentMargin": { min: 1, max: 10, integer: true, label: "Sentiment margin" },
  "risk.maxPositionPct": { min: 1, max: 25, label: "Max position size" },
  "risk.maxExposurePct": { min: 10, max: 95, label: "Max portfolio exposure" },
  "risk.minCashReservePct": { min: 5, max: 90, label: "Min cash reserve" },
  "risk.maxOpenPositions": { min: 1, max: 30, integer: true, label: "Max open positions" },
  "risk.stopLossPct": { min: 0.5, max: 25, label: "Stop-loss" },
  "risk.maxOrderQty": { min: 1, max: 1_000_000, integer: true, label: "Max order quantity" },
} satisfies Record<string, Range>;

export type FieldKey = keyof typeof LIMITS;

function get(cfg: StrategyConfig, key: string): unknown {
  return key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], cfg);
}

/** Returns a map of field -> error message. Empty object means valid. */
export function validateStrategy(cfg: StrategyConfig): Partial<Record<FieldKey | "keywords", string>> {
  const errors: Partial<Record<FieldKey | "keywords", string>> = {};
  for (const [key, r] of Object.entries(LIMITS) as [FieldKey, Range][]) {
    const v = get(cfg, key);
    if (typeof v !== "number" || !Number.isFinite(v)) errors[key] = `${r.label} must be a number`;
    else if (v < r.min || v > r.max) errors[key] = `${r.label} must be between ${r.min} and ${r.max}`;
    else if (r.integer && !Number.isInteger(v)) errors[key] = `${r.label} must be a whole number`;
  }
  if (!errors["trend.slowLookback"] && !errors["trend.fastLookback"] && cfg.trend.slowLookback <= cfg.trend.fastLookback)
    errors["trend.slowLookback"] = "Slow lookback must be longer than fast lookback";
  if (!errors["trend.minHistory"] && cfg.trend.minHistory < cfg.trend.slowLookback)
    errors["trend.minHistory"] = "Minimum history must cover the slow lookback";
  if (!errors["risk.maxExposurePct"] && !errors["risk.minCashReservePct"] &&
      cfg.risk.maxExposurePct + cfg.risk.minCashReservePct > 100)
    errors["risk.maxExposurePct"] = "Exposure + cash reserve cannot exceed 100%";
  if (!cfg.news.positiveKeywords.trim() || !cfg.news.negativeKeywords.trim())
    errors.keywords = "Both keyword groups need at least one keyword";
  return errors;
}

export function parseKeywords(s: string) {
  return s.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
}
