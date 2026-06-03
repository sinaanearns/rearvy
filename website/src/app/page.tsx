import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Download,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { RearvyHomeMockup } from "@/components/public/rearvy-home-mockup";

const productFeatures = [
  {
    title: "One place for client context",
    description:
      "Rearvy brings data, conversations, files, browser research, and workspace activity into one AI thread.",
    icon: Bot,
  },
  {
    title: "Client reviews before the meeting",
    description:
      "Ask what changed, why it matters, and what to do next. Rearvy turns scattered signals into a clear brief.",
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
  "Connect the client sources your agency already uses.",
  "Ask Rearvy for the account view, campaign brief, or next action.",
  "Review the plan, approve the work, and keep every decision in context.",
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

          <nav className="hidden items-center gap-5 text-sm font-semibold text-white/72 md:flex">
            <Link href="/features" className="transition hover:text-white">
              Features
            </Link>
            <Link href="/download" className="transition hover:text-white">
              Download
            </Link>
            <Link href="/security" className="transition hover:text-white">
              Security
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-4 py-2 text-black transition hover:bg-white/85"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[84svh] w-full max-w-[1440px] items-center gap-10 px-5 pb-10 pt-24 sm:px-6 sm:pt-28 lg:grid-cols-[minmax(0,0.82fr)_minmax(500px,1fr)]">
        <div className="rearvy-hero-copy min-w-0 sm:max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/64 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-[#69d7ff]" aria-hidden />
            AI workspace for growth agencies
          </div>

          <h1 className="mt-6 max-w-[780px] text-balance text-[clamp(44px,7.6vw,112px)] font-semibold leading-[0.9] tracking-normal text-white">
            Rearvy runs client work from one command center.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            Connect client data, research, Gmail, files, and desktop work.
            Rearvy turns the mess into briefs, next actions, and approved
            execution your agency can trust.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/signup"
              className="inline-flex w-full max-w-[calc(100vw-40px)] items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/85 sm:w-auto"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/download"
              className="inline-flex w-full max-w-[calc(100vw-40px)] items-center justify-center gap-2 rounded-full border border-white/24 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10 sm:w-auto"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download app
            </Link>
          </div>

          <div className="mt-7 hidden max-w-2xl grid-cols-3 gap-2 sm:mt-9 sm:grid sm:gap-3">
            {["Client context", "AI briefs", "Approved actions"].map((item) => (
              <div key={item} className="rearvy-proof-pill">
                {item}
              </div>
            ))}
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
                <p className="mt-3 text-sm leading-6 text-white/62">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-12 sm:px-6 lg:grid-cols-[0.86fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#69d7ff]">
            How agencies use it
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal text-white sm:text-5xl">
            Less dashboard hopping. More decisions.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/62">
            Rearvy keeps the client account, the conversation, and the next move
            in the same workspace, so your team can move faster without losing
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f7c948]">
              Built for real work
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-5xl">
              Web app for the team. Desktop app when the AI needs to operate.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/85"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center justify-center rounded-full border border-white/24 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10"
            >
              See features
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
