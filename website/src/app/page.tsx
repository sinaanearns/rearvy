"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  Brain,
  CheckCircle2,
  CircleDot,
  Cpu,
  Download,
  Gauge,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { isElectron } from "@/lib/utils/env";

const NAV_LINKS = [
  { href: "#product", label: "SYSTEM" },
  { href: "#agents", label: "OPERATORS" },
  { href: "#process", label: "METHOD" },
  { href: "/download", label: "DOWNLOAD" },
  { href: "#pricing", label: "ACCESS" },
  { href: "#contact", label: "CONTACT" },
];

const CAPABILITIES = [
  {
    label: "INGEST",
    detail: "Store, inbox, analytics, content, client context.",
    icon: CircleDot,
  },
  {
    label: "DECODE",
    detail: "Noise becomes signal. Signal becomes a next move.",
    icon: Brain,
  },
  {
    label: "EXECUTE",
    detail: "Sales, content, follow-ups, briefs, and workflows.",
    icon: Bot,
  },
  {
    label: "COMPOUND",
    detail: "Every approved action feeds the next one.",
    icon: Rocket,
  },
];

const PROOF_POINTS = [
  {
    metric: "01",
    label: "The operating layer gets exposed",
    detail: "Rearvy reads commerce, inbox, analytics, content, support, and client context so the system can see what customers buy, ask, click, ignore, and convert.",
  },
  {
    metric: "02",
    label: "Signals leave the dashboard",
    detail: "It turns live context into sales outreach, client follow-ups, content angles, campaign moves, and execution briefs your team can approve.",
  },
  {
    metric: "03",
    label: "Revenue work keeps moving",
    detail: "Instead of reporting what happened and going silent, Rearvy keeps pushing the next move: sell, create, follow up, capture revenue, measure, improve.",
  },
];

const AGENTS = [
  {
    label: "Sales Operator",
    detail: "Finds warm openings, drafts the message, follows up, and keeps client pipelines from going cold.",
    icon: Zap,
  },
  {
    label: "Content Operator",
    detail: "Turns customer behavior, offers, and performance data into posts, emails, campaigns, and creative angles.",
    icon: Cpu,
  },
  {
    label: "Revenue Operator",
    detail: "Looks for revenue leaks, growth openings, and high-value actions while keeping the decision trail visible.",
    icon: ShieldCheck,
  },
];

