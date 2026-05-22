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
  Gauge,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { isElectron } from "@/lib/utils/env";

const NAV_LINKS = [
  { href: "#product", label: "PRODUCT" },
  { href: "#agents", label: "AGENTS" },
  { href: "#process", label: "PROCESS" },
  { href: "#pricing", label: "PRICING" },
  { href: "#contact", label: "CONTACT" },
];

const CAPABILITIES = [
  {
    label: "DATA",
    detail: "Reads the business signals.",
    icon: CircleDot,
  },
  {
    label: "SIGNALS",
    detail: "Finds what can make money.",
    icon: Brain,
  },
  {
    label: "EXECUTION",
    detail: "Acts on your behalf.",
    icon: Bot,
  },
  {
    label: "GROWTH",
    detail: "Improves every loop.",
    icon: Rocket,
  },
];

const PROOF_POINTS = [
  {
    metric: "01",
    label: "Rearvy understands your operating data",
    detail: "Connect commerce, inbox, analytics, content, support, and client context so the AI sees what customers buy, ask, click, ignore, and convert.",
  },
  {
    metric: "02",
    label: "It turns signals into work",
    detail: "Rearvy prepares sales outreach, client follow-ups, content ideas, campaign moves, and execution briefs from the data it reads.",
  },
  {
    metric: "03",
    label: "It helps revenue compound",
    detail: "Instead of only reporting what happened, Rearvy keeps pushing the next move: sell, create, follow up, capture revenue, measure, and improve.",
  },
];

const AGENTS = [
  {
    label: "Sales Agent",
    detail: "Finds warm opportunities, drafts outreach, follows up with leads, and keeps client pipelines moving.",
    icon: Zap,
  },
  {
    label: "Content Agent",
    detail: "Turns customer behavior, offers, and performance data into posts, emails, campaigns, and creative angles.",
    icon: Cpu,
  },
  {
    label: "Money Agent",
    detail: "Looks for revenue leaks, growth opportunities, and high-value actions while keeping decisions visible.",
    icon: ShieldCheck,
  },
];

