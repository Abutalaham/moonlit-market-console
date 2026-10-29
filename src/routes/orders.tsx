import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ConsoleShell, DataGate, EmptyState, Panel } from "@/components/console/ConsoleShell";
import { ActionTag, StatusPill } from "@/components/console/StatusPill";
import { useConsoleData } from "@/hooks/use-console-data";
import { ORDER_ACTIONS, ORDER_STATUSES, formatINR, formatTime } from "@/lib/trading";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Order history — MANTHAN EDGE" },
      { name: "description", content: "Every order the bot submitted, with fills, rejection codes, latency and the reason behind it." },
      { property: "og:title", content: "Order history — MANTHAN EDGE" },
      { property: "og:description", content: "Submitted orders, confirmed executions and rejection reasons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Orders,
});

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("num rounded border px-2 py-1 text-[11px] uppercase", on ? "border-primary text-primary" : "border-border text-muted-foreground")}>
      {children}
    </button>
  );
}

function Orders() {
  const res = useConsoleData();
  const [action, setAction] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");

  if (res.status !== "ok" || !res.data) return <ConsoleShell title="Order history"><DataGate status={res.status} /></ConsoleShell>;
  const rows = res.data.orders.filter((o) => (action === "ALL" || o.action === action) && (status === "ALL" || o.status === status));

  return (
    <ConsoleShell title="Order history">
      <Panel
        title={`${rows.length} orders`}
        right={
          <div className="flex flex-wrap gap-1.5">
            {["ALL", ...ORDER_ACTIONS].map((a) => <Chip key={a} on={action === a} onClick={() => setAction(a)}>{a}</Chip>)}
            <span className="mx-1 w-px bg-border" />
            {["ALL", ...ORDER_STATUSES].map((s) => <Chip key={s} on={status === s} onClick={() => setStatus(s)}>{s}</Chip>)}
          </div>
        }
      >
        <p className="mb-3 text-xs text-muted-foreground">
          <span className="text-cyan">Submitted</span> = sent to the gateway, no fill confirmed yet. <span className="text-gain">Executed</span> = fill price confirmed by the venue.
        </p>
        {rows.length === 0 ? (
          <EmptyState title="No matching orders" body="Try clearing the filters, or wait for the bot to submit orders." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="eyebrow border-b border-border text-left">
                  {["Time", "Ticker", "Action", "Qty", "Exec price", "Status", "Rejection", "Latency", "Why"].map((h) => (
                    <th key={h} className="py-2 pr-4 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="num py-2.5 pr-4 text-muted-foreground">{formatTime(o.submitted_at)}</td>
                    <td className="num py-2.5 pr-4">{o.ticker}</td>
                    <td className="py-2.5 pr-4"><ActionTag action={o.action} /></td>
                    <td className="num py-2.5 pr-4">{o.quantity}</td>
                    <td className="num py-2.5 pr-4">{o.execution_price != null ? formatINR(o.execution_price, 2) : "—"}</td>
                    <td className="py-2.5 pr-4"><StatusPill value={o.status} /></td>
                    <td className="num py-2.5 pr-4 text-xs text-loss">{o.rejection_code ?? ""}</td>
                    <td className="num py-2.5 pr-4">{o.decision_latency_ms != null ? `${o.decision_latency_ms.toFixed(1)}ms` : "—"}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{o.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </ConsoleShell>
  );
}
