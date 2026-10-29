import type { BotConfig } from "../config.js";
import type { OrderRequest, PortfolioSnapshot } from "../types.js";

export interface RiskContext {
  running: boolean;
  activeTickers: ReadonlySet<string>;
  price: number;
  simulatedDate: string;
  portfolio: PortfolioSnapshot;
  now: number;
  signalKey: string;
}

export interface RiskResult {
  allowed: boolean;
  reason: string;
  quantity: number;
}

export class RiskManager {
  private readonly processedSignals = new Set<string>();
  private readonly processedSignalOrder: string[] = [];
  private readonly maxRememberedSignals = 10_000;

  constructor(private readonly config: BotConfig) {}

  validate(request: OrderRequest, context: RiskContext): RiskResult {
    const deny = (reason: string): RiskResult => ({ allowed: false, reason, quantity: 0 });
    if (!context.running) return deny("Simulation is not running.");
    if (!context.activeTickers.has(request.ticker)) return deny("Ticker is not in the active universe.");
    if (!Number.isFinite(context.price) || context.price <= 0) return deny("Price is invalid.");
    if (!isValidDate(request.date) || request.date !== context.simulatedDate)
      return deny("Simulated date is invalid or stale.");
    const snapshotAge = context.now - context.portfolio.receivedAt;
    if (snapshotAge < 0 || snapshotAge > this.config.portfolioMaxAgeMs)
      return deny("Portfolio snapshot is stale.");
    if (!Number.isFinite(context.portfolio.cash) || !Number.isFinite(context.portfolio.totalWealth) ||
        context.portfolio.cash < 0 || context.portfolio.totalWealth <= 0)
      return deny("Portfolio snapshot is invalid.");
    if (!Number.isInteger(request.quantity) || request.quantity <= 0 || request.quantity > this.config.maxOrderQty)
      return deny(`Quantity must be a positive integer no greater than ${this.config.maxOrderQty}.`);
    if (!["BUY", "SELL", "SHORT", "COVER"].includes(request.action))
      return deny("Order action is invalid.");

    const current = context.portfolio.positions[request.ticker] ?? {
      longQuantity: 0, shortQuantity: 0, averageLongPrice: 0, longMarketValue: 0, shortMarketValue: 0,
    };
    const grossExposure = Object.values(context.portfolio.positions)
      .reduce((sum, position) => sum + position.longMarketValue + position.shortMarketValue, 0);
    if (Object.values(context.portfolio.positions).some((position) =>
      !Number.isFinite(position.longQuantity) || position.longQuantity < 0 ||
      !Number.isFinite(position.shortQuantity) || position.shortQuantity < 0 ||
      !Number.isFinite(position.longMarketValue) || position.longMarketValue < 0 ||
      !Number.isFinite(position.shortMarketValue) || position.shortMarketValue < 0))
      return deny("Portfolio contains invalid position data.");
    const openPositions = Object.values(context.portfolio.positions)
      .filter((position) => position.longQuantity > 0 || position.shortQuantity > 0).length;
    const notional = request.quantity * context.price;
    const fees = 20 + (request.action === "SELL" ? 15.34 : 0);
    const maxPositionValue = context.portfolio.totalWealth * this.config.maxPositionPct / 100;
    const maxExposure = context.portfolio.totalWealth * this.config.maxPortfolioExposurePct / 100;

    switch (request.action) {
      case "BUY":
        if (current.shortQuantity > 0) return deny("BUY cannot be used to close an existing short; COVER is required.");
        if (openPositions >= this.config.maxOpenPositions && current.longQuantity === 0)
          return deny("Maximum open-position count reached.");
        if (current.longMarketValue + notional > maxPositionValue)
          return deny("Position-size limit exceeded.");
        if (grossExposure + notional > maxExposure) return deny("Portfolio-exposure limit exceeded.");
        if (context.portfolio.cash - notional - fees <
            context.portfolio.totalWealth * this.config.cashReservePct / 100)
          return deny("BUY would breach the required cash reserve.");
        break;
      case "SELL":
        if (current.longQuantity < request.quantity) return deny("SELL exceeds owned long holdings.");
        break;
      case "SHORT":
        if (!this.config.enableShorts) return deny("Short selling is disabled.");
        if (current.longQuantity > 0) return deny("Cannot open a short while a long position exists.");
        if (openPositions >= this.config.maxOpenPositions) return deny("Maximum open-position count reached.");
        if (notional > maxPositionValue) return deny("Position-size limit exceeded.");
        if (grossExposure + notional > maxExposure) return deny("Portfolio-exposure limit exceeded.");
        if (context.portfolio.cash - notional - fees <
            context.portfolio.totalWealth * this.config.cashReservePct / 100)
          return deny("SHORT margin would breach the required cash reserve.");
        break;
      case "COVER":
        if (current.shortQuantity < request.quantity) return deny("COVER exceeds the open short holding.");
        if (context.portfolio.cash < notional + fees) return deny("Insufficient cash for 100% short margin and fees.");
        break;
      default:
        return deny("Order action is invalid.");
    }
    if (this.processedSignals.has(context.signalKey)) return deny("This signal already generated an order.");
    this.processedSignals.add(context.signalKey);
    this.processedSignalOrder.push(context.signalKey);
    if (this.processedSignalOrder.length > this.maxRememberedSignals) {
      const expired = this.processedSignalOrder.shift();
      if (expired) this.processedSignals.delete(expired);
    }
    return { allowed: true, reason: "Risk checks passed.", quantity: request.quantity };
  }
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
