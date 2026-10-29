# MANTHAN EDGE trading bot

This directory is a separate Node.js process; it does not change the dashboard or put venue credentials in browser code. The frontend remains read-only toward the venue. This phase hard-locks order submission off, regardless of `TRADING_ENABLED`.

## Current status and safety

The supplied participant portal did not respond from the development laptop during the latest check, and the candidate gateway/Kafka ports were unreachable. The venue API clock, stock, history, portfolio, heartbeat, and order schemas therefore remain unverified. The diagnostic command makes only bounded, read-only requests and never reports trading readiness. The runtime consumes Kafka only when configured, computes/logs signals, runs available risk checks, and **cannot submit orders**.

Do not fill in guessed service addresses or use personal funds. Use the participant portal and organizer instructions to obtain the API and broker addresses. The `192.168.65.157:3003` portal address is the supplied candidate only; the gateway and broker must be configured separately after the organizers confirm them. No Kafka events were consumed during the last check.

## Requirements and setup

- Node.js 20.12 or newer and npm.
- From this directory, install the bot-only dependencies:

  ```powershell
  cd trading-bot
  npm ci
  Copy-Item .env.example .env
  ```

- Edit `.env` locally. Set `TEAM_USERNAME`, `KAFKA_BROKERS`, `BOT_API_BASE`, and (if provided) `BOT_ACCESS_TOKEN` using organizer-confirmed values only. Keep `TRADING_ENABLED=false`, `ACKNOWLEDGE_PREFLIGHT=false`, and `ENABLE_SHORTS=false`. Never commit `.env`; the example contains placeholders only. `SUPABASE_SERVICE_ROLE_KEY` belongs only in this bot's private environment.
- An empty venue configuration is fine for offline tests.
- The root frontend `.env` was removed from Git tracking while its local copy was preserved. The variable names and Git history were checked locally without printing values; no competition token or service-role key assignment was found in the checked `.env` versions. A root `.env.example` contains placeholders.

## Commands

```powershell
npm run venue:check
npm run bot:dry-run
npm test
npm run check
npm start
```

Run the commands from `trading-bot/`. `venue:check` checks the supplied portal and then checks API endpoints only when `BOT_API_BASE` is configured; it checks authenticated stock discovery only when a token is configured. It also checks configured Kafka TCP endpoints and the consumer-group format. It never submits orders. `bot:dry-run` consumes at most 20 messages or 45 seconds. `npm start` is the explicit continuous mode and stops with Ctrl+C. `TRADING_ENABLED=true` does not enable orders.

The current risk pipeline deliberately rejects candidate orders while an authoritative portfolio snapshot or verified active ticker universe is unavailable. Historical-price warming and those API adapters await the official response schemas. Signals can still be evaluated from consumed ticks once enough same-symbol events arrive. A rejected candidate is logged with its reason; there is no fabricated live data.

Pre-flight heartbeat messages are parsed and deduplicated, but acknowledgments are disabled until the venue confirms the payload/acknowledgment contract. A JSON simulation-clock response is not enough to claim its schema is verified.

## Implemented offline core

- Strict parsing of documented tick, news, and preflight event field names; malformed or invalid market events are discarded.
- Deterministic 5/20 SMA crossover and bounded, de-duplicated keyword news scoring.
- Risk checks for stage, active universe, date/price, snapshot age, positive integer/API quantity, cash reserve, exposure, position count, and position semantics. Shorts default off; SELL/COVER require holdings.
- Shared request limiter and typed HTTP client helpers for the routes listed in the supplied project specification.
- A KafkaJS single-consumer runtime with `group-<TEAM_USERNAME>`, latest-offset start, disabled auto-commit, manual per-message commits, bounded event/time mode, and graceful shutdown. The venue diagnostic checks only TCP reachability; actual topic consumption still requires the venue network.

## Dashboard telemetry

The existing Supabase migration defines `bot_runs`, `bot_telemetry`, `trade_decisions`, `order_audit`, and `portfolio_snapshots`. The runtime uses the optional isolated writer for run status, throttled connection/event telemetry, and signal decisions. Writes are batched asynchronously through a bounded queue. With no Supabase variables, no Supabase connection is created. Portfolio snapshots and order audit writes remain unused until the corresponding verified venue adapters exist.

## Remaining work before a venue demonstration

1. Connect the laptop to the venue Wi-Fi and confirm the participant portal responds.
2. Read its API documentation to confirm service hosts, auth header, exact stock/history/clock/portfolio/cash and heartbeat response shapes, and Kafka payload/offset rules.
3. Configure the bot's `.env`, run `npm run venue:check`, then run `npm run bot:dry-run` and confirm actual events and decisions.
4. Implement/test strict response parsers, historical warm-up, authoritative portfolio and universe reconciliation, heartbeat acknowledgment, and order-audit lookup.
5. Keep order submission disabled for this phase. Enabling it requires a separate explicit review after all response schemas and risk paths are verified.

The strategy is a transparent baseline, not a profit guarantee. No competition order was sent, and no live connection has been confirmed. GitHub Actions checks code only; it has no venue secrets and does not connect to the LAN. The frontend is a TanStack Start server-rendered app using a Cloudflare/Nitro server target, so GitHub Pages static deployment is not configured or appropriate without validating a compatible server host.