const PROCESS = [
  "Connect the store, inbox, analytics, content, and client systems.",
  "Rearvy maps what is happening across customers, sales, content, and demand.",
  "Agents prepare sales, content, follow-up, and revenue actions automatically.",
  "Approve the boundaries, let Rearvy execute, and learn from the results.",
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f1ea] text-[#080808] selection:bg-black selection:text-[#f4f1ea]">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/10 bg-[#f4f1ea]/88 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-4" aria-label="Rearvy home">
            <RearvyLogo
              priority
              markSize={30}
              variant="dark"
              className="text-black"
              markClassName="h-[30px] w-[30px] rounded-none"
              textClassName="font-poster text-[18px] uppercase tracking-[0.18em] sm:text-[20px] sm:tracking-[0.42em]"
            />
          </Link>

          <nav className="hidden items-center gap-9 text-[11px] font-black tracking-[0.28em] lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-b border-transparent pb-1 transition-colors hover:border-black"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="poster-motion inline-flex h-10 items-center justify-center rounded-full border border-black px-4 text-[10px] font-black uppercase tracking-[0.14em] text-black transition-transform hover:-translate-y-0.5 sm:px-5 sm:text-[11px] sm:tracking-[0.18em]"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="poster-motion inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[10px] font-black uppercase tracking-[0.14em] text-[#f4f1ea] transition-transform hover:-translate-y-0.5 sm:px-5 sm:text-[11px] sm:tracking-[0.18em]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="poster-grain relative isolate min-h-screen overflow-hidden border-b border-black/15 pt-20">
          <div className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-[1500px] grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.48fr_0.52fr] lg:items-center lg:px-10 lg:py-16">
            <div className="poster-rise relative z-10 max-w-2xl">
              <p className="mb-7 max-w-[320px] text-[10px] font-black uppercase tracking-[0.22em] text-black/70 sm:max-w-xl sm:text-[11px] sm:tracking-[0.34em]">
                <span className="block">Data in. Sales and content out.</span>
                <span className="block">AI execution for the new business vibe</span>
              </p>

              <h1 className="font-poster text-[52px] leading-[0.92] text-black sm:text-[72px] lg:text-[94px] xl:text-[116px]">
                <span className="block">AI BUSINESS</span>
                <span className="block">OPERATOR.</span>
                <span className="block">BUILT TO</span>
                <span className="block">DO THE WORK.</span>
              </h1>

              <div className="mt-8 grid max-w-xl gap-6 border-t border-black/20 pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <p className="text-base font-semibold leading-7 text-black/70 sm:text-lg">
                  Rearvy turns company data into sales, content, follow-ups,
                  and revenue-driving execution. It reads commerce, marketing,
                  inbox, and customer signals, then starts doing the growth work
                  that usually waits on a team.
                </p>
                <div className="flex gap-3 sm:flex-col">
                  <Link
                    href="/signup"
                    className="poster-motion inline-flex h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-[11px] font-black uppercase tracking-[0.18em] text-[#f4f1ea] transition-transform hover:-translate-y-0.5"
                  >
                    Start free
                    <ArrowUpRight size={15} />
                  </Link>
                  <Link
                    href="/demo"
                    className="poster-motion inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black px-6 text-[11px] font-black uppercase tracking-[0.18em] transition-transform hover:-translate-y-0.5"
                  >
                    <Play size={14} fill="currentColor" />
                    Watch demo
                  </Link>
                </div>
              </div>
            </div>

            <div className="poster-rise relative min-h-[360px] overflow-hidden lg:min-h-[700px]">
              <div className="absolute inset-0 lg:-left-28">
                <Image
                  src="/images/rearvy-impact-poster.png"
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover object-[62%_center] mix-blend-multiply lg:object-center"
                />
              </div>
              <div className="halftone-field absolute inset-0 opacity-35" aria-hidden />
            </div>
          </div>

          <div className="border-t border-black/15 bg-[#f4f1ea]/92">
            <div className="mx-auto grid max-w-[1500px] grid-cols-1 divide-y divide-black/15 px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-10">
              {CAPABILITIES.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-4 py-5 sm:px-6">
                    <Icon size={25} strokeWidth={1.7} />
                    <div>
                      <p className="text-[11px] font-black tracking-[0.22em]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm text-black/65">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="product" className="border-b border-black/15 bg-[#f4f1ea] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-10 lg:grid-cols-[0.52fr_0.48fr]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-black/60">
                  Product
                </p>
                <h2 className="mt-5 font-poster text-[48px] leading-[0.95] sm:text-[68px] lg:text-[86px]">
                  WHY BUSINESSES NEED REARVY.
                </h2>
                <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-black/65">
                  Because modern businesses do not just need reports. They need a system that understands the data, spots the next move, and executes work that brings in sales, content, and money.
                </p>
              </div>

              <div className="grid border-t border-black/20">
                {PROOF_POINTS.map((point) => (
                  <div key={point.label} className="grid gap-4 border-b border-black/20 py-6 sm:grid-cols-[112px_1fr]">
                    <div className="font-poster text-[48px] leading-none">{point.metric}</div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.18em]">
                        {point.label}
                      </h3>
                      <p className="mt-2 max-w-xl text-base leading-7 text-black/65">
                        {point.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="agents" className="poster-grain relative overflow-hidden bg-black px-4 py-20 text-[#f4f1ea] sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-10 lg:grid-cols-[0.44fr_0.56fr] lg:items-end">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-white/55">
                  Agents
                </p>
                <h2 className="mt-5 font-poster text-[52px] leading-[0.92] sm:text-[78px] lg:text-[104px]">
                  IT DOES THE WORK BEHIND THE GROWTH.
                </h2>
              </div>
              <p className="max-w-2xl text-lg font-semibold leading-8 text-white/65">
                Rearvy agents are built around outcomes, not dashboards. They
                use your business context to sell, create, follow up, brief
                clients, and keep the next money-making move visible.
              </p>
            </div>

            <div className="mt-14 grid border-y border-white/20 md:grid-cols-3 md:divide-x md:divide-white/20">
              {AGENTS.map((agent) => {
                const Icon = agent.icon;
                return (
                  <div key={agent.label} className="border-b border-white/20 p-7 last:border-b-0 md:border-b-0">
                    <Icon size={29} strokeWidth={1.6} />
                    <h3 className="mt-9 text-sm font-black uppercase tracking-[0.18em]">
                      {agent.label}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-white/62">{agent.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="process" className="bg-[#f4f1ea] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-6 border-b border-black/20 pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-black/60">
                  Process
                </p>
                <h2 className="mt-5 font-poster text-[48px] leading-[0.95] sm:text-[70px]">
                  FROM DATA TO EXECUTION.
                </h2>
              </div>
              <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em]">
                <Gauge size={18} />
                Built for repeatable revenue work
              </div>
            </div>

            <div className="grid md:grid-cols-4 md:divide-x md:divide-black/20">
              {PROCESS.map((step, index) => (
                <div key={step} className="border-b border-black/20 py-8 md:border-b-0 md:px-7">
                  <div className="font-poster text-[64px] leading-none text-black/20">
                    0{index + 1}
                  </div>
                  <p className="mt-6 max-w-xs text-lg font-black leading-7">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-black/15 bg-[#ebe5da] px-4 py-18 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.65fr_0.35fr] lg:items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-black/60">
                Pricing
              </p>
              <h2 className="mt-5 font-poster text-[48px] leading-[0.95] sm:text-[72px]">
                START WITH DATA. SCALE WITH EXECUTION.
              </h2>
            </div>
            <div className="border-l-0 border-black/20 lg:border-l lg:pl-8">
              <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em]">
                <CheckCircle2 size={18} />
                No credit card required
              </div>
              <p className="mt-5 text-base font-semibold leading-7 text-black/65">
                Use Rearvy to understand the business first, then expand into
                sales outreach, content production, client follow-ups, and
                automated growth workflows as your team is ready.
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="poster-grain relative overflow-hidden bg-black px-4 py-20 text-[#f4f1ea] sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[0.7fr_0.3fr] lg:items-end">
            <div>
              <p className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.34em] text-white/55">
                <Sparkles size={16} />
                Contact
              </p>
              <h2 className="mt-5 font-poster text-[56px] leading-[0.9] sm:text-[92px] lg:text-[132px]">
                PUT REARVY TO WORK.
              </h2>
            </div>
            <div>
              <p className="text-lg font-semibold leading-8 text-white/68">
                Bring your data, workflows, and growth goals. Rearvy turns the
                scattered operating layer into an AI operator that can recommend,
                prepare, and execute the next move on your behalf.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="poster-motion inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#f4f1ea] px-6 text-[11px] font-black uppercase tracking-[0.18em] text-black transition-transform hover:-translate-y-0.5"
                >
                  Start free
                  <ArrowUpRight size={15} />
                </Link>
                <Link
                  href="/demo"
                  className="poster-motion inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-[11px] font-black uppercase tracking-[0.18em] transition-transform hover:-translate-y-0.5"
                >
                  <Play size={14} fill="currentColor" />
                  View demo
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/15 bg-[#f4f1ea] px-4 py-10 text-black sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 text-[11px] font-black uppercase tracking-[0.22em] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-poster text-base tracking-normal">REARVY</span>
            <span className="text-black/45">AI business execution platform</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
            <Link href="/privacy" className="hover:underline">
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
