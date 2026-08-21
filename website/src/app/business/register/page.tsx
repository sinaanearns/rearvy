import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Megaphone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

const businessRegisterTheme = {
  background:
    "radial-gradient(ellipse 74% 54% at 12% 8%, rgba(124, 58, 237, 0.34), transparent 62%), radial-gradient(ellipse 58% 46% at 92% 24%, rgba(14, 165, 233, 0.2), transparent 58%), linear-gradient(145deg, #120b22 0%, #070b18 48%, #04131a 100%)",
} satisfies CSSProperties;

function PlatformLaunchPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[12px] border border-white/14 bg-[#05080d]/90 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-cyan-300/[0.12] blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-72 w-72 rounded-full bg-emerald-300/[0.08] blur-[100px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent" />

      <div className="relative p-5 sm:p-6">
        <div className="max-w-xl">
            <h3 className="max-w-md text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-white">
              Connect once.
              <span className="block text-white/46">Work everywhere.</span>
            </h3>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/62">
              Create a private connector for your platform and make approved capabilities available across coordinated workflows.
            </p>
        </div>

        <Link
          href="/business/signup"
          className="group mt-4 inline-flex min-h-12 w-full items-center justify-between rounded-[9px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="Start platform setup"
        >
          <span>Start platform setup</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white transition-transform group-hover:translate-x-0.5">
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </Link>

        <div className="mt-4 flex justify-end text-xs">
          <Link href="/business/login" className="font-semibold text-white/76 transition hover:text-white">
            Already registered? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page Data ────────────────────────────────────────────────────────────────

const registrationBenefits = [
  {
    title: "Make your capabilities available to AI workflows",
    description:
      "Rearvy can select your approved capabilities when they are relevant to a user's task—without exposing your source code.",
    icon: Megaphone,
  },
  {
    title: "Private integration onboarding",
    description:
      "Describe your platform once, then receive a connector plan and sandbox workflow for approval-gated execution.",
    icon: Sparkles,
  },
  {
    title: "Verified capability and trust layer",
    description:
      "A verified connector shows its permissions, approvals, and secure execution boundary before anyone uses it.",
    icon: ShieldCheck,
  },
];

const workflowSteps = [
  {
    title: "Create your account",
    description:
      "Sign up with your email and provide the details Rearvy needs to understand your platform or business.",
  },
  {
    title: "Describe your capabilities",
    description:
      "Tell us what your website, app, or service can do. Rearvy generates an integration plan and keeps your connector private.",
  },
  {
    title: "Become available in workflows",
    description:
      "After review, your approved capabilities can be selected by users and AI plans when their task needs them.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessRegisterPage() {
  const navLinks = [
    { href: "/", label: "Home Page" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <RearvyPublicShell
      className="business-register-theme"
      style={businessRegisterTheme}
      authLinks={{
        login: "/business/login",
        signup: "/business/signup",
      }}
      navLinks={navLinks}
      title={
        <>
          Connect your platform
          <span className="block">to Rearvy&apos;s capability layer.</span>
        </>
      }
      description={
        <>
          Tell Rearvy what your website, app, or business can do. We help create a private connector,
          describe its approved capabilities, and make it available to coordinated workflows.
        </>
      }
      primaryCta={{ href: "/business/signup", label: "Create account", icon: ArrowUpRight }}
      secondaryCta={{ href: "/", label: "Users — Home", icon: ArrowUpRight }}
      sidePanel={<PlatformLaunchPanel />}
    >
      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <section
        className="relative z-10 mx-auto w-full max-w-[1500px] px-6 py-6"
        aria-label="Business registration highlights"
      >
        <div className="grid overflow-hidden rounded-[10px] border border-white/11 bg-black/25 sm:grid-cols-3">
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7de7c7]">Privacy</p>
            <p className="mt-2 text-lg font-semibold text-white">Private connector</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Your source code and credentials stay protected.</p>
          </div>
          <div className="border-b border-white/10 px-5 py-5 sm:border-b-0 sm:border-r">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#69d7ff]">Onboarding</p>
            <p className="mt-2 text-lg font-semibold text-white">Priority queue</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Accelerated setup for your website and integrations.</p>
          </div>
          <div className="px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7c948]">Verification</p>
            <p className="mt-2 text-lg font-semibold text-white">Fully verified profile</p>
            <p className="mt-1 text-sm leading-6 text-white/58">Trusted listings build user confidence in every workflow.</p>
          </div>
        </div>
      </section>

      {/* ── Registration benefits ──────────────────────────────────────────── */}
      <section
        className="relative z-10 mx-auto w-full max-w-[1500px] px-6 py-12"
        aria-labelledby="benefits-heading"
      >
        <div className="overflow-hidden rounded-[10px] border border-white/12 bg-black/25 p-5 shadow-2xl shadow-black/20 sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-center">
            <div className="max-w-xl">
              <h2
                id="benefits-heading"
                className="text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl"
              >
                Make your platform usable inside connected workflows.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/70 sm:text-lg">
                Register your platform or business so Rearvy can understand its capabilities, create a private connector,
                and make approved actions available across connected workflows.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/business/signup"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50"
                >
                  Register now
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/business/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/16 bg-white/[0.04] px-5 text-sm font-semibold text-white transition hover:border-white/32 hover:bg-white/[0.08]"
                >
                  Sign in
                </Link>
              </div>

            </div>

            <div className="grid gap-3">
              {registrationBenefits.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.title}
                    className="grid gap-4 rounded-[8px] border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[42px_minmax(0,1fr)] sm:p-5"
                  >
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

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section
        className="relative z-10 mx-auto grid w-full max-w-[1500px] gap-10 px-6 py-24 lg:grid-cols-[0.78fr_1fr] lg:items-start"
        aria-labelledby="how-it-works-heading"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#69d7ff]">How it works</p>
          <h2
            id="how-it-works-heading"
            className="mt-4 max-w-xl text-3xl font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl"
          >
            From signup to connected capability in three steps.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Registration is straightforward. Rearvy keeps your source code private and activates only the capabilities
            you approve after the connector passes review.
          </p>
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

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-[1500px] px-6 pb-10 pt-16">
        <div className="rearvy-final-band">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold leading-[1.03] tracking-[-0.035em] text-white sm:text-5xl">
              Make your platform part of connected digital work.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              Register your platform or business and let users coordinate its approved capabilities with the rest of
              their digital tools — without uploading your private source code.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link
              href="/business/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-cyan-50"
            >
              Register now
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-white/16 bg-black/20 px-5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.06]"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>

    </RearvyPublicShell>
  );
}
