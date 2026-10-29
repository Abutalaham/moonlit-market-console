import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { ConsoleShell, DataGate, EmptyState, Panel } from "@/components/console/ConsoleShell";
import { ActionTag, StatusPill } from "@/components/console/StatusPill";
import { useConsoleData, type ConsoleData } from "@/hooks/use-console-data";
import {
  BOT_STATE_LABEL, STARTING_CAPITAL, cashUtilization, deriveBotState, formatINR, formatTime,
} from "@/lib/trading";
import { DEMO_TELEMETRY } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "Dashboard — MANTHAN EDGE" },
      { name: "description", content: "Live status, portfolio, market watch and risk for the MANTHAN EDGE trading bot." },
      { property: "og:title", content: "Dashboard — MANTHAN EDGE" },
      { property: "og:description", content: "Bot status, portfolio, market watch and risk at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function useNow(ms = 2000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function Dashboard() {
  const res = useConsoleData();
  return (
    <ConsoleShell title="Trading console">
      {res.status !== "ok" || !res.data ? <DataGate status={res.status} /> : <Body d={res.data} />}
    </ConsoleShell>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "gain" | "loss"; sub?: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="eyebrow">{label}</div>
      <div className={cn("num mt-2 text-xl", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Body({ d }: { d: ConsoleData }) {
  const liveNow = useNow();
  // Demo data is pinned in time, so evaluate it against its own timestamp.
  const now = d.source === "demo" ? Date.parse(DEMO_TELEMETRY.recorded_at) + 1000 : liveNow;
  const t = d.telemetry;
  const botState = deriveBotState(t, now);
  const snap = d.snapshots.at(-1);
  const simulated = d.source === "demo";
  const rejected = d.orders.filter((o) => o.status === "rejected").length;
  const errors = d.orders.filter((o) => o.status === "error").length + (t?.error_count ?? 0);

  const links: [string, string][] = [
    ["Kafka", botState === "no-data" || botState === "offline" ? "disconnected" : t!.kafka_status],
    ["Order gateway", botState === "no-data" || botState === "offline" ? "disconnected" : t!.gateway_status],
    ["Bot heartbeat", botState === "no-data" ? "waiting" : botState === "offline" ? "disconnected" : "connected"],
    ["Engine", botState === "no-data" || botState === "offline" ? "waiting" : t!.engine_status],
  ];

  return (
    <div className="space-y-4">
      {/* A. Connection & stage */}
      <Panel
        title={`Connection & stage${simulated ? " · simulated" : ""}`}
        right={<span className="text-xs text-muted-foreground">{d.runLabel ?? "No run yet"}</span>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {links.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{k}</div>
              <StatusPill value={v} className="mt-2" />
            </div>
          ))}
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Stage</div>
            <div className="num mt-2 text-sm uppercase">{t?.stage ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">Overall</div>
            <div className={cn("mt-2 text-sm", botState === "running" ? "text-gain" : botState === "error" ? "text-loss" : "text-foreground")}>
              {BOT_STATE_LABEL[botState]}
            </div>
          </div>
        </div>
        {t && (
          <p className="num mt-3 text-[11px] text-muted-foreground">
            last telemetry {formatTime(t.recorded_at)} · heartbeat age {t.heartbeat_age_ms ?? "—"}ms · processing {t.processing_latency_ms ?? "—"}ms · last order {formatTime(t.last_order_at)}
          </p>
        )}
      </Panel>

      {/* B. Portfolio */}
      {snap ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Stat label="Starting capital" value={formatINR(STARTING_CAPITAL)} />
          <Stat label="Total wealth" value={formatINR(snap.total_wealth)} tone={snap.total_wealth >= STARTING_CAPITAL ? "gain" : "loss"} sub={`${(((snap.total_wealth - STARTING_CAPITAL) / STARTING_CAPITAL) * 100).toFixed(2)}%`} />
          <Stat label="Available cash" value={formatINR(snap.available_cash)} />
          <Stat label="Locked margin" value={formatINR(snap.locked_margin)} />
          <Stat label="Realized P&L" value={formatINR(snap.realized_pnl)} tone={snap.realized_pnl >= 0 ? "gain" : "loss"} />
          <Stat label="Unrealized P&L" value={formatINR(snap.unrealized_pnl)} tone={snap.unrealized_pnl >= 0 ? "gain" : "loss"} />
          <Stat label="Cash utilization" value={`${(cashUtilization(snap.available_cash, snap.total_wealth) * 100).toFixed(1)}%`} />
          <Stat
            label="Long / short"
            value={d.exposure ? `${formatINR(d.exposure.long)}` : "—"}
            sub={d.exposure ? `short ${formatINR(d.exposure.short)} · DD ${d.exposure.maxDrawdownPct ?? "—"}%` : "no exposure data"}
          />
        </div>
      ) : (
        <Panel title="Portfolio"><EmptyState title="No portfolio snapshots yet" body="The bot writes a snapshot every few seconds once a run starts." /></Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Wealth curve" className="lg:col-span-2">
          {d.snapshots.length > 1 ? (
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={d.snapshots}>
                  <defs>
                    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="recorded_at" tickFormatter={formatTime} stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `${(v / 100000).toFixed(2)}L`} stroke="var(--muted-foreground)" fontSize={10} width={48} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 12 }} labelFormatter={(l) => formatTime(String(l))} formatter={(v) => formatINR(Number(v))} />
                  <Area dataKey="total_wealth" stroke="var(--primary)" fill="url(#w)" strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="Not enough history" body="Need at least two snapshots to draw a curve." />
          )}
        </Panel>

        {/* E. Strategy & risk */}
        <Panel title="Strategy & risk">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Active strategy</dt><dd className="text-right">{simulated ? "Trend + News" : "see Strategy"}</dd>
            <dt className="text-muted-foreground">Risk mode</dt><dd className="text-right">Conservative</dd>
            <dt className="text-muted-foreground">Open positions</dt><dd className="num text-right">{d.exposure?.openPositions ?? "—"}</dd>
            <dt className="text-muted-foreground">Rejected orders</dt><dd className={cn("num text-right", rejected && "text-loss")}>{rejected}</dd>
            <dt className="text-muted-foreground">Errors</dt><dd className={cn("num text-right", errors && "text-loss")}>{errors}</dd>
          </dl>
          <div className="mt-4 eyebrow">Decision latency</div>
          {d.latency.some((b) => b.count) ? (
            <div className="mt-2 h-28">
              <ResponsiveContainer>
                <BarChart data={d.latency}>
                  <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 12 }} cursor={{ fill: "var(--accent)" }} />
                  <Bar dataKey="count" fill="var(--cyan)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No decisions recorded yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* C. Market */}
        <Panel title="Watchlist · discovered universe">
          {d.watchlist.length ? (
            <ul className="divide-y divide-border">
              {d.watchlist.map((w) => {
                const Icon = w.signal === "bullish" ? TrendingUp : w.signal === "bearish" ? TrendingDown : Minus;
                return (
                  <li key={w.ticker} className="flex items-center gap-3 py-2 text-sm">
                    <Icon className={cn("h-4 w-4", w.signal === "bullish" ? "text-gain" : w.signal === "bearish" ? "text-loss" : "text-muted-foreground")} />
                    <span className="num flex-1">{w.ticker}</span>
                    <span className="num">{w.last.toFixed(2)}</span>
                    <span className={cn("num w-16 text-right", w.change_pct >= 0 ? "text-gain" : "text-loss")}>{w.change_pct >= 0 ? "+" : ""}{w.change_pct.toFixed(2)}%</span>
                    <span className="num w-16 text-right text-[10px] text-muted-foreground">{formatTime(w.updated_at)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Universe not discovered yet" body="The bot fills this from GET /api/v1/stocks during pre-flight." />
          )}
        </Panel>

        <Panel title="Corporate news">
          {d.news.length ? (
            <ul className="space-y-3">
              {d.news.map((n, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={cn("num uppercase", n.sentiment === "positive" ? "text-gain" : n.sentiment === "negative" ? "text-loss" : "text-muted-foreground")}>{n.sentiment}</span>
                    {n.ticker && <span className="num text-muted-foreground">{n.ticker}</span>}
                    <span className="num ml-auto text-muted-foreground">{formatTime(n.at)}</span>
                  </div>
                  <p className="mt-0.5">{n.headline}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No news yet" body="Headlines appear when the bot forwards selected news events." />
          )}
        </Panel>

        {/* D. Recent activity */}
        <Panel title="Recent orders" right={<Link to="/orders" className="text-xs text-primary">All orders →</Link>}>
          {d.orders.length ? (
            <ul className="divide-y divide-border">
              {d.orders.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2 text-sm">
                  <ActionTag action={o.action} />
                  <span className="num flex-1">{o.ticker}</span>
                  <span className="num text-muted-foreground">×{o.quantity}</span>
                  <StatusPill value={o.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No orders yet" body="Orders show up here as soon as the bot submits them." />
          )}
          {rejected > 0 && (
            <p className="mt-3 flex items-center gap-2 text-xs text-loss"><AlertTriangle className="h-3.5 w-3.5" /> {rejected} rejected order{rejected > 1 ? "s" : ""} — check reasons in Orders.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