const PROCESS = [
  "Connect messy systems: store, inbox, analytics, content, and clients.",
  "Rearvy sorts signal from noise across sales, demand, and behavior.",
  "Operators queue the moves: outreach, content, follow-up, revenue work.",
  "Approve the boundaries, ship the work, and feed the next pass.",
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f2f2f2] text-[#050505] selection:bg-black selection:text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-[#f2f2f2]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-4" aria-label="Rearvy home">
            <RearvyLogo
              priority
              markSize={44}
              variant="dark"
              className="text-black"
              markClassName="h-11 w-11 rounded-none border-2 border-black"
              textClassName="font-poster text-[19px] uppercase tracking-[0.18em] sm:text-[21px] sm:tracking-[0.3em]"
            />
          </Link>

          <nav className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] lg:flex xl:text-[11px] xl:tracking-[0.24em]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="campaign-button campaign-button-light h-10 px-4">
              Login
            </Link>
            <Link href="/download" className="campaign-button campaign-button-dark h-10 px-4">
              Download
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="poster-grain xerox-noise relative isolate min-h-screen overflow-hidden border-b-2 border-black bg-[#f2f2f2] pt-[72px]">
          <div className="mx-auto grid min-h-[calc(100svh-72px)] max-w-[1500px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.5fr_0.5fr] lg:items-center lg:px-10 lg:py-12">
            <div className="poster-rise relative z-10 max-w-3xl">
              <div className="mb-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.2em] sm:text-[11px]">
                <span className="stamp-label">Campaign File 001</span>
                <span className="stamp-label">Signal To Work</span>
                <span className="stamp-label">Toner High</span>
              </div>

              <h1 className="font-poster text-[48px] leading-[0.86] text-black sm:text-[76px] lg:text-[104px] xl:text-[132px]">
                <span className="block">REARVY.</span>
                <span className="block">AI BUSINESS</span>
                <span className="block">OPERATOR.</span>
                <span className="block">NO WAITING</span>
                <span className="block">ROOM.</span>
              </h1>

              <div className="mt-7 grid max-w-2xl gap-6 border-t-4 border-black pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <p className="max-w-xl text-base font-black leading-7 text-black sm:text-lg">
                  Rearvy reads store, inbox, analytics, content, and client
                  context, then turns signal into executable work.
                </p>
                <div className="flex flex-wrap gap-3 sm:flex-col">
                  <Link href="/signup" className="campaign-button campaign-button-dark h-12 px-5">
                    Start free
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/download" className="campaign-button campaign-button-light h-12 px-5">
                    <Download size={16} />
                    Download
                  </Link>
                </div>
              </div>
            </div>

            <div className="poster-rise relative min-h-[360px] overflow-hidden border-2 border-black bg-white p-2 shadow-[10px_10px_0_#050505] lg:min-h-[700px]">
              <div className="absolute inset-2 overflow-hidden border border-black">
                <Image
                  src="/images/rearvy-product-poster.png"
                  alt="Rearvy product workspace poster"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="photocopy-image bg-black object-contain"
                />
              </div>
              <div className="halftone-field absolute inset-0 opacity-70" aria-hidden />
              <div className="scanline-field absolute inset-0" aria-hidden />
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <span>Photocopy Proof</span>
                <span>Rearvy</span>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-black bg-black text-white">
            <div className="mx-auto grid max-w-[1500px] grid-cols-1 divide-y-2 divide-white/45 px-4 sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-10">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex min-h-32 items-start gap-4 py-6 sm:px-6">
                    <Icon className="mt-1 shrink-0" size={27} strokeWidth={2} />
                    <div>
                      <p className="font-poster text-[28px] leading-none">
                        {item.label}
                      </p>
                      <p className="mt-3 text-sm font-bold leading-6 text-white/72">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="product" className="poster-grain relative border-b-2 border-black bg-[#f2f2f2] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-10 lg:grid-cols-[0.52fr_0.48fr]">
              <div>
                <p className="stamp-label inline-flex">System</p>
                <h2 className="mt-5 font-poster text-[48px] leading-[0.9] sm:text-[78px] lg:text-[96px]">
                  NO DASHBOARD THEATER. JUST SIGNAL AND ACTION.
                </h2>
                <p className="mt-6 max-w-xl border-l-4 border-black pl-5 text-lg font-black leading-8 text-black">
                  Rearvy is built for businesses that need movement, not another
                  place to stare at charts. It reads the operating layer, finds
                  the next useful move, and prepares the work.
                </p>
              </div>

              <div className="grid border-t-4 border-black">
                {PROOF_POINTS.map((point) => (
                  <div key={point.label} className="grid gap-4 border-b-2 border-black py-7 sm:grid-cols-[112px_1fr]">
                    <div className="font-poster text-[58px] leading-none">{point.metric}</div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.16em]">
                        {point.label}
                      </h3>
                      <p className="mt-3 max-w-xl text-base font-semibold leading-7 text-black/72">
                        {point.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="agents" className="poster-grain xerox-noise relative overflow-hidden border-b-2 border-black bg-black px-4 py-20 text-white sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-10 lg:grid-cols-[0.46fr_0.54fr] lg:items-end">
              <div>
                <p className="stamp-label stamp-label-invert inline-flex">Operators</p>
                <h2 className="mt-5 font-poster text-[52px] leading-[0.88] sm:text-[82px] lg:text-[110px]">
                  OPERATORS IN THE DARKROOM.
                </h2>
              </div>
              <p className="max-w-2xl border-l-4 border-white pl-5 text-lg font-black leading-8 text-white">
                Rearvy operators are built around outcomes, not dashboards.
                They sell, create, follow up, brief clients, and keep the next
                money-making move visible.
              </p>
            </div>

            <div className="mt-14 grid border-y-2 border-white md:grid-cols-3 md:divide-x-2 md:divide-white">
              {AGENTS.map((agent) => {
                const Icon = agent.icon;
                return (
                  <div key={agent.label} className="border-b-2 border-white p-7 last:border-b-0 md:border-b-0">
                    <Icon size={31} strokeWidth={2} />
                    <h3 className="mt-10 font-poster text-[36px] leading-none">
                      {agent.label}
                    </h3>
                    <p className="mt-4 text-base font-semibold leading-7 text-white/72">
                      {agent.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="process" className="border-b-2 border-black bg-[#f2f2f2] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-6 border-b-4 border-black pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="stamp-label inline-flex">Method</p>
                <h2 className="mt-5 font-poster text-[48px] leading-[0.92] sm:text-[76px]">
                  THE METHOD IS BLUNT.
                </h2>
              </div>
              <div className="flex max-w-md items-center gap-3 border-2 border-black bg-white px-4 py-3 text-sm font-black uppercase tracking-[0.16em] shadow-[6px_6px_0_#050505]">
                <Gauge className="shrink-0" size={18} />
                Built for repeatable revenue work
              </div>
            </div>

            <div className="grid border-b-2 border-black md:grid-cols-4 md:divide-x-2 md:divide-black">
              {PROCESS.map((step, index) => (
                <div key={step} className="border-b-2 border-black py-8 last:border-b-0 md:border-b-0 md:px-7">
                  <div className="font-poster text-[72px] leading-none text-black">
                    0{index + 1}
                  </div>
                  <p className="mt-7 max-w-xs text-lg font-black leading-7">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-b-2 border-black bg-white px-4 py-20 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.65fr_0.35fr] lg:items-center">
            <div>
              <p className="stamp-label inline-flex">Access</p>
              <h2 className="mt-5 font-poster text-[48px] leading-[0.92] sm:text-[76px]">
                ACCESS STARTS FREE.
              </h2>
            </div>
            <div className="border-t-4 border-black pt-6 lg:border-l-4 lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.16em]">
                <CheckCircle2 size={18} />
                No credit card required
              </div>
              <p className="mt-5 text-base font-black leading-7 text-black/74">
                Start with the signal layer. Expand into sales outreach,
                content production, client follow-ups, and automated growth
                workflows when the boundaries are ready.
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="poster-grain xerox-noise relative overflow-hidden bg-black px-4 py-20 text-white sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[0.68fr_0.32fr] lg:items-end">
            <div>
              <p className="stamp-label stamp-label-invert inline-flex items-center gap-3">
                <Sparkles size={16} />
                Contact
              </p>
              <h2 className="mt-5 font-poster text-[56px] leading-[0.86] sm:text-[96px] lg:text-[138px]">
                PUT REARVY ON SHIFT.
              </h2>
            </div>
            <div>
              <p className="border-l-4 border-white pl-5 text-lg font-black leading-8 text-white">
                Bring your data, workflows, and growth goals. Rearvy turns the
                scattered operating layer into an AI operator that can
                recommend, prepare, and execute the next move.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="campaign-button campaign-button-invert h-12 px-5">
                  Start free
                  <ArrowUpRight size={16} />
                </Link>
                <Link href="/download" className="campaign-button campaign-button-outline-invert h-12 px-5">
                  <Download size={16} />
                  Download
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-black bg-[#f2f2f2] px-4 py-10 text-black sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 text-[11px] font-black uppercase tracking-[0.2em] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-poster text-2xl tracking-normal">REARVY</span>
            <span className="border-l-2 border-black pl-3 text-black/62">
              AI business execution platform
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
            <Link href="/download" className="hover:underline">
              Download
            </Link>
            <Link href="/privacy-policy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
