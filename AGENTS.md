<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Console is read-only toward the venue: no venue API calls or competition tokens in browser code; the local bot owns Kafka and REST orders.
- Bot writes to bot_runs/bot_telemetry/trade_decisions/order_audit/portfolio_snapshots with a server-side key; signed-in users can only read them. Watchlist, news and exposure live in bot_runs.summary (universe/news/exposure) to avoid storing ticks.
- Demo data lives only in src/lib/demo-data.ts and is shown only in Demo mode with a DEMO DATA banner.
- Pure trading/strategy rules live in src/lib/trading.ts and src/lib/strategy.ts with tests in src/test/trading-rules.test.ts.
