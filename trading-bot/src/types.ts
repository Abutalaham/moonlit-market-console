export type OrderAction = "BUY" | "SELL" | "SHORT" | "COVER";
export type Signal = "bullish" | "bearish" | "neutral";

export interface MarketTick {
  event_type: "market_tick";
  timestamp: string;
  simulated_date: string;
  ticker: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsFlash {
  event_type: "news_flash";
  timestamp: string;
  simulated_date?: string;
  ticker: string;
  headline: string;
  description: string;
}

export interface PreflightTick {
  event_type: "preflight_tick";
  seq: number;
}

export interface Stock {
  ticker: string;
  company_name: string;
  description: string;
}

export interface Position {
  longQuantity: number;
  shortQuantity: number;
  averageLongPrice: number;
  longMarketValue: number;
  shortMarketValue: number;
}

export interface PortfolioSnapshot {
  cash: number;
  lockedMargin: number;
  totalWealth: number;
  positions: Record<string, Position>;
  receivedAt: number;
}

export interface OrderRequest {
  ticker: string;
  action: OrderAction;
  quantity: number;
  date: string;
}

export interface Decision {
  ticker: string;
  action: OrderAction | "HOLD";
  reason: string;
  signal: Signal;
  simulatedDate: string;
  close: number;
}
