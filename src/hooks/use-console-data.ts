import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { useMode } from "./use-mode";
import {
  DEMO_EXPOSURE, DEMO_LATENCY, DEMO_NEWS, DEMO_ORDERS, DEMO_SNAPSHOTS, DEMO_TELEMETRY, DEMO_WATCHLIST,
} from "@/lib/demo-data";
import type { NewsItem, OrderRow, Snapshot, Telemetry, WatchItem } from "@/lib/trading";

export interface ConsoleData {
  source: "demo" | "connected";
  runLabel: string | null;
  telemetry: Telemetry | null;
  snapshots: Snapshot[];
  orders: OrderRow[];
  watchlist: WatchItem[];
  news: NewsItem[];
  exposure: { long: number; short: number; openPositions: number; maxDrawdownPct: number | null } | null;
  latency: { bucket: string; count: number }[];
}

const DEMO: ConsoleData = {
  source: "demo",
  runLabel: "DEMO RUN",
  telemetry: DEMO_TELEMETRY,
  snapshots: DEMO_SNAPSHOTS,
  orders: DEMO_ORDERS,
  watchlist: DEMO_WATCHLIST,
  news: DEMO_NEWS,
  exposure: DEMO_EXPOSURE,
  latency: DEMO_LATENCY,
};

function bucketLatency(values: number[]) {
  const edges: [string, number][] = [["<10ms", 10], ["10–20", 20], ["20–40", 40], ["40–80", 80], [">80", Infinity]];
  return edges.map(([bucket, hi], i) => ({
    bucket,
    count: values.filter((v) => v < hi && v >= (i === 0 ? -Infinity : edges[i - 1][1])).length,
  }));
}

async function loadConnected(): Promise<ConsoleData> {
  const { data: run, error } = await supabase
    .from("bot_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const empty: ConsoleData = {
    source: "connected", runLabel: null, telemetry: null, snapshots: [], orders: [],
    watchlist: [], news: [], exposure: null, latency: [],
  };
  if (!run) return empty;

  const [tel, snaps, orders, decisions] = await Promise.all([
    supabase.from("bot_telemetry").select("*").eq("run_id", run.id).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("portfolio_snapshots").select("*").eq("run_id", run.id).order("recorded_at", { ascending: true }).limit(500),
    supabase.from("order_audit").select("*").eq("run_id", run.id).order("submitted_at", { ascending: false }).limit(200),
    supabase.from("trade_decisions").select("id, reason, decision_latency_ms").eq("run_id", run.id).order("event_at", { ascending: false }).limit(300),
  ]);
  for (const r of [tel, snaps, orders, decisions]) if (r.error) throw r.error;

  const decMap = new Map((decisions.data ?? []).map((d) => [d.id, d]));
  const summary = (run.summary ?? {}) as {
    universe?: WatchItem[]; news?: NewsItem[];
    exposure?: ConsoleData["exposure"];
  };

  return {
    source: "connected",
    runLabel: run.run_label,
    telemetry: (tel.data as unknown as Telemetry) ?? null,
    snapshots: (snaps.data ?? []).map((s) => ({
      recorded_at: s.recorded_at,
      available_cash: Number(s.available_cash), locked_margin: Number(s.locked_margin),
      holdings_value: Number(s.holdings_value), total_wealth: Number(s.total_wealth),
      realized_pnl: Number(s.realized_pnl), unrealized_pnl: Number(s.unrealized_pnl),
    })),
    orders: (orders.data ?? []).map((o) => {
      const d = o.decision_id != null ? decMap.get(o.decision_id) : undefined;
      return {
        id: o.id, ticker: o.ticker, action: o.action as OrderRow["action"], quantity: o.quantity,
        submitted_at: o.submitted_at, responded_at: o.responded_at, status: o.status as OrderRow["status"],
        rejection_code: o.rejection_code, execution_price: o.execution_price == null ? null : Number(o.execution_price),
        decision_latency_ms: d?.decision_latency_ms == null ? null : Number(d.decision_latency_ms),
        reason: d?.reason ?? null,
      };
    }),
    watchlist: summary.universe ?? [],
    news: summary.news ?? [],
    exposure: summary.exposure ?? null,
    latency: bucketLatency((decisions.data ?? []).map((d) => Number(d.decision_latency_ms)).filter((v) => Number.isFinite(v))),
  };
}

export function useConsoleData() {
  const { mode } = useMode();
  const { user, loading } = useAuth();
  const q = useQuery({
    queryKey: ["console", user?.id],
    queryFn: loadConnected,
    enabled: mode === "connected" && !!user,
    refetchInterval: 5000,
  });
  if (mode === "demo") return { mode, data: DEMO, status: "ok" as const };
  if (loading) return { mode, data: null, status: "loading" as const };
  if (!user) return { mode, data: null, status: "signed-out" as const };
  if (q.isError) return { mode, data: null, status: "backend-error" as const, error: q.error };
  if (!q.data) return { mode, data: null, status: "loading" as const };
  return { mode, data: q.data, status: "ok" as const };
}
