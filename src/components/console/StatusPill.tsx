import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  connected: "text-gain border-gain/40", running: "text-gain border-gain/40", ready: "text-cyan border-cyan/40",
  executed: "text-gain border-gain/40", waiting: "text-warn border-warn/40", connecting: "text-warn border-warn/40",
  paused: "text-warn border-warn/40", submitted: "text-cyan border-cyan/40",
  disconnected: "text-muted-foreground border-border", stopped: "text-muted-foreground border-border",
  error: "text-loss border-loss/40", rejected: "text-loss border-loss/40",
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("num inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] uppercase tracking-wider", TONE[value] ?? "text-muted-foreground border-border", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}

export function ActionTag({ action }: { action: string }) {
  const tone = action === "BUY" || action === "COVER" ? "text-gain" : "text-loss";
  return <span className={cn("num text-xs font-medium", tone)}>{action}</span>;
}
