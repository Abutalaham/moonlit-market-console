import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — MANTHAN EDGE" },
      { name: "description", content: "Team sign-in for the MANTHAN EDGE trading console." },
      { property: "og:title", content: "Sign in — MANTHAN EDGE" },
      { property: "og:description", content: "Team sign-in for the trading console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      nav({ to: "/console" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/console` } });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Check your email to confirm your account.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center grid-bg px-4">
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-xl p-7">
        <div className="flex items-center gap-2.5"><span className="glow-dot" /><span className="text-sm tracking-[0.2em]">MANTHAN EDGE</span></div>
        <h1 className="display mt-6 text-2xl">{mode === "in" ? "Team sign in" : "Create team account"}</h1>
        <p className="mt-1 text-xs text-muted-foreground">This is your console login — never your competition token.</p>
        <div className="mt-6 space-y-3">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button disabled={busy} className="mt-5 w-full rounded-md bg-primary py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}
        </button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
