import { movingAverageCrossover } from "./indicators.js";
import { NewsSentiment } from "./newsSentiment.js";
import type { Decision, MarketTick } from "../types.js";

export class DecisionEngine {
  private readonly closes = new Map<string, number[]>();
  private readonly emittedSignals = new Set<string>();
  private readonly emittedSignalOrder: string[] = [];
  readonly news = new NewsSentiment();

  constructor(
    private readonly fastPeriod: number,
    private readonly slowPeriod: number,
    private readonly maxCloses = 250,
    private readonly maxTrackedTickers = 1000,
    private readonly maxEmittedSignals = 10_000,
  ) {
    if (fastPeriod < 1 || slowPeriod <= fastPeriod) throw new Error("Invalid moving-average periods");
    if (![maxCloses, maxTrackedTickers, maxEmittedSignals].every((value) =>
      Number.isInteger(value) && value >= 1))
      throw new Error("Decision-engine memory bounds must be positive integers");
  }

  addHistory(ticker: string, closes: readonly number[]): void {
    if (closes.some((price) => !Number.isFinite(price) || price <= 0))
      throw new Error(`Invalid historical close for ${ticker}`);
    if (!this.closes.has(ticker) && this.closes.size >= this.maxTrackedTickers)
      throw new Error("Maximum tracked ticker count reached.");
    this.closes.set(ticker, closes.slice(-this.maxCloses));
  }

  onTick(tick: MarketTick): Decision {
    if (!this.closes.has(tick.ticker) && this.closes.size >= this.maxTrackedTickers)
      return this.hold(tick, "Ticker was not admitted because the tracked-symbol limit was reached.", "neutral");
    const history = this.closes.get(tick.ticker) ?? [];
    history.push(tick.close);
    if (history.length > this.maxCloses) history.shift();
    this.closes.set(tick.ticker, history);

    const signal = movingAverageCrossover(history, this.fastPeriod, this.slowPeriod);
    const news = this.news.getSentiment(tick.ticker);
    const signalKey = `${tick.ticker}|${tick.simulated_date}|${signal ?? "none"}`;
    if (!signal) return this.hold(tick, "No confirmed moving-average crossover.", "neutral");
    if (this.emittedSignals.has(signalKey))
      return this.hold(tick, "This signal was already evaluated for the simulated date.", signal);
    this.emittedSignals.add(signalKey);
    this.emittedSignalOrder.push(signalKey);
    if (this.emittedSignalOrder.length > this.maxEmittedSignals) {
      const expired = this.emittedSignalOrder.shift();
      if (expired) this.emittedSignals.delete(expired);
    }

    if (signal === "bullish" && news.sentiment !== "negative")
      return { ...this.base(tick), action: "BUY", signal, reason: "Confirmed bullish crossover; recent news is not negative." };
    if (signal === "bearish" && news.sentiment !== "positive")
      return { ...this.base(tick), action: "SELL", signal, reason: "Confirmed bearish crossover; recent news is not positive." };
    return this.hold(tick, "News sentiment conflicts with the crossover.", signal);
  }

  private base(tick: MarketTick) {
    return { ticker: tick.ticker, simulatedDate: tick.simulated_date, close: tick.close };
  }

  private hold(tick: MarketTick, reason: string, signal: Decision["signal"]): Decision {
    return { ...this.base(tick), action: "HOLD", signal, reason };
  }
}
