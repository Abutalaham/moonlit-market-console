# MANTHAN EDGE trading bot

This directory is a separate Node.js process; it does not change the dashboard or put venue credentials in browser code. The frontend remains read-only toward the venue. The bot defaults to dry-run (`TRADING_ENABLED=false`).

## Current status and safety

There is no official starter, competition guide, or sample API response in this workspace. The bot is therefore an offline-testable foundation, **not a live-ready trading engine**. Diagnostics never connect to the venue and never report READY. Enabling `TRADING_ENABLED` currently fails closed: the official portfolio and order response schemas have not been verified, so safe reconciliation and ambiguous-order handling cannot yet be implemented or claimed. The runtime does not submit orders.

Do not fill in guessed venue addresses or use personal funds. Obtain the official starter/configuration, response examples and assigned private-network address from the organizers before adding live runtime wiring. No Kafka or venue connection has been tested.

## Requirements and setup

- Node.js 20.6 or newer and npm.
- From this directory, install the bot-only dependencies:

  ```powershell
  cd trading-bot
  npm install
  Copy-Item .env.example .env
  ```

- Edit `.env` locally. Set only organizer-provided values. Never commit `.env`; the example contains placeholders only. `SUPABASE_SERVICE_ROLE_KEY` belongs only in this bot's private environment.
- An empty venue configuration is fine for offline tests.
- The repository's existing root `.env` is already tracked by Git. It was preserved and not inspected because it may support the Lovable frontend; `.gitignore` does not untrack files already in Git. Review that file locally and rotate any credentials it may contain.

## Commands

```powershell
npm test
npm run diagnostics
npm start
```

`npm start` reads `trading-bot/.env`; it exits with an explicit error until the official runtime schemas and adapters are verified. Diagnostics make no network connection. Do not enable order execution based on diagnostics.

## Implemented offline core

- Strict parsing of documented tick, news, and preflight event field names; malformed or invalid market events are discarded.
- Deterministic 5/20 SMA crossover and bounded, de-duplicated keyword news scoring.
- Risk checks for stage, active universe, date/price, snapshot age, positive integer/API quantity, cash reserve, exposure, position count, and position semantics. Shorts default off; SELL/COVER require holdings.
- Shared request limiter and typed HTTP client helpers for the routes listed in the supplied project specification.
- A KafkaJS single-consumer adapter with the assigned group naming convention, latest-offset start, disabled auto-commit, manual per-message commits, and shutdown support. It is not started by diagnostics or the current main command.

## Dashboard telemetry

The existing Supabase migration defines `bot_runs`, `bot_telemetry`, `trade_decisions`, `order_audit`, and `portfolio_snapshots`. The isolated telemetry writer uses these names/columns, batches asynchronously, and bounds its queue; its service-role key is read only from bot process environment variables. The current main command does not instantiate the writer because the venue runtime remains blocked on missing official schemas. With no Supabase variables, no Supabase connection is created.

## Remaining work before a venue demonstration

1. Obtain and inspect the official starter or API documentation, especially exact stocks/history/portfolio/cash/order response shapes and Kafka payload samples.
2. Verify the heartbeat sequence field, authentication format, assigned broker/gateway address, topic subscription, group naming and offset rules on the venue network.
3. Implement and test strict response adapters, portfolio reconciliation, order-audit lookup after ambiguous timeouts, and lifecycle polling; then wire the existing Kafka and Supabase components into a graceful runtime.
4. Test offline with fixtures from the official specification; then verify readiness on the venue network with order execution still disabled.
5. Only after those checks, deliberately implement and enable the competition-order path.

The strategy is a transparent baseline, not a profit guarantee. It does not yet include order execution, stop-loss execution, venue readiness, or functional Supabase telemetry.
