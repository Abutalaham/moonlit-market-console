import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LayoutDashboard, ListOrdered, LogIn, LogOut, SlidersHorizontal } from "lucide-react";
import { useMode } from "@/hooks/use-mode";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/console", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ListOrdered },
  { to: "/strategy", label: "Strategy", icon: SlidersHorizontal },
] as const;

export function ConsoleShell({ title, children }: { title: string; children: ReactNode }) {
  const { mode, setMode } = useMode();
  const { user } = useAuth();
  return (
    <div className="min-h-screen grid-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="glow-dot" />
            <span className="text-sm font-medium tracking-[0.2em]">MANTHAN EDGE</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex rounded-md border border-border p-0.5 text-xs">
              {(["demo", "connected"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded px-2.5 py-1 capitalize",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            {user ? (
              <button onClick={() => supabase.auth.signOut()} title={user.email ?? ""} className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <Link to="/login" className="text-muted-foreground hover:text-foreground" title="Sign in">
                <LogIn className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </header>
      {mode === "demo" && (
        <div className="border-b border-warn/30 bg-warn/10">
          <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-1.5 text-xs text-warn">
            <span className="num rounded border border-warn/50 px-1.5 py-0.5 font-medium tracking-widest">DEMO DATA</span>
            Fixed sample dataset for walkthroughs. Nothing here comes from a real bot or the venue.
          </div>
        </div>
      )}
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <h1 className="display mb-6 text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Panel({ title, right, children, className }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("glass rounded-xl p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="eyebrow">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

/** Rendered when connected mode can't show data (signed out, loading, backend error). */
export function DataGate({ status }: { status: string }) {
  const msg: Record<string, [string, string]> = {
    loading: ["Loading…", "Reading the latest run from Lovable Cloud."],
    "signed-out": ["Sign in to view connected data", "Run records are private to your team. Sign in, or switch to Demo."],
    "backend-error": ["Backend disconnected", "Could not reach Lovable Cloud. The bot keeps trading locally; this view will recover."],
  };
  const [t, b] = msg[status] ?? msg.loading;
  return (
    <div className="glass mx-auto max-w-lg rounded-xl p-8 text-center">
      <p className="display text-xl">{t}</p>
      <p className="mt-2 text-sm text-muted-foreground">{b}</p>
      {status === "signed-out" && (
        <Link to="/login" className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Sign in</Link>
      )}
    </div>
  );
}
