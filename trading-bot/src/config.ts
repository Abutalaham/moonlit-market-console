function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be "true" or "false"`);
}

export interface BotConfig {
  teamUsername: string;
  venuePortalUrl: string;
  kafkaBrokers: string[];
  botApiBase: string;
  botAccessToken: string;
  tradingEnabled: boolean;
  acknowledgePreflight: boolean;
  enableShorts: boolean;
  fastSmaPeriod: number;
  slowSmaPeriod: number;
  cashReservePct: number;
  maxPositionPct: number;
  maxPortfolioExposurePct: number;
  maxOpenPositions: number;
  maxOrderQty: number;
  stopLossPct: number;
  requestsPerMinuteLimit: number;
  stagePollIntervalMs: number;
  portfolioMaxAgeMs: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export function loadConfig(): BotConfig {
  const config: BotConfig = {
    teamUsername: process.env.TEAM_USERNAME?.trim() ?? "",
    venuePortalUrl: process.env.VENUE_PORTAL_URL?.trim() || "http://192.168.65.157:3003",
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    botApiBase: process.env.BOT_API_BASE?.trim() ?? "",
    botAccessToken: process.env.BOT_ACCESS_TOKEN ?? "",
    tradingEnabled: false,
    acknowledgePreflight: boolEnv("ACKNOWLEDGE_PREFLIGHT", false),
    enableShorts: boolEnv("ENABLE_SHORTS", false),
    fastSmaPeriod: numberEnv("FAST_SMA_PERIOD", 5),
    slowSmaPeriod: numberEnv("SLOW_SMA_PERIOD", 20),
    cashReservePct: numberEnv("CASH_RESERVE_PCT", 25),
    maxPositionPct: numberEnv("MAX_POSITION_PCT", 10),
    maxPortfolioExposurePct: numberEnv("MAX_PORTFOLIO_EXPOSURE_PCT", 60),
    maxOpenPositions: numberEnv("MAX_OPEN_POSITIONS", 6),
    maxOrderQty: numberEnv("MAX_ORDER_QTY", 1_000_000),
    stopLossPct: numberEnv("STOP_LOSS_PCT", 3),
    requestsPerMinuteLimit: numberEnv("REQUESTS_PER_MINUTE_LIMIT", 90),
    stagePollIntervalMs: numberEnv("STAGE_POLL_INTERVAL_MS", 2500),
    portfolioMaxAgeMs: numberEnv("PORTFOLIO_MAX_AGE_MS", 10000),
    supabaseUrl: process.env.SUPABASE_URL?.trim() ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
  validateConfig(config);
  return config;
}

function validateConfig(config: BotConfig): void {
  if (config.fastSmaPeriod < 1 || !Number.isInteger(config.fastSmaPeriod))
    throw new Error("FAST_SMA_PERIOD must be a positive integer");
  if (config.slowSmaPeriod <= config.fastSmaPeriod || !Number.isInteger(config.slowSmaPeriod))
    throw new Error("SLOW_SMA_PERIOD must be an integer greater than FAST_SMA_PERIOD");
  if (config.maxOpenPositions < 1 || !Number.isInteger(config.maxOpenPositions))
    throw new Error("MAX_OPEN_POSITIONS must be a positive integer");
  if (config.maxOrderQty < 1 || config.maxOrderQty > 1_000_000 || !Number.isInteger(config.maxOrderQty))
    throw new Error("MAX_ORDER_QTY must be an integer between 1 and 1,000,000");
  if (config.portfolioMaxAgeMs < 1) throw new Error("PORTFOLIO_MAX_AGE_MS must be positive");
  if (config.requestsPerMinuteLimit < 1 || config.requestsPerMinuteLimit > 120)
    throw new Error("REQUESTS_PER_MINUTE_LIMIT must be between 1 and 120");
  if (config.stagePollIntervalMs < 2000 || config.stagePollIntervalMs > 3000)
    throw new Error("STAGE_POLL_INTERVAL_MS must be between 2000 and 3000");
  for (const [name, value] of [
    ["CASH_RESERVE_PCT", config.cashReservePct],
    ["MAX_POSITION_PCT", config.maxPositionPct],
    ["MAX_PORTFOLIO_EXPOSURE_PCT", config.maxPortfolioExposurePct],
    ["STOP_LOSS_PCT", config.stopLossPct],
  ] as const) {
    if (value <= 0 || value > 100) throw new Error(`${name} must be greater than 0 and at most 100`);
  }
  if (config.maxPortfolioExposurePct + config.cashReservePct > 100)
    throw new Error("MAX_PORTFOLIO_EXPOSURE_PCT plus CASH_RESERVE_PCT cannot exceed 100");
  if (config.supabaseUrl && !config.supabaseServiceRoleKey)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is configured");
  if (!config.supabaseUrl && config.supabaseServiceRoleKey)
    throw new Error("SUPABASE_URL is required when SUPABASE_SERVICE_ROLE_KEY is configured");
  if (config.acknowledgePreflight)
    throw new Error("Pre-flight acknowledgments remain disabled until the venue acknowledgment schema is verified.");
}

export function missingVenueSettings(config: BotConfig): string[] {
  return [
    ["TEAM_USERNAME", config.teamUsername],
    ["KAFKA_BROKERS", config.kafkaBrokers.join(",")],
    ["BOT_API_BASE", config.botApiBase],
    ["BOT_ACCESS_TOKEN", config.botAccessToken],
  ].filter(([, value]) => !value).map(([name]) => name);
}
