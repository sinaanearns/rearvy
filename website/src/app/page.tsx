import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Video,
  Building2,
  Megaphone,
} from "lucide-react";

import { RearvyHomeMockup } from "@/components/public/rearvy-home-mockup";

export const metadata: Metadata = {
  title: "Rearvy | The Operating Layer for Connected Digital Work",
  description:
    "Rearvy connects apps, websites, AI tools, and desktop software so anyone can turn an outcome into coordinated work.",
  keywords: [
    "universal app connectivity",
    "AI orchestration platform",
    "connected digital work",
    "desktop automation",
    "browser automation",
    "AI video editing workflow",
    "private integrations",
    "e-commerce research",
    "Shopify research",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rearvy | The operating layer for connected digital work",
    description:
      "Connect your apps, websites, AI tools, and desktop software. Describe the outcome and let Rearvy coordinate the work.",
    url: "/",
    images: [
      {
        url: "/rearvy-social.png",
        width: 1200,
        height: 800,
        alt: "Rearvy connected digital work platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rearvy | Connected digital work",
    description:
      "One layer for connecting apps, websites, AI tools, and desktop workflows.",
    images: ["/rearvy-social.png"],
  },
};

const capabilities = [
  {
    eyebrow: "CREATE",
    title: "Move from a video idea to an edit plan",
    description:
      "Start with a goal or reference. Rearvy helps structure the creative work, gather context, and prepare a clear path into your desktop editing workflow.",
    icon: Video,
    points: ["Reference and trend research", "Editing workflow planning"],
  },
  {
    eyebrow: "OPERATE",
    title: "Work in the browser and on your desktop",
    description:
      "When work needs a real interface, approval-gated workflows can open apps, navigate pages, move the mouse, click, type, and keep the work visible.",
    icon: MousePointer2,
    points: ["Desktop apps and browser tasks", "You approve sensitive actions"],
  },
  {
    eyebrow: "CONNECT",
    title: "Turn scattered information into next steps",
    description:
      "Use connected sources and independent research to bring the useful context together before you decide what to do next.",
    icon: Database,
    points: ["YouTube, Shopify, files, and more", "Research that stays in context"],
  },
];

const focusAreas = [
  {
    number: "01",
    title: "Video editing workflows",
    description:
      "Our current focus: help creators and businesses research, plan, and move video work forward in their desktop editor.",
    accent: "border-[#69d7ff]/35 bg-[#69d7ff]/10 text-[#69d7ff]",
  },
  {
    number: "02",
    title: "E-commerce intelligence",
    description:
      "Next: stronger product research, store signals, and ecommerce workflows that help teams find opportunities faster.",
    accent: "border-[#f7c948]/35 bg-[#f7c948]/10 text-[#f7c948]",
  },
  {
    number: "03",
    title: "Continual expansion",
    description:
      "Rearvy grows from these core workflows into more ways to turn information, software, and intent into useful work.",
    accent: "border-[#7de7c7]/35 bg-[#7de7c7]/10 text-[#7de7c7]",
  },
];

const workflowSteps = [
  {
    title: "Describe the outcome",
    description:
      "Tell Rearvy what you want to create, research, compare, or complete.",
  },
  {
    title: "Build the context",
    description:
      "Rearvy gathers relevant information from your tools, files, browser research, and connected sources.",
  },
  {
    title: "Approve the work",
    description:
      "Review the plan before approval-gated workflows operate across apps or browser pages.",
  },
];

const sourceLabels = ["YouTube", "Browser research", "Desktop apps", "Shopify", "Files"];

const registrationBenefits = [
  {
    title: "Promote your business directly inside AI workflows",
    description:
      "Rearvy highlights your products and services when they are relevant to a user's task — no ads or spam, just helpful context at the right moment.",
    icon: Megaphone,
  },
  {
    title: "Priority integrations and onboarding",
    description:
      "Get your tools and data sources connected first so customers can act faster with approval‑gated execution.",
    icon: Sparkles,
  },
  {
    title: "Verified profile and trust layer",
    description:
      "A verified listing shows real context, approvals, and secure execution so people can trust the actions taken.",
    icon: ShieldCheck,
  },
];

const HOME_PRODUCT_VIDEO_SRC = "/media/rearvy-overview.mp4?v=2";

export default function HomePage() {
  return (
    <main className="rearvy-homepage min-h-screen text-white selection:bg-[#69d7ff] selection:text-black">
      <header className="fixed left-0 right-0 top-0 z-40 px-3 sm:px-5">
        <div className="mx-auto mt-3 flex max-w-[1380px] flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-[10px] border border-white/10 bg-[#050706]/76 px-3 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl sm:px-4">
          <Link href="/" aria-label="Rearvy home" className="flex shrink-0 items-center gap-3">
            <Image
              src="/rearvy-logo.png"
              alt="Rearvy"
              width={34}
              height={34}
              priority
            />
            <span className="hidden text-sm font-semibold tracking-wide text-white sm:inline">
              Rearvy
            </span>
          </Link>

          <nav
            className="order-3 flex w-full items-center justify-center gap-5 border-t border-white/10 pt-2 text-sm font-medium text-white/68 md:order-none md:w-auto md:border-t-0 md:pt-0"
            aria-label="Primary navigation"
          >
            <Link href="/business/register" className="whitespace-nowrap transition hover:text-white">
              Business registration
            </Link>
            <Link href="/download" className="whitespace-nowrap transition hover:text-white">
              Download
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <Link
              href="/login"
              className="hidden rounded-[8px] px-3 py-2 text-white/76 transition hover:text-white sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-[8px] bg-white px-3 py-2 text-black transition hover:bg-cyan-50 sm:px-4"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1380px] gap-10 px-5 pb-12 pt-32 sm:px-6 sm:pt-36 lg:min-h-[860px] lg:grid-cols-[minmax(0,0.86fr)_minmax(480px,1fr)] lg:items-center lg:gap-12" aria-labelledby="hero-heading">
        <div className="rearvy-hero-copy min-w-0">
          <p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-[#69d7ff]">
            THE CONNECTED WORK LAYER
          </p>
          <h1 id="hero-heading" className="mt-4 max-w-4xl text-[clamp(3.1rem,6.2vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-white sm:text-balance">
            Connect your tools. Describe the outcome. Rearvy coordinates the work.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
            Rearvy is a universal layer for connecting apps, websites, AI tools, and desktop software. Tell it what you want done, and it finds the right connected capabilities, builds a plan, and—with your approval—coordinates the work across tools.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/business/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/16 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:border-white/32 hover:bg-white/[0.08]"
            >
              Connect your platform
            </Link>
          </div>

          <div className="mt-6 rounded-[10px] border border-white/12 bg-white/[0.06] p-4 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#69d7ff]">
              <Megaphone className="h-3.5 w-3.5" aria-hidden />
              Connect your platform to Rearvy
            </div>
            <p className="mt-2 text-sm leading-6 text-white/72">
              Tell Rearvy what your website, app, or service can do. We help create a private connector so approved capabilities can participate in user workflows.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/business/register"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50"
              >
                Start connection
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/business/register"
                className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-white/16 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/32 hover:bg-white/[0.08]"
              >
                See how it works
              </Link>
            </div>
          </div>

        </div>

        <div className="relative min-w-0">
          <div className="absolute inset-x-[6%] bottom-[9%] top-[12%] -z-10 rounded-[34px] bg-[#69d7ff]/15 blur-3xl" aria-hidden />


          <div className="mb-3 overflow-hidden rounded-[10px] border border-white/12 bg-black/30" style={{ maxWidth: "640px", width: "100%" }}>

            <video
              className="w-full h-auto block"
              style={{ maxWidth: "640px", aspectRatio: "16/9", display: "block" }}
              controls
              muted
              autoPlay
              loop
              preload="auto"
              playsInline
            >
              <source src={HOME_PRODUCT_VIDEO_SRC} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>

          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/62">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#7de7c7]" aria-hidden />
              No credit card required
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#69d7ff]" aria-hidden />
              Sensitive actions stay approval-gated
            </span>
          </div>

          <RearvyHomeMockup />
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-6" aria-label="Rearvy product highlights">
        <div className="grid overflow-hidden rounded-[10px] border border-white/11 bg-black/25 sm:grid-cols-3">
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de7c7]">Access</p>
            <p className="mt-2 text-lg font-semibold text-white">Free to start</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Start with the full product at no cost.</p>
          </div>
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#69d7ff]">Execution</p>
            <p className="mt-2 text-lg font-semibold text-white">Visible and approval-gated</p>
            <p className="mt-1 text-sm leading-6 text-white/58">You stay in control when work crosses apps.</p>
          </div>
          <div className="px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7c948]">Focus</p>
            <p className="mt-2 text-lg font-semibold text-white">Video first. Commerce next.</p>
            <p className="mt-1 text-sm leading-6 text-white/58">A practical foundation that keeps expanding.</p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-12 sm:px-6" aria-labelledby="business-registration-heading">
        <div className="overflow-hidden rounded-[10px] border border-white/12 bg-black/25 p-5 shadow-2xl shadow-black/20 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#69d7ff]/30 bg-[#69d7ff]/10 px-3 py-1 text-xs font-semibold text-[#a5f0d8]">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                <span>Business registration</span>
              </div>
              <h2 id="business-registration-heading" className="mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl">
                Make your platform usable inside connected workflows.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/70 sm:text-lg">
                Describe your platform or business, receive a private connector plan, and make approved capabilities available across Rearvy workflows.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/business/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50"
                >
                  Connect a platform
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/business/register"
                  className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/16 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:border-white/32 hover:bg-white/[0.08]"
                >
                  View connection steps
                </Link>
              </div>

            </div>

            <div className="grid gap-3">
              {registrationBenefits.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="grid gap-4 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[42px_minmax(0,1fr)] sm:p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/15 bg-black/20 text-[#69d7ff]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{item.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-white/68">{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      <section id="capabilities" className="relative z-10 mx-auto w-full max-w-[1180px] scroll-mt-28 px-5 py-20 sm:px-6" aria-labelledby="capabilities-heading">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#69d7ff]">What Rearvy does</p>
          <h2 id="capabilities-heading" className="mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl">
            One operating layer for the work you want to move forward.
          </h2>
          <p className="mt-5 text-base leading-7 text-white/68 sm:text-lg">
            Rearvy connects the planning, research, information, and software interactions behind real outcomes - without hiding the work from you.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {capabilities.map((capability) => {
            const Icon = capability.icon;

            return (
              <article key={capability.title} className="rearvy-feature-card flex min-h-[310px] flex-col transition duration-300 hover:-translate-y-1 hover:border-white/22 hover:bg-white/[0.065]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold tracking-[0.16em] text-[#69d7ff]">{capability.eyebrow}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#69d7ff]/23 bg-[#69d7ff]/10 text-[#69d7ff]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <h3 className="mt-8 max-w-sm text-2xl font-semibold leading-tight tracking-[-0.025em] text-white">
                  {capability.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-white/68">{capability.description}</p>
                <ul className="mt-auto grid gap-2 pt-7 text-xs font-medium text-white/68">
                  {capability.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#69d7ff]" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section id="focus" className="relative z-10 mx-auto w-full max-w-[1180px] scroll-mt-28 px-5 py-8 sm:px-6" aria-labelledby="focus-heading">
        <div className="overflow-hidden rounded-[10px] border border-white/12 bg-[linear-gradient(120deg,rgba(105,215,255,0.13),transparent_38%),linear-gradient(290deg,rgba(255,111,97,0.12),transparent_44%),rgba(255,255,255,0.025)] px-5 py-8 shadow-2xl shadow-black/20 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-end">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#f7c948]">Where we are focused</p>
              <h2 id="focus-heading" className="mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl">
                Begin with video editing. Expand into e-commerce.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/70 sm:text-lg">
                Rearvy is being built around workflows where better context and visible execution create immediate leverage. The roadmap starts narrow on purpose, then grows with the people using it.
              </p>
            </div>

            <div className="grid gap-3">
              {focusAreas.map((area) => (
                <article key={area.number} className="grid gap-4 rounded-[8px] border border-white/10 bg-black/20 p-4 sm:grid-cols-[48px_minmax(0,1fr)] sm:p-5">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-[8px] border text-xs font-bold ${area.accent}`}>
                    {area.number}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{area.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-white/66">{area.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto grid w-full max-w-[1180px] scroll-mt-28 gap-10 px-5 py-24 sm:px-6 lg:grid-cols-[0.78fr_1fr] lg:items-start" aria-labelledby="workflow-heading">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#69d7ff]">How it works</p>
          <h2 id="workflow-heading" className="mt-4 max-w-xl text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl">
            One connected layer, not another disconnected chatbot.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Ask for an outcome, not just an answer. Rearvy gathers the context, prepares the work, and keeps you involved at the moments that matter.
          </p>

          <div className="mt-8 flex flex-wrap gap-2" aria-label="Examples of Rearvy data sources">
            {sourceLabels.map((label) => (
              <span key={label} className="rounded-full border border-white/12 bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-white/64">
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-0">
          {workflowSteps.map((step, index) => (
            <article key={step.title} className="rearvy-workflow-row">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-1">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-10 sm:px-6">
        <div className="rearvy-final-band">
          <div className="max-w-3xl">
            <h2 className="mt-4 text-3xl font-semibold leading-[1.03] tracking-[-0.035em] text-white sm:text-5xl">
              Let your next business workflow do more than sit in a chat.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              Start with the work already in front of you: a video, a product idea, a research question, or an app that needs a careful operator.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50"
            >
              Get Rearvy free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/16 bg-black/20 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.06]"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 pb-8 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Rearvy — the operating layer for connected digital work.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/download" className="transition hover:text-white">Download</Link>
          <Link href="/business/register" className="transition hover:text-white">Connect a platform</Link>
          <Link href="/privacy-policy" className="transition hover:text-white">Privacy</Link>
          <Link href="/terms" className="transition hover:text-white">Terms</Link>
          <Link href="/contact" className="transition hover:text-white">Contact</Link>
        </div>
      </footer>
    </main>
  );
}
