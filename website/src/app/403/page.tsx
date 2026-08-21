import Link from "next/link";
import {
  ArrowUpRight,
  Home,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

const recoveryRoutes: Array<{
  href: string;
  title: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    href: "/",
    title: "Home",
    detail: "Return to the public Rearvy site without exposing workspace data.",
    icon: Home,
  },
  {
    href: "/login?redirect=/chat",
    title: "Sign in",
    detail: "Use the verified account that should have access to this workspace.",
    icon: LockKeyhole,
  },
  {
    href: "/contact",
    title: "Contact",
    detail: "Ask for help if this route should be available to your account.",
    icon: MessageSquareText,
  },
];

const accessChecks = [
  {
    label: "Current route",
    value: "Workspace protected",
    detail: "Rearvy blocked the page before any private workspace data was shown.",
  },
  {
    label: "Fast recovery",
    value: "Sign in again",
    detail: "Use a verified account and reopen the chat workspace from a clean route.",
  },
  {
    label: "Public fallback",
    value: "Return home",
    detail: "Go back to the public site if you reached this page by mistake.",
  },
];

const accessReceipt = [
  { label: "Visibility", value: "Private data hidden" },
  { label: "Next step", value: "Verify account" },
  { label: "Fallback", value: "Public routes open" },
];

function ForbiddenAccessPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <ShieldCheck className="h-3.5 w-3.5" />
            Access recovery
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Reopen the workspace with the right account
          </p>
        </div>
        <span className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          403
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {accessChecks.map((item, index) => (
          <div
            key={item.label}
            className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white/58">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-sm leading-6 text-white/68">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/login?redirect=/chat"
        className="flex items-center justify-between gap-3 rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/14"
      >
        Sign in and reopen chat
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

export default function ForbiddenPage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <LockKeyhole className="h-3.5 w-3.5 text-cyan-200" />
          Access control
        </>
      }
      title={
        <>
          Access
          <span className="block">denied.</span>
        </>
      }
      description="This workspace route is protected. Return to the public site or sign in with an account that has access."
      primaryCta={{ href: "/", label: "Return home", icon: Home }}
      secondaryCta={{ href: "/login?redirect=/chat", label: "Sign in", icon: ArrowUpRight }}
      stats={[
        { value: "403", label: "Route status" },
        { value: "Private", label: "Workspace scope" },
        { value: "Auth", label: "Access required" },
      ]}
      sidePanel={<ForbiddenAccessPanel />}
    >
      <section aria-labelledby="forbidden-recovery-map-title" className="mx-auto w-full max-w-[1040px] px-6">
        <div className="grid gap-5 border-y border-white/12 bg-white/[0.04] py-6 backdrop-blur-xl lg:grid-cols-[0.68fr_1.32fr] lg:items-center">
          <div className="px-0 sm:px-2">
            <p className="text-sm font-medium text-cyan-100/76">
              Access map
            </p>
            <h2 id="forbidden-recovery-map-title" className="mt-3 max-w-md text-[clamp(1.65rem,3.2vw,2.55rem)] font-semibold leading-tight text-white">
              Recover without exposing private work.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/68">
              Rearvy blocks the private route first, then gives you clear ways to
              return, verify your account, or ask for help.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {recoveryRoutes.map((route) => {
              const Icon = route.icon;

              return (
                <Link
                  key={route.href}
                  href={route.href}
                  className="group min-w-0 rounded-[8px] border border-white/12 bg-black/24 p-4 shadow-sm shadow-black/15 transition hover:border-cyan-200/34 hover:bg-cyan-200/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-white/46">
                      {route.href}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100 transition group-hover:border-cyan-200/34 group-hover:bg-cyan-200/12">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-white">{route.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/66">{route.detail}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 w-full max-w-[860px] px-6">
        <div className="rounded-[8px] border border-white/12 bg-black/45 p-6 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Permission check failed
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                Rearvy could not verify access for this page. If this should be available,
                sign in again and reopen the workspace route.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {accessReceipt.map((item) => (
              <div
                key={item.label}
                className="rounded-[8px] border border-white/10 bg-white/[0.055] p-3"
              >
                <p className="text-xs font-medium text-white/50">{item.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
            >
              <Home className="h-4 w-4" aria-hidden />
              Return home
            </Link>
            <Link
              href="/login?redirect=/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-white/28 px-5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
            >
              Sign in
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
