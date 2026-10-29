import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConsoleShell, Panel } from "@/components/console/ConsoleShell";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STRATEGY, LIMITS, validateStrategy, type FieldKey, type StrategyConfig } from "@/lib/strategy";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/strategy")({
  head: () => ({
    meta: [
      { title: "Strategy settings — MANTHAN EDGE" },
      { name: "description", content: "Trend, news-sentiment and risk limits the local trading bot reads at start-up." },
      { property: "og:title", content: "Strategy settings — MANTHAN EDGE" },
      { property: "og:description", content: "Configure trend, news and risk parameters for the bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Strategy,
});

const CONFIG_NAME = "default";

function Strategy() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errors = useMemo(() => validateStrategy(cfg), [cfg]);
  const valid = Object.keys(errors).length === 0;

  useEffect(() => {
    if (!user) return;
    supabase.from("strategy_configs").select("*").eq("name", CONFIG_NAME).maybeSingle().then(({ data }) => {
      if (!data) return;
      const p = data.params as unknown as Partial<StrategyConfig>;
      setCfg({
        trend: { ...DEFAULT_STRATEGY.trend, ...p.trend },
        news: { ...DEFAULT_STRATEGY.news, ...p.news },
        risk: { ...DEFAULT_STRATEGY.risk, ...(data.risk_limits as unknown as Partial<StrategyConfig["risk"]>) },
      });
      setSavedAt(data.updated_at);
    });
  }, [user]);

  const setNum = (key: FieldKey, v: string) => {
    const [g, f] = key.split(".") as [keyof StrategyConfig, string];
    setCfg((c) => ({ ...c, [g]: { ...c[g], [f]: v === "" ? NaN : Number(v) } }));
  };

  const save = async () => {
    if (!user || !valid) return undefined;
    setSaving(true);
    const { data, error } = await supabase
      .from("strategy_configs")
      .upsert(
        {
          name: CONFIG_NAME,
          params: { trend: cfg.trend, news: cfg.news } as unknown as Json,
          risk_limits: cfg.risk as unknown as Json,
          enabled_modules: ["trend", "news", "risk", ...(cfg.risk.shortingEnabled ? ["shorting"] : [])],
          is_active: true,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "name" },
      )
      .select("updated_at")
      .single();
    setSaving(false);
    if (error) { toast.error(`Could not save: ${error.message}`); return; }
    setSavedAt(data.updated_at);
    toast.success("Settings saved. The bot picks them up on its next config read.");
  };

  const NumField = ({ k, suffix }: { k: FieldKey; suffix?: string }) => {
    const r = LIMITS[k];
    const [g, f] = k.split(".") as [keyof StrategyConfig, string];
    const v = (cfg[g] as unknown as Record<string, number>)[f];
    return (
      <label className="block">
        <span className="flex justify-between text-sm"><span>{r.label}</span><span className="num text-[11px] text-muted-foreground">{r.min}–{r.max}{suffix}</span></span>
        <Input type="number" step="any" value={Number.isNaN(v) ? "" : v} onChange={(e) => setNum(k, e.target.value)} className="num mt-1.5" aria-invalid={!!errors[k]} />
        {errors[k] && <span className="mt-1 block text-xs text-loss">{errors[k]}</span>}
      </label>
    );
  };

  return (
    <ConsoleShell title="Strategy settings">
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        These settings are stored for the local bot to read. Saving does not place or change any order. They are controls, not a guarantee against loss.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Trend following">
          <div className="space-y-4">
            <NumField k="trend.fastLookback" />
            <NumField k="trend.slowLookback" />
            <NumField k="trend.minHistory" />
          </div>
        </Panel>
        <Panel title="News sentiment">
          <div className="space-y-4">
            <label className="block text-sm">Positive keywords
              <Textarea rows={3} value={cfg.news.positiveKeywords} onChange={(e) => setCfg((c) => ({ ...c, news: { ...c.news, positiveKeywords: e.target.value } }))} className="mt-1.5" />
            </label>
            <label className="block text-sm">Negative keywords
              <Textarea rows={3} value={cfg.news.negativeKeywords} onChange={(e) => setCfg((c) => ({ ...c, news: { ...c.news, negativeKeywords: e.target.value } }))} className="mt-1.5" />
            </label>
            {errors.keywords && <span className="block text-xs text-loss">{errors.keywords}</span>}
            <NumField k="news.minSentimentMargin" />
          </div>
        </Panel>
        <Panel title="Risk management">
          <div className="space-y-4">
            <NumField k="risk.maxPositionPct" suffix="%" />
            <NumField k="risk.maxExposurePct" suffix="%" />
            <NumField k="risk.minCashReservePct" suffix="%" />
            <NumField k="risk.maxOpenPositions" />
            <NumField k="risk.stopLossPct" suffix="%" />
            <NumField k="risk.maxOrderQty" />
            <label className="flex items-center justify-between text-sm">
              Allow short selling
              <Switch checked={cfg.risk.shortingEnabled} onCheckedChange={(v) => setCfg((c) => ({ ...c, risk: { ...c.risk, shortingEnabled: v } }))} />
            </label>
          </div>
        </Panel>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        {user ? (
          <button disabled={!valid || saving} onClick={save} className="rounded-md bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-40">
            {saving ? "Saving…" : "Save settings"}
          </button>
        ) : (
          <Link to="/login" className="rounded-md bg-primary px-5 py-2 text-sm text-primary-foreground">Sign in to save</Link>
        )}
        <button onClick={() => setCfg(DEFAULT_STRATEGY)} className="text-sm text-muted-foreground hover:text-foreground">Reset to conservative defaults</button>
        {!valid && <span className="text-xs text-loss">Fix the highlighted fields before saving.</span>}
        {savedAt && <span className="num text-xs text-muted-foreground">last saved {new Date(savedAt).toLocaleString("en-IN")}</span>}
      </div>
    </ConsoleShell>
  );
}
