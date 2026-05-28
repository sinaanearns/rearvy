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
    label: "RESEARCH",
    detail: "Explore topics, competitors, files, and market context.",
    icon: CircleDot,
  },
  {
    label: "PLAN",
    detail: "Turn scattered notes into priorities and next steps.",
    icon: Brain,
  },
  {
    label: "WRITE",
    detail: "Draft emails, briefs, content, and summaries.",
    icon: Bot,
  },
  {
    label: "AUTOMATE",
    detail: "Run desktop workflows and repetitive tasks.",
    icon: Rocket,
  },
];

const PROOF_POINTS = [
  {
    metric: "01",
    label: "Scattered context comes together",
    detail: "Collect notes, market signals, files, and ideas in one focused workspace so your next session starts with the full picture.",
  },
  {
    metric: "02",
    label: "Decisions get clearer",
    detail: "Rearvy compares options, summarizes what matters, and turns raw information into a practical next step.",
  },
  {
    metric: "03",
    label: "Outputs are ready to use",
    detail: "Shape rough thoughts into documents, messages, plans, and workflows without bouncing between disconnected tools.",
  },
];

const AGENTS = [
  {
    label: "Research Assistant",
    detail: "Gathers context, compares sources, and turns messy inputs into a clean brief you can act on.",
    icon: Zap,
  },
  {
    label: "Writing Assistant",
    detail: "Turns prompts, notes, files, and ideas into polished messages, summaries, content, and docs.",
    icon: Cpu,
  },
  {
    label: "Automation Assistant",
    detail: "Helps move repeated work forward with desktop workflows, structured tasks, and clear review points.",
    icon: ShieldCheck,
  },
];

const PROCESS = [
  "Start with a prompt, file, signal, or rough thought.",
  "Rearvy gathers the context and organizes what matters.",
  "Turn that context into drafts, plans, summaries, and workflows.",
  "Review the output, ship it, and keep working from the same place.",
];

const PRICING_PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "/mo",
    annual: "Always free",
    audience: "Basic demo usage",
    credits: "Small starter credits",
    features: ["Everything for now"],
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/mo",
    annual: "$24/mo annual",
    audience: "Solo founders and creators",
    credits: "2,000 credits/mo",
    features: [],
  },
  {
    name: "Business",
    price: "$99",
    cadence: "/mo",
    annual: "$79/mo annual",
    audience: "Serious operators",
    credits: "10,000 credits/mo",
    features: [],
  },
  {
    name: "Agency",
    price: "$249",
    cadence: "/mo",
    annual: "$199/mo annual",
    audience: "Client work",
    credits: "35,000 credits/mo",
    features: [],
  },
  {
    name: "Enterprise",
    price: "$599+",
    cadence: "/mo",
    annual: "Custom contract",
    audience: "Scaled teams",
    credits: "Custom limits",
    features: [],
  },
];

const CREDIT_PACKS = [
  { price: "$10", credits: "1,000 credits" },
  { price: "$25", credits: "3,000 credits" },
  { price: "$75", credits: "10,000 credits" },
  { price: "$250", credits: "40,000 credits" },
];

