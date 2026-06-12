"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Download,
  MessageSquareText,
  Monitor,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";
import { isElectron } from "@/lib/utils/env";

const DEMO_NAV_ITEMS = [
  {
    href: "/demo/chat/new",
    label: "Chat demo",
    description: "Ask Rearvy",
    icon: MessageSquareText,
  },
  {
    href: "/demo/trading-opinion",
    label: "Trading demo",
    description: "Monitor preview",
    icon: TrendingUp,
  },
];

const DEMO_STATUS_ITEMS = [
  {
    label: "Mode",
    value: "Sample data",
    icon: ShieldCheck,
  },
  {
    label: "Runtime",
    value: "Web + desktop",
    icon: Monitor,
  },
] as const;

export function DemoClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [homeHref, setHomeHref] = useState("/");
  const pathname = usePathname();

  useEffect(() => {
    if (isElectron()) {
      setHomeHref("/chat");
    }
  }, []);

  return (
    <div className="dark min-h-screen overflow-x-hidden bg-[#030506] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(118deg,rgba(105,215,255,0.18),transparent_34%),linear-gradient(246deg,rgba(125,231,199,0.13),transparent_38%),linear-gradient(180deg,rgba(3,5,6,0.1),rgba(3,5,6,0.92)_82%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0_1px,transparent_1px_78px),repeating-linear-gradient(0deg,rgba(255,255,255,0.026)_0_1px,transparent_1px_78px)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/75 to-emerald-200/0" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#030506]/88 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 overflow-hidden">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={homeHref} className="flex min-w-0 items-center">
              <RearvyLogo
                priority
                markSize={32}
                markClassName="h-8 w-8"
                textClassName="text-xl text-white"
              />
            </Link>
            <div className="hidden min-w-0 border-l border-white/12 pl-4 sm:block">
              <p className="text-xs font-semibold uppercase text-cyan-100/78">
                Demo Mode
              </p>
              <p className="truncate text-xs text-white/58">
                Safe preview with sample workflows
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/download"
              className="hidden min-h-9 items-center justify-center gap-2 rounded-[8px] border border-white/14 bg-white/[0.04] px-3 text-sm font-semibold text-white/78 transition hover:border-white/28 hover:bg-white/[0.08] hover:text-white md:inline-flex"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download
            </Link>
            <Link href="/signup" className="shrink-0">
              <Button size="sm" className="rounded-[8px] bg-white px-4 font-semibold text-black hover:bg-white/85">
                <span className="hidden min-[380px]:inline">Create account</span>
                <span className="min-[380px]:hidden">Create</span>
                <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label="Demo sections"
        className="relative z-10 border-b border-white/10 bg-[#030506]/74 px-3 py-3 backdrop-blur-xl sm:px-6"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid grid-cols-2 gap-2 md:flex md:overflow-x-auto md:pb-0.5">
            {DEMO_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`grid min-h-14 min-w-0 grid-cols-[32px_minmax(0,1fr)] items-center gap-2 rounded-[8px] border px-2.5 text-left transition-colors md:min-w-[188px] md:shrink-0 md:grid-cols-[36px_minmax(0,1fr)] md:gap-3 md:px-3 lg:min-w-[220px] ${
                    isActive
                      ? "border-cyan-200/34 bg-cyan-200/14 text-white shadow-sm shadow-cyan-950/20"
                      : "border-white/10 bg-white/[0.045] text-white/70 hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-[8px] border ${
                      isActive
                        ? "border-cyan-200/28 bg-cyan-200/14 text-cyan-100"
                        : "border-white/10 bg-black/16 text-white/58"
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium text-white/58">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="hidden grid-cols-2 gap-2 xl:grid">
            {DEMO_STATUS_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="grid min-h-14 w-[172px] grid-cols-[32px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.045] px-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-white/10 bg-black/18 text-emerald-100">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-white/52">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-semibold text-white/82">
                      {item.value}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="relative z-10 overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
