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
  title: "Rearvy | Free & Open-Source AI Business OS — Better than ChatGPT & Claude",
  description:
    "Rearvy is a 100% free, open-source AI Business Operating System built publicly by YouTuber sinaanearns. Connect your apps, automate workflows, earn autonomously, and register your business — no subscriptions, no lock-in.",
  keywords: [
    "open source AI assistant",
    "free ChatGPT alternative",
    "free Claude alternative",
    "AI business operating system",
    "sinaanearns",
    "universal app connectivity",
    "AI orchestration platform",
    "connected digital work",
    "desktop automation",
    "browser automation",
    "AI video editing workflow",
    "private integrations",
    "e-commerce research",
    "Shopify research",
    "autonomous money making AI",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Rearvy | Free & Open-Source AI OS — Better than ChatGPT & Claude",
    description:
      "100% free and open-source. Built publicly by sinaanearns. Connect apps, automate business workflows, earn autonomously — and register your business so users find you inside Rearvy.",
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
    title: "Rearvy | Free Open-Source AI OS by sinaanearns",
    description:
      "100% free alternative to ChatGPT & Claude. Open-source AI Business OS built publicly by sinaanearns. Automate work, earn autonomously, register your business.",
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
            <a
              href="https://github.com/sinaanearns/rearvy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[8px] border border-white/14 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white transition hover:border-white/28 hover:bg-white/[0.12]"
              aria-label="Rearvy on GitHub"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4.5 w-4.5 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
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
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7de7c7]/35 bg-[#7de7c7]/10 px-3 py-1 text-xs font-semibold text-[#7de7c7]">
              <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
              Open Source
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f7c948]/35 bg-[#f7c948]/10 px-3 py-1 text-xs font-semibold text-[#f7c948]">
              100% Free — No Subscriptions
            </span>
            <a
              href="https://www.youtube.com/@sinaan_earns"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/72 transition hover:text-white"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-[#ff4444]" xmlns="http://www.w3.org/2000/svg"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
              by sinaanearns
            </a>
          </div>
          <h1 id="hero-heading" className="mt-4 max-w-4xl text-[clamp(3.1rem,6.2vw,6.4rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-white sm:text-balance">
            Connect your tools. Describe the outcome. Rearvy coordinates the work.
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
            Rearvy is a <strong className="text-white font-semibold">100% free, open-source</strong> AI Business Operating System — a public alternative to ChatGPT and Claude that actually <em>executes work</em>. Built by <a href="https://www.youtube.com/@sinaan_earns" target="_blank" rel="noopener noreferrer" className="text-[#69d7ff] underline underline-offset-2 hover:text-white transition">sinaanearns</a> on YouTube. Connect your apps, automate operations, earn autonomously, and register your business so users discover you inside Rearvy.
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
            <a
              href="https://github.com/sinaanearns/rearvy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/16 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:border-white/32 hover:bg-white/[0.08]"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-4.5 w-4.5 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              Star on GitHub
            </a>
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
              100% free — always
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#69d7ff]" aria-hidden />
              Sensitive actions stay approval-gated
            </span>
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-white/62" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
              Open-source on GitHub
            </span>
          </div>

          <RearvyHomeMockup />
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-6 sm:px-6" aria-label="Rearvy product highlights">
        <div className="grid overflow-hidden rounded-[10px] border border-white/11 bg-black/25 sm:grid-cols-4">
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de7c7]">Access</p>
            <p className="mt-2 text-lg font-semibold text-white">100% Free — forever</p>
            <p className="mt-1 text-sm leading-6 text-white/58">No subscriptions, no paywalls. Ever.</p>
          </div>
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#69d7ff]">Source</p>
            <p className="mt-2 text-lg font-semibold text-white">Fully open-source</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Built publicly by sinaanearns on YouTube.</p>
          </div>
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7c948]">Vs. ChatGPT &amp; Claude</p>
            <p className="mt-2 text-lg font-semibold text-white">Executes, not just answers</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Rearvy operates across apps with your approval.</p>
          </div>
          <div className="px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a5f0d8]">Earn</p>
            <p className="mt-2 text-lg font-semibold text-white">Autonomous earning</p>
            <p className="mt-1 text-sm leading-6 text-white/58">AI that can make money on your behalf.</p>
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
            Not just answers — actual execution. That&apos;s what separates Rearvy from ChatGPT and Claude.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            ChatGPT and Claude give you text. Rearvy gives you outcomes. It gathers context, prepares a plan, operates across your tools with your approval, and can even earn autonomously on your behalf — all for free.
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

      {/* Community / Discussions CTA */}
      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-6" aria-labelledby="community-heading">
        <div className="overflow-hidden rounded-[10px] border border-[#7de7c7]/20 bg-[linear-gradient(120deg,rgba(125,231,199,0.10),transparent_50%),rgba(255,255,255,0.025)] px-5 py-8 shadow-2xl shadow-black/20 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#7de7c7]">Open-source community</p>
              <h2 id="community-heading" className="mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-4xl">
                Have an idea? Share it publicly.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/70">
                Rearvy is built in public by <a href="https://www.youtube.com/@sinaan_earns" target="_blank" rel="noopener noreferrer" className="text-[#7de7c7] underline underline-offset-2 hover:text-white transition">sinaanearns</a> on YouTube. If you have a feature request, a business idea, or feedback on how Rearvy can replace ChatGPT or Claude for your workflow — post it in our GitHub Discussions. Every idea is read.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <a
                href="https://github.com/sinaanearns/rearvy/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50"
              >
                <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-black" xmlns="http://www.w3.org/2000/svg"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
                Post an idea
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <a
                href="https://www.youtube.com/@sinaan_earns"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/16 bg-black/20 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.06]"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-[#ff4444]" xmlns="http://www.w3.org/2000/svg"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
                Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-10 sm:px-6">
        <div className="rearvy-final-band">
          <div className="max-w-3xl">
            <h2 className="mt-4 text-3xl font-semibold leading-[1.03] tracking-[-0.035em] text-white sm:text-5xl">
              The free alternative to ChatGPT and Claude — for real business work.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              Register your business, connect your platform, and let Rearvy surface your app or website inside AI workflows. 100% free. Open-source. Built by the community.
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
              href="/business/register"
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/16 bg-black/20 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.06]"
            >
              Register your business
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 pb-8 pt-6 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>Rearvy — free &amp; open-source AI Business OS by <a href="https://www.youtube.com/@sinaan_earns" target="_blank" rel="noopener noreferrer" className="text-white/70 underline underline-offset-2 hover:text-white transition">sinaanearns</a>.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/download" className="transition hover:text-white">Download</Link>
          <Link href="/business/register" className="transition hover:text-white">Register business</Link>
          <a
            href="https://github.com/sinaanearns/rearvy"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            GitHub
          </a>
          <a
            href="https://github.com/sinaanearns/rearvy/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            Discussions
          </a>
          <a
            href="https://www.youtube.com/@sinaan_earns"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            YouTube
          </a>
          <Link href="/privacy-policy" className="transition hover:text-white">Privacy</Link>
          <Link href="/terms" className="transition hover:text-white">Terms</Link>
          <Link href="/contact" className="transition hover:text-white">Contact</Link>
        </div>
      </footer>
    </main>
  );
}
