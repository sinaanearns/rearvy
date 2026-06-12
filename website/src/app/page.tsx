import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Download,
  FileText,
  Globe2,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { GoogleAdSenseUnit } from "@/components/ads/google-adsense-unit";
import { RearvyHomeMockup } from "@/components/public/rearvy-home-mockup";

const productFeatures = [
  {
    title: "One assistant for business context",
    description:
      "Rearvy brings business data, conversations, files, browser research, and workspace activity into one AI thread.",
    icon: Bot,
  },
  {
    title: "Briefs, answers, and next actions",
    description:
      "Ask what changed, why it matters, and what to do next. Rearvy turns scattered business signals into a clear plan.",
    icon: FileText,
  },
  {
    title: "Execution with approval",
    description:
      "Draft Gmail replies, open web tasks, prepare reports, and move desktop work while sensitive actions stay visible.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  "Connect the business sources your team already uses.",
  "Ask Rearvy for the account view, growth brief, customer reply, or next action.",
  "Review the plan, approve the work, and keep every decision in context.",
];

const proofSignals = [
  {
    label: "Browser tasks",
    value: "Live research",
    icon: Globe2,
    accent: "text-[#69d7ff]",
  },
  {
    label: "Gmail drafts",
    value: "Review before send",
    icon: Mail,
    accent: "text-[#f7c948]",
  },
  {
    label: "Shopify context",
    value: "Store signals",
    icon: ShoppingBag,
    accent: "text-[#7de7c7]",
  },
];

export default function HomePage() {
  return (
    <main className="rearvy-homepage min-h-screen text-white selection:bg-[#69d7ff] selection:text-black">
      <header className="fixed left-0 right-0 top-0 z-40">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-5 sm:px-6">
          <Link href="/" aria-label="Rearvy home" className="flex items-center gap-3">
            <Image
              src="/rearvy-logo.png"
              alt="Rearvy"
              width={36}
              height={36}
              priority
            />
            <span className="hidden text-sm font-semibold tracking-wide text-white/88 sm:inline">
              Rearvy
            </span>
          </Link>

          <nav className="hidden items-center gap-5 text-sm font-semibold text-white/78 md:flex">
            <Link href="/download" className="transition hover:text-white">
              Download
            </Link>
            <Link href="/demo" className="transition hover:text-white">
              Demo
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-[8px] bg-white px-4 py-2 font-semibold text-black transition hover:bg-white/85"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <div className="relative z-10 mx-auto hidden w-full max-w-[1180px] px-5 pt-24 sm:block sm:px-6 sm:pt-28">
        <GoogleAdSenseUnit
          className="min-h-[90px] w-full overflow-hidden"
          slot="9982166914"
        />
      </div>

      <section className="mx-auto grid min-h-0 w-full max-w-[1440px] items-start gap-10 px-5 pb-10 pt-16 sm:px-6 sm:pt-10 lg:min-h-[84svh] lg:grid-cols-[minmax(0,0.82fr)_minmax(500px,1fr)] lg:items-center">
        <div className="rearvy-hero-copy min-w-0 w-full max-w-[calc(100vw_-_40px)] sm:max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/78 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-[#69d7ff]" aria-hidden />
            AI business assistant
          </div>

          <h1 className="mt-6 w-full max-w-[calc(100vw_-_40px)] text-[clamp(44px,7vw,96px)] font-semibold leading-[0.9] tracking-normal text-white sm:max-w-[780px] sm:text-balance">
            Rearvy turns business context into action.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/76 sm:text-lg">
            Connect store data, analytics, Gmail, files, browser research, and
            desktop work. Rearvy becomes the business assistant that prepares
            briefs, drafts next steps, and keeps execution reviewable.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/demo"
              className="inline-flex w-full max-w-[calc(100vw_-_40px)] items-center justify-center gap-2 rounded-[8px] bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/85 sm:w-auto"
            >
              Demo
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/download"
              className="inline-flex w-full max-w-[calc(100vw_-_40px)] items-center justify-center gap-2 rounded-[8px] border border-white/24 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10 sm:w-auto"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download app
            </Link>
          </div>

          <div className="mt-6 grid w-full max-w-[calc(100vw_-_40px)] grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:max-w-2xl">
            {proofSignals.map((signal) => {
              const Icon = signal.icon;

              return (
                <div
                  key={signal.label}
                  className="grid min-h-[78px] content-start gap-2 rounded-[8px] border border-white/12 bg-white/[0.055] px-2 py-3 shadow-sm shadow-black/20 backdrop-blur-xl sm:min-h-[74px] sm:grid-cols-[34px_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-3"
                >
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 sm:mx-0">
                    <Icon className={`h-4 w-4 ${signal.accent}`} aria-hidden />
                  </div>
                  <div className="min-w-0 text-center sm:text-left">
                    <p className="truncate text-[11px] font-semibold leading-4 text-white sm:text-sm">
                      {signal.label}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-medium leading-4 text-white/68 sm:text-xs">
                      {signal.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        <RearvyHomeMockup />
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {productFeatures.map((feature) => {
            const Icon = feature.icon;

            return (
              <article key={feature.title} className="rearvy-feature-card">
                <Icon className="h-6 w-6 text-[#69d7ff]" aria-hidden />
                <h2 className="mt-5 text-xl font-semibold tracking-normal text-white">
                  {feature.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-12 sm:px-6 lg:grid-cols-[0.86fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-medium text-[#69d7ff]">
            How teams use it
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            Less dashboard hopping. More decisions.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/72">
            Rearvy keeps the account, the conversation, and the next move in
            the same workspace, so your team can move faster without losing
            review control.
          </p>
        </div>

        <div className="grid gap-3">
          {workflowSteps.map((step, index) => (
            <div key={step} className="rearvy-workflow-row">
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-20 pt-8 sm:px-6">
        <div className="rearvy-final-band">
          <div>
            <p className="text-sm font-medium text-[#f7c948]">
              Built for real work
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Web assistant for the team. Desktop operator when the AI needs to work.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              Demo
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/download"
              className="inline-flex items-center justify-center rounded-[8px] border border-white/24 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              Download app
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
