import { useEffect, useRef } from "react";

// Kage's layered-landscape backdrop, re-imagined as stacked price ridges under
// a glowing "signal moon". Redraws only on scroll/resize (no constant loop) to
// stay light on hackathon laptops.

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function ridge(seed: number, n: number, vol: number) {
  const r = seeded(seed);
  const pts: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    v += (r() - 0.5) * vol;
    v *= 0.96;
    pts.push(v);
  }
  return pts;
}

const LAYERS = [
  { seed: 11, vol: 0.06, base: 0.52, alpha: 0.18, speed: 0.05 },
  { seed: 29, vol: 0.08, base: 0.62, alpha: 0.32, speed: 0.12 },
  { seed: 47, vol: 0.1, base: 0.73, alpha: 0.55, speed: 0.22 },
  { seed: 83, vol: 0.12, base: 0.86, alpha: 0.9, speed: 0.35 },
].map((l) => ({ ...l, pts: ridge(l.seed, 140, l.vol) }));

export function RidgeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary").trim();
    const cyan = css.getPropertyValue("--cyan").trim();
    const ink = css.getPropertyValue("--ink").trim();
    let raf = 0;

    const draw = () => {
      raf = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const p = Math.min(1, window.scrollY / (document.body.scrollHeight - h || 1));
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, w, h);

      // signal moon
      const mx = w * (0.68 - p * 0.2);
      const my = h * (0.3 + p * 0.25);
      const mr = Math.min(w, h) * 0.13;
      const g = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3.2);
      g.addColorStop(0, `color-mix(in oklab, ${primary} 55%, transparent)`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = `color-mix(in oklab, ${primary} 70%, ${cyan})`;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;

      for (const l of LAYERS) {
        const off = p * l.speed * w;
        const step = (w + l.speed * w) / (l.pts.length - 1);
        ctx.beginPath();
        ctx.moveTo(-off, h);
        l.pts.forEach((v, i) => ctx.lineTo(i * step - off, h * (l.base + v - p * l.speed * 0.15)));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = `color-mix(in oklab, ${ink} ${100 - l.alpha * 30}%, ${primary})`;
        ctx.fill();
        ctx.strokeStyle = `color-mix(in oklab, ${cyan} ${l.alpha * 60}%, transparent)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 grid-bg opacity-60" />
    </>
  );
}
