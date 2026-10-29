export function simpleMovingAverage(values: readonly number[], period: number): number | null {
  if (!Number.isInteger(period) || period < 1 || values.length < period) return null;
  const window = values.slice(-period);
  if (window.some((value) => !Number.isFinite(value))) return null;
  return window.reduce((sum, value) => sum + value, 0) / period;
}

export type Crossover = "bullish" | "bearish" | null;

export function movingAverageCrossover(
  closes: readonly number[],
  fastPeriod: number,
  slowPeriod: number,
): Crossover {
  if (fastPeriod < 1 || slowPeriod <= fastPeriod || closes.length < slowPeriod + 1) return null;
  const previous = closes.slice(0, -1);
  const previousFast = simpleMovingAverage(previous, fastPeriod);
  const previousSlow = simpleMovingAverage(previous, slowPeriod);
  const currentFast = simpleMovingAverage(closes, fastPeriod);
  const currentSlow = simpleMovingAverage(closes, slowPeriod);
  if (previousFast === null || previousSlow === null || currentFast === null || currentSlow === null)
    return null;
  if (previousFast <= previousSlow && currentFast > currentSlow) return "bullish";
  if (previousFast >= previousSlow && currentFast < currentSlow) return "bearish";
  return null;
}