const USAGE_METERS = [
  "Basic AI message: 1 credit",
  "Data-heavy answer: 3-5 credits",
  "Deep research: 25-75 credits",
  "Agent/team run: 25-100 credits",
  "Browser/desktop automation: 50-150 credits",
  "Image generation: 50-150 credits",
  "Video generation: 500+ credits",
  "Trading monitor: daily or weekly credit burn",
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
              <h1 className="font-poster text-[48px] leading-[0.86] text-black sm:text-[76px] lg:text-[104px] xl:text-[132px]">
                <span className="block">REARVY.</span>
                <span className="block">YOUR AI</span>
                <span className="block">WORKSPACE</span>
                <span className="block">FOR GETTING</span>
                <span className="block">WORK DONE.</span>
              </h1>

              <div className="mt-7 grid max-w-2xl gap-6 border-t-4 border-black pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <p className="max-w-xl text-base font-black leading-7 text-black sm:text-lg">
                  Rearvy brings research, planning, writing, automation, and
                  execution into one focused workspace.
                </p>
                <div className="flex flex-wrap gap-3 sm:flex-col">
                  <Link href="/download" className="campaign-button campaign-button-light h-12 px-5">
                    <Download size={16} />
                    Download for Windows
                  </Link>
                  <Link href="/signup" className="campaign-button campaign-button-dark h-12 px-5">
                    Start free
                    <ArrowUpRight size={16} />
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
                  EVERYTHING YOUR NEXT MOVE NEEDS.
                </h2>
                <p className="mt-6 max-w-xl border-l-4 border-black pl-5 text-lg font-black leading-8 text-black">
                  Collect notes, market signals, files, and ideas, then let
                  Rearvy help shape them into decisions, documents, and next
                  steps.
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
                  ASSISTANTS FOR FOCUSED WORK.
                </h2>
              </div>
              <p className="max-w-2xl border-l-4 border-white pl-5 text-lg font-black leading-8 text-white">
                Rearvy helps you research faster, write cleaner, plan with more
                context, and move repeated work forward from the same desktop
                workspace.
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

        <section id="pricing" className="border-b-2 border-black bg-white px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1500px]">
            <div className="grid gap-8 border-b-4 border-black pb-8 lg:grid-cols-[0.6fr_0.4fr] lg:items-end">
              <div>
                <p className="stamp-label inline-flex">Access coming soon</p>
                <h2 className="mt-5 font-poster text-[48px] leading-[0.92] sm:text-[76px]">
                  PRICING BUILT AROUND CREDITS.
                </h2>
              </div>
              <div className="border-t-4 border-black pt-6 lg:border-l-4 lg:border-t-0 lg:pl-8 lg:pt-0">
                <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.16em]">
                  <Sparkles size={18} />
                  Subscription first, extra usage when needed
                </div>
                <p className="mt-5 text-base font-black leading-7 text-black/74">
                  Rearvy will start free, then package heavier AI, automation,
                  media, and trading workloads behind monthly credits.
                </p>
              </div>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {PRICING_PLANS.map((plan) => {
                const isFreePlan = plan.name === "Free";

                return (
                <article
                  key={plan.name}
                  className={`flex min-h-[440px] flex-col border-2 border-black bg-[#f2f2f2] p-5 shadow-[6px_6px_0_#050505] ${
                    isFreePlan
                      ? "motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-2"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-4">
                    <h3 className="font-poster text-[34px] leading-none">{plan.name}</h3>
                    {!isFreePlan && (
                      <span className="shrink-0 border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
                        Soon
                      </span>
                    )}
                  </div>

                  <div className="border-b-2 border-black py-5">
                    <div className="flex items-end gap-1">
                      <span className="font-poster text-[48px] leading-none">{plan.price}</span>
                      <span className="pb-2 text-xs font-black uppercase tracking-[0.14em] text-black/60">
                        {plan.cadence}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-black/60">
                      {plan.annual}
                    </p>
                  </div>

                  <div className="border-b-2 border-black py-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-black/56">
                      For
                    </p>
                    <p className="mt-2 min-h-12 text-base font-black leading-6">
                      {plan.audience}
                    </p>
                    <p className="mt-4 border-2 border-black bg-white px-3 py-2 text-sm font-black">
                      {plan.credits}
                    </p>
                  </div>

                  {plan.features.length > 0 && (
                    <ul className="mt-5 grid gap-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm font-bold leading-5">
                          <CheckCircle2 className="mt-0.5 shrink-0" size={16} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-6">
                    {isFreePlan ? (
                      <Link
                        href="/signup"
                        className="flex h-11 items-center justify-center border-2 border-black bg-black px-3 text-xs font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-white hover:text-black"
                      >
                        Start free
                      </Link>
                    ) : (
                      <div className="flex h-11 items-center justify-center border-2 border-black bg-black px-3 text-xs font-black uppercase tracking-[0.16em] text-white">
                        Coming soon
                      </div>
                    )}
                  </div>
                </article>
                );
              })}
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
              <div className="border-2 border-black bg-black p-6 text-white shadow-[6px_6px_0_#050505]">
                <p className="stamp-label stamp-label-invert inline-flex">Extra usage</p>
                <h3 className="mt-5 font-poster text-[44px] leading-none">
                  CREDIT PACKS.
                </h3>
                <p className="mt-5 text-base font-bold leading-7 text-white/72">
                  Power users can top up without forcing every customer into a
                  higher plan.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {CREDIT_PACKS.map((pack) => (
                    <div key={pack.price} className="border-2 border-white bg-white px-4 py-3 text-black">
                      <p className="font-poster text-[34px] leading-none">{pack.price}</p>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em]">
                        {pack.credits}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-2 border-black bg-[#f2f2f2] p-6">
                <div className="flex flex-col gap-4 border-b-2 border-black pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-black/56">
                      Usage meter
                    </p>
                    <h3 className="mt-2 font-poster text-[44px] leading-none">
                      WHAT CREDITS COVER.
                    </h3>
                  </div>
                  <div className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em]">
                    Draft rates
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {USAGE_METERS.map((meter) => (
                    <div key={meter} className="flex items-start gap-3 border-b border-black/24 pb-3 text-sm font-bold leading-6">
                      <CircleDot className="mt-1 shrink-0" size={15} />
                      <span>{meter}</span>
                    </div>
                  ))}
                </div>
              </div>
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
                BRING YOUR WORK INTO FOCUS.
              </h2>
            </div>
            <div>
              <p className="border-l-4 border-white pl-5 text-lg font-black leading-8 text-white">
                Bring your research, files, ideas, and recurring tasks. Rearvy
                turns scattered context into clear action from one AI workspace.
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
