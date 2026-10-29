import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { RidgeCanvas } from "@/components/landing/RidgeCanvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MANTHAN EDGE — Where stillness reveals the signal" },
      { name: "description", content: "Autonomous trading intelligence for MANTHAN 2026: Kafka market events, news sentiment and risk-checked orders, monitored from one calm console." },
      { property: "og:title", content: "MANTHAN EDGE — Autonomous Trading Intelligence" },
      { property: "og:description", content: "One calm console for an autonomous trading bot at the MANTHAN 2026 hackathon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const SECTIONS = [
  { id: "hero", label: "Edge" },
  { id: "venue", label: "Venue" },
  { id: "architecture", label: "Pathways" },
  { id: "pillars", label: "Pillars" },
  { id: "console", label: "Console" },
];

const PILLARS = [
  { n: "01", t: "Total Wealth", d: "Cash + locked margin + long and short market value, valued at the latest Kafka close." },
  { n: "02", t: "Cash Utilization", d: "Deploy capital with intent while keeping a ~25% reserve against settlement shocks." },
  { n: "03", t: "Decision Latency", d: "Every tick has a 3–4 second window. Decide in milliseconds, not seconds." },
  { n: "04", t: "Order Error Rate", d: "Pre-check cash, margin and holdings so INSUFFICIENT_CAPITAL and NO_SHORT_POSITION never appear." },
  { n: "05", t: "Tax & Cost Efficiency", d: "₹20 per order, 15% STCG, loss offsets. Fewer, better trades." },
];

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.15 },
    );
    document.querySelectorAll(".rv").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Landing() {
  useReveal();
  const [active, setActive] = useState("hero");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const mid = window.innerHeight / 2;
      for (const s of SECTIONS) {
        const r = document.getElementById(s.id)?.getBoundingClientRect();
        if (r && r.top <= mid && r.bottom >= mid) setActive(s.id);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen text-foreground">
      <RidgeCanvas />

      <header
        className={`fixed inset-x-0 top-0 z-30 transition-colors duration-500 ${scrolled ? "border-b border-border bg-background/60 backdrop-blur-md" : ""}`}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#hero" className="flex items-center gap-3">
            <span className="glow-dot" />
            <span className="text-sm font-medium tracking-[0.2em]">MANTHAN EDGE</span>
          </a>
          <ul className="hidden gap-8 md:flex">
            {SECTIONS.slice(1).map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={`relative pb-1 text-sm transition-colors ${active === s.id ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <Link to="/console" className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-primary hover:text-primary">
            Open console
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section id="hero" className="flex min-h-screen flex-col justify-between px-6 pb-12 pt-28">
          <div className="mx-auto w-full max-w-7xl">
            <p className="eyebrow flex items-center gap-3"><span className="glow-dot" /> MANTHAN 2026 · JNNCE Shivamogga · Autonomous Trading Systems</p>
          </div>
          <div className="mx-auto w-full max-w-7xl">
            <h1 className="display max-w-4xl text-5xl md:text-7xl lg:text-[5.5rem]" style={{ animation: "rise 1.2s var(--ease-out) both" }}>
              Where stillness<br />reveals the signal.
            </h1>
            <p className="mt-8 max-w-xl text-lg text-muted-foreground" style={{ animation: "rise 1.2s .15s var(--ease-out) both" }}>
              A bot listens to every market tick and headline, weighs risk, and places orders on its own.
              This console watches it — calmly, honestly, never pretending.
            </p>
            <div className="mt-10 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="relative h-px w-14 overflow-hidden bg-border"><i className="absolute inset-0 origin-left bg-foreground" style={{ animation: "rise 2s infinite" }} /></span>
              Scroll to enter
            </div>
          </div>
        </section>

        {/* VENUE */}
        <section id="venue" className="flex min-h-screen items-center px-6 py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-12 md:grid-cols-2">
            <div>
              <p className="eyebrow rv">I · The Venue</p>
              <h2 className="display rv mt-6 text-4xl md:text-5xl">Private Kafka, one REST gateway, a ten-lakh rupee purse.</h2>
            </div>
            <div className="rv space-y-6 self-end text-muted-foreground">
              <p>Market ticks and corporate news stream through Kafka on the venue's private Wi-Fi. Orders go through a single REST gateway — BUY, SELL, SHORT, COVER — and every team starts with exactly ₹10,00,000.</p>
              <p>One simulated day passes every 3–4 seconds. Shorts lock 100% margin and are squared off every ten trading days. Nothing about this can run in a browser tab.</p>
              <div className="flex gap-10 pt-4">
                {[["₹10L", "starting capital"], ["4s", "per trading day"], ["120", "requests / min"]].map(([v, l]) => (
                  <div key={l}><div className="num text-2xl text-foreground">{v}</div><div className="eyebrow mt-1">{l}</div></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section id="architecture" className="flex min-h-screen items-center px-6 py-24">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex items-center gap-6"><p className="eyebrow rv">II · Three pathways</p><span className="h-px flex-1 bg-border" /></div>
            <h2 className="display rv mt-6 max-w-3xl text-4xl md:text-5xl">Each part walks its own path. None depends on the others to keep trading.</h2>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {[
                ["A", "Console", "This app. Status, portfolio, orders, strategy settings, risk alerts. Read-only toward the market."],
                ["B", "Lovable Cloud", "Stores strategy settings, run summaries, decisions and order audit — never the full tick stream, never tokens."],
                ["C", "Local bot", "Runs on a laptop on venue Wi-Fi. Consumes Kafka, checks risk, sends orders. Keeps going if the cloud drops."],
              ].map(([k, t, d]) => (
                <article key={k} className="rv glass rounded-xl p-7">
                  <div className="flex items-center justify-between"><span className="num text-sm text-primary">PATH {k}</span><span className="glow-dot" /></div>
                  <h3 className="display mt-10 text-2xl">{t}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* PILLARS */}
        <section id="pillars" className="flex min-h-screen items-center px-6 py-24">
          <div className="mx-auto w-full max-w-7xl">
            <p className="eyebrow rv">III · How the jury scores</p>
            <h2 className="display rv mt-6 text-4xl md:text-5xl">Five pillars. One hour. One quiet mind.</h2>
            <ol className="mt-14 divide-y divide-border border-y border-border">
              {PILLARS.map((p) => (
                <li key={p.n} className="rv grid gap-2 py-7 md:grid-cols-[6rem_1fr_1.4fr] md:items-baseline">
                  <span className="num text-sm text-primary">{p.n}</span>
                  <h3 className="display text-2xl">{p.t}</h3>
                  <p className="text-muted-foreground">{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FINALE */}
        <section id="console" className="flex min-h-screen items-center justify-center px-6 py-24 text-center">
          <div className="max-w-2xl">
            <p className="eyebrow rv">IV · Afterlight</p>
            <h2 className="display rv mt-6 text-5xl md:text-7xl">Watch the bot.<br />Never be the bot.</h2>
            <p className="rv mx-auto mt-6 max-w-md text-muted-foreground">The console has no order button. It shows what the bot did and why — with demo data clearly marked until a real run connects.</p>
            <Link to="/console" className="rv group mt-10 inline-flex items-center gap-4 text-sm">
              Open the console
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        <footer className="border-t border-border bg-background/70 px-6 py-8 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 text-xs text-muted-foreground">
            <span>MANTHAN EDGE · MANTHAN 2026 · JNNCE CSE (Data Science)</span>
            <span>Monitoring only. No trading credentials live in this app.</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
