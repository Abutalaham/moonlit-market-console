import { CompetitionClient, type VenueStage } from "./api/competitionClient.js";
import type { BotConfig } from "./config.js";
import { MarketConsumer } from "./kafka/consumer.js";
import { parseEvent } from "./kafka/eventParser.js";
import { RiskManager } from "./risk/riskManager.js";
import { DecisionEngine } from "./strategy/decisionEngine.js";
import { SupabaseTelemetry, type TelemetryStatus } from "./telemetry/supabaseTelemetry.js";
import type { PortfolioSnapshot } from "./types.js";
import { RateLimiter } from "./utils/rateLimiter.js";

interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export class BotRuntime {
  private readonly engine: DecisionEngine;
  private readonly risk: RiskManager;
  private readonly api: CompetitionClient | null;
  private readonly activeTickers = new Set<string>();
  private readonly latestSimulatedDate = new Map<string, string>();
  private readonly acknowledgedSequenceIds = new Set<number>();
  private readonly acknowledgedSequenceOrder: number[] = [];
  private stage: VenueStage | null = null;
  private portfolio: PortfolioSnapshot | null = null;
  private consumer: MarketConsumer | null = null;
  private telemetry: SupabaseTelemetry | null = null;
  private stageTimer: ReturnType<typeof setInterval> | null = null;
  private readonly abortController = new AbortController();
  private stageRequestActive = false;
  private errorCount = 0;
  private lastMarketEvent: TelemetryStatus["latest_market_event"] = null;
  private lastTelemetryAt = 0;

  constructor(
    private readonly config: BotConfig,
    private readonly logger: Logger = console,
  ) {
    this.engine = new DecisionEngine(config.fastSmaPeriod, config.slowSmaPeriod);
    this.risk = new RiskManager(config);
    this.api = config.botApiBase
      ? new CompetitionClient(
        config.botApiBase,
        config.botAccessToken,
        new RateLimiter(config.requestsPerMinuteLimit),
      )
      : null;
  }

  async start(maxEvents?: number, timeoutMs = 45_000): Promise<void> {
    if (this.config.tradingEnabled)
      throw new Error("Live order submission is disabled in this phase.");
    if (!this.config.teamUsername || !this.config.kafkaBrokers.length)
      throw new Error("Configure TEAM_USERNAME and KAFKA_BROKERS before starting the dry-run.");
    if (maxEvents !== undefined && (!Number.isInteger(maxEvents) || maxEvents < 1))
      throw new Error("--max-events must be a positive integer.");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000)
      throw new Error("--timeout-seconds must be at least one.");

    try {
      this.telemetry = await SupabaseTelemetry.create(this.config);
      this.telemetry?.recordRunState("connecting", "connecting");
    } catch (error) {
      this.errorCount += 1;
      this.logger.error(`[TELEMETRY] startup failed; continuing locally: ${safeError(error)}`);
    }

    this.startStagePolling();
    this.consumer = new MarketConsumer(
      this.config.kafkaBrokers,
      this.config.teamUsername,
      async (topic, value) => this.handleMessage(topic, value),
    );

    this.logger.info("[MODE] DRY RUN: strategy and risk checks enabled; order submission is impossible.");
    this.logger.info(`[CONFIG] Kafka group group-${this.config.teamUsername}; order requests disabled.`);
    this.logger.info("[READINESS] NOT READY until Kafka, official schemas, universe and portfolio checks pass.");

    try {
      await this.consumer.start(maxEvents);
    } catch (error) {
      await this.stop();
      throw error;
    }
    this.logger.info("[KAFKA] Connected and subscribed to market.ticks and market.news.");
    this.telemetry?.recordRunState("paused", this.stageLabel());
    const stopBySignal = new Promise<void>((resolve) => {
      const onSignal = () => resolve();
      process.once("SIGINT", onSignal);
      process.once("SIGTERM", onSignal);
      this.removeSignalListeners = () => {
        process.removeListener("SIGINT", onSignal);
        process.removeListener("SIGTERM", onSignal);
      };
    });

    try {
      if (maxEvents === undefined) {
        this.logger.info("[RUNTIME] Continuous mode explicitly enabled; press Ctrl+C to stop.");
        await stopBySignal;
      } else {
        this.logger.info(`[RUNTIME] Bounded run: at most ${maxEvents} Kafka messages or ${timeoutMs} ms.`);
        await Promise.race([
          this.consumer.completion,
          new Promise<void>((resolve) => {
            this.runTimeout = setTimeout(() => {
              this.logger.info("[RUNTIME] Time limit reached; stopping consumer.");
              resolve();
            }, timeoutMs);
            this.runTimeout.unref?.();
          }),
        ]);
      }
    } finally {
      this.removeSignalListeners?.();
      await this.stop();
    }
  }

  private runTimeout: ReturnType<typeof setTimeout> | null = null;
  private removeSignalListeners: (() => void) | null = null;

  async handleMessage(topicName: string, value: string): Promise<void> {
    const started = performance.now();
    const event = parseEvent(value);
    if (!event) {
      this.errorCount += 1;
      this.logger.warn(`[PARSE] Discarded malformed event from ${topicName}.`);
      return;
    }

    if (event.event_type === "preflight_tick") {
      if (topicName !== "market.ticks") {
        this.logger.warn(`[HEARTBEAT] Ignored preflight sequence from unexpected topic ${topicName}.`);
        return;
      }
      if (this.acknowledgedSequenceIds.has(event.seq)) {
        this.logger.info(`[HEARTBEAT] Duplicate preflight sequence ${event.seq}; acknowledgement remains disabled.`);
        return;
      }
      this.acknowledgedSequenceIds.add(event.seq);
      this.acknowledgedSequenceOrder.push(event.seq);
      if (this.acknowledgedSequenceOrder.length > 1000) {
        const expired = this.acknowledgedSequenceOrder.shift();
        if (expired !== undefined) this.acknowledgedSequenceIds.delete(expired);
      }
      this.logger.info(`[HEARTBEAT] Received preflight sequence ${event.seq}; acknowledgement is disabled.`);
      return;
    }

    if (event.event_type === "news_flash") {
      if (topicName !== "market.news") {
        this.logger.warn(`[PARSE] Ignored news event received on ${topicName}.`);
        return;
      }
      const date = event.simulated_date ??
        this.latestSimulatedDate.get(event.ticker) ??
        event.timestamp.slice(0, 10);
      const added = this.engine.news.add(event.ticker, event.headline, event.description, date);
      this.logger.info(`[NEWS] ticker=${event.ticker} duplicate=${!added} headline=${safeText(event.headline)}`);
      return;
    }

    if (topicName !== "market.ticks") {
      this.logger.warn(`[PARSE] Ignored market tick received on ${topicName}.`);
      return;
    }

    this.latestSimulatedDate.set(event.ticker, event.simulated_date);
    this.lastMarketEvent = {
      ticker: event.ticker,
      close: event.close,
      at: event.timestamp,
    };
    const decision = this.engine.onTick(event);
    const elapsedMs = performance.now() - started;
    this.logger.info(
      `[MARKET] ticker=${event.ticker} close=${event.close} simulated_date=${event.simulated_date}`,
    );
    this.logger.info(
      `[SIGNAL] ticker=${decision.ticker} action=${decision.action} trend=${decision.signal} reason=${decision.reason}`,
    );

    if (decision.action !== "HOLD") {
      const risk = this.risk.validate(
        {
          ticker: decision.ticker,
          action: decision.action,
          quantity: 1,
          date: decision.simulatedDate,
        },
        {
          running: this.stage?.stage === "simulation" && this.stage.status === "RUNNING",
          activeTickers: this.activeTickers,
          price: decision.close,
          simulatedDate: decision.simulatedDate,
          portfolio: this.portfolio,
          now: Date.now(),
          signalKey: `${decision.ticker}|${decision.simulatedDate}|${decision.signal}`,
        },
      );
      this.logger.info(
        `[RISK] ticker=${decision.ticker} ${risk.allowed ? "APPROVED" : "REJECTED"} reason=${risk.reason}`,
      );
      if (risk.allowed) {
        this.logger.info(
          `[HYPOTHETICAL ORDER] action=${decision.action} ticker=${decision.ticker} quantity=${risk.quantity}; not submitted.`,
        );
      }
      this.telemetry?.recordDecision(decision, event.timestamp, elapsedMs);
    }

    const now = Date.now();
    if (now - this.lastTelemetryAt >= 5000) {
      this.lastTelemetryAt = now;
      this.telemetry?.recordStatus(this.telemetryStatus(elapsedMs));
    }
  }

  setUniverse(tickers: readonly string[]): void {
    this.activeTickers.clear();
    for (const ticker of tickers) {
      if (ticker.trim()) this.activeTickers.add(ticker.trim());
    }
  }

  updateVenueStage(stage: VenueStage | null): void {
    const changed = stage?.stage !== this.stage?.stage || stage?.status !== this.stage?.status;
    this.stage = stage;
    if (changed) {
      this.telemetry?.recordRunState(
        stage?.status === "COMPLETED" ? "stopped" : "paused",
        this.stageLabel(),
      );
    }
  }

  private startStagePolling(): void {
    if (!this.config.botApiBase) {
      this.logger.warn("[STAGE] BOT_API_BASE is unset; stage remains unverified.");
      return;
    }
    const poll = async () => {
      if (this.stageRequestActive || this.abortController.signal.aborted) return;
      this.stageRequestActive = true;
      try {
        const next = await this.api?.getStage(this.abortController.signal);
        if (!next) return;
        const changed = next.stage !== this.stage?.stage || next.status !== this.stage?.status;
        this.updateVenueStage(next);
        if (changed) this.logger.info(`[STAGE] ${next.stage}/${next.status}`);
      } catch (error) {
        this.stage = null;
        this.errorCount += 1;
        this.logger.error(`[STAGE] state unavailable; risk checks will reject candidates: ${safeError(error)}`);
      } finally {
        this.stageRequestActive = false;
      }
    };
    void poll();
    this.stageTimer = setInterval(() => void poll(), this.config.stagePollIntervalMs);
    this.stageTimer.unref?.();
  }

  private telemetryStatus(latency: number): TelemetryStatus {
    return {
      kafka_status: this.consumer ? "connected" : "waiting",
      gateway_status: this.stage ? "connected" : "disconnected",
      engine_status: "paused",
      stage: this.stage ? `${this.stage.stage}/${this.stage.status}` : null,
      heartbeat_age_ms: null,
      processing_latency_ms: latency,
      latest_market_event: this.lastMarketEvent,
      last_order_at: null,
      error_count: this.errorCount,
    };
  }

  private stageLabel(): string {
    return this.stage ? `${this.stage.stage}/${this.stage.status}` : "unverified";
  }

  async stop(): Promise<void> {
    if (this.runTimeout) clearTimeout(this.runTimeout);
    if (this.stageTimer) clearInterval(this.stageTimer);
    this.abortController.abort();
    try {
      await this.consumer?.shutdown();
    } finally {
      try {
        await this.telemetry?.close();
      } catch (error) {
        this.logger.error(`[TELEMETRY] shutdown write failed: ${safeError(error)}`);
      }
      this.logger.info("[RUNTIME] Stopped. No financial orders were submitted.");
    }
  }
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error.";
  if (error.name === "TimeoutError" || error.name === "AbortError") return "Request timed out.";
  return error.message.replace(/https?:\/\/[^\s]+/g, "[configured endpoint]");
}

function safeText(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").slice(0, 160);
}
