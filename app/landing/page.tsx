import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, KeyRound, Mic2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { RevoicingDemo } from "./revoicing-demo";

const PAGE_TITLE = "MDR — Your voice. Refined.";
const PAGE_DESCRIPTION =
  "MDR learns how you write and re-voices anything — same meaning, your sound. Clone your voice, hit every platform, and bring your own model.";

const GITHUB_REPO = "https://github.com/yoonkii/macrodoc-refinement";

// `title.absolute` opts out of the root layout's "%s | MacroDocRefinement"
// template so the marketing front door reads exactly as its headline.
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/landing",
  },
  twitter: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

/** Platform accent dots for the "Every platform" proof point. */
const PLATFORM_DOTS: ReadonlyArray<{ label: string; token: string }> = [
  { label: "LinkedIn", token: "var(--linkedin)" },
  { label: "X", token: "var(--x-twitter)" },
  { label: "Instagram", token: "var(--instagram)" },
  { label: "Substack", token: "var(--substack)" },
];

export default function LandingPage() {
  return (
    <div className="relative z-10 w-full">
      <div className="mx-auto w-full max-w-5xl px-5 md:px-8">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-start gap-6 pt-20 pb-16 md:pt-28 md:pb-24">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <span className="size-1.5 rounded-full bg-[var(--amber)]" />
            Macro Doc Refinement — Voice Twin Studio
          </span>

          <h1
            className="font-display font-bold text-[var(--text)]"
            style={{
              fontSize: "clamp(2.5rem, 7vw, 4rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Your voice. <span className="text-[var(--amber)]">Refined.</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-[var(--text-muted)]">
            MDR learns how you write and re-voices anything — same meaning, your
            sound.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--amber)] px-6 py-3 font-sans text-sm font-medium text-[#1A1816] shadow-[0_0_20px_var(--amber-dim)] transition-colors hover:bg-[var(--amber-hover)]"
          >
            Open the studio
            <ArrowRight className="size-4" />
          </Link>
        </section>

        {/* ── Centerpiece: auto-playing re-voicing demo ────────────────── */}
        <section className="pb-16 md:pb-24">
          <GlassCard innerClassName="p-6 md:p-8">
            <RevoicingDemo />
          </GlassCard>
        </section>

        {/* ── Three proof points ───────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 pb-16 md:grid-cols-3 md:pb-24">
          <GlassCard innerClassName="flex h-full flex-col gap-3 p-6">
            <div className="flex items-center gap-2">
              <Mic2 className="size-4 text-[var(--amber)]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Clone your voice
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              Paste three writing samples and MDR builds an editable voice
              profile — the tics, rhythm, and register that make your writing
              yours.
            </p>
          </GlassCard>

          <GlassCard innerClassName="flex h-full flex-col gap-3 p-6">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                {PLATFORM_DOTS.map((dot) => (
                  <span
                    key={dot.label}
                    className="size-2 rounded-full border border-[var(--border)]"
                    style={{ backgroundColor: dot.token }}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Every platform
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              LinkedIn, X, Instagram, and Substack presets — each tuned to the
              length and rhythm the platform rewards, without losing your voice.
            </p>
          </GlassCard>

          <GlassCard innerClassName="flex h-full flex-col gap-3 p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-[var(--amber)]" />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Your keys, your model
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">
              Bring your own model — OpenAI, Anthropic, Google, or xAI. Your API
              keys stay in your browser and never touch our servers.
            </p>
          </GlassCard>
        </section>
      </div>

      {/* ── Footer strip ───────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)] md:px-8">
          <span>MDR — Voice Twin Studio</span>
          <nav className="flex items-center gap-6">
            <Link href="/" className="transition-colors hover:text-[var(--text)]">
              Studio
            </Link>
            <Link
              href="/legal"
              className="transition-colors hover:text-[var(--text)]"
            >
              Legal
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[var(--text)]"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
