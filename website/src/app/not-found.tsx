"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Download,
  Home,
  MessageSquareText,
  SearchX,
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
    detail: "Return to the public Rearvy site and choose the next surface.",
    icon: Home,
  },
  {
    href: "/download",
    title: "Download",
    detail: "Install the desktop app or reopen the Windows release page.",
    icon: Download,
  },
  {
    href: "/contact",
    title: "Contact",
    detail: "Tell the Rearvy team what route you were trying to reach.",
    icon: MessageSquareText,
  },
];

function NotFoundRecoveryPanel({ requestedPath }: { requestedPath: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/70 to-emerald-200/0" />
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
            <SearchX className="h-3.5 w-3.5" />
            Route recovery
          </div>
          <p className="mt-2 text-xl font-semibold leading-tight text-white">
            Get back to a working Rearvy surface
          </p>
        </div>
        <span className="rounded-[8px] border border-amber-200/18 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
          404
        </span>
      </div>

      <div className="grid gap-3 py-4">
        {[
          {
            label: "Requested",
            value: requestedPath,
            icon: SearchX,
          },
          {
            label: "Public site",
            value: "Return home for download, security, and contact.",
            icon: Home,
          },
          {
            label: "Workspace",
            value: "Sign in and reopen the chat workspace from a clean route.",
            icon: ArrowUpRight,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.label} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/58">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-white/78">{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/"
        className="block rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-200/14"
      >
        Return to Rearvy home
      </Link>
    </div>
  );
}

export default function NotFound() {
  const pathname = usePathname();
  const requestedPath = pathname || "/";

  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <SearchX className="h-3.5 w-3.5 text-cyan-200" />
          404
        </>
      }
      title={
        <>
          This page
          <span className="block">dropped off</span>
          <span className="block">the board.</span>
        </>
      }
      description="Rearvy could not find this route. Jump back to the public site or sign in through the workspace redirect."
      primaryCta={{ href: "/", label: "Return home", icon: Home }}
      secondaryCta={{ href: "/login?redirect=/chat", label: "Sign in", icon: ArrowUpRight }}
      sidePanel={<NotFoundRecoveryPanel requestedPath={requestedPath} />}
      stats={[
        { value: "404", label: "Route status" },
        { value: "Home", label: "Public fallback" },
        { value: "Chat", label: "Workspace redirect" },
      ]}
    >
      <section aria-labelledby="not-found-route-map-title" className="mx-auto w-full max-w-[1040px] px-6">
        <div className="grid gap-5 border-y border-white/12 bg-white/[0.04] py-6 backdrop-blur-xl lg:grid-cols-[0.68fr_1.32fr] lg:items-center">
          <div className="px-0 sm:px-2">
            <p className="text-sm font-medium text-amber-100/76">
              Recovery map
            </p>
            <h2 id="not-found-route-map-title" className="mt-3 max-w-md text-[clamp(1.65rem,3.2vw,2.55rem)] font-semibold leading-tight text-white">
              Pick a known route and keep moving.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/68">
              This page keeps the missing path visible while giving visitors a few
              reliable routes back into Rearvy.
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
          <p className="text-xs font-medium text-white/54">
            Requested path
          </p>
          <code className="mt-3 block break-all rounded-[8px] border border-white/10 bg-white/7 p-4 font-mono text-sm text-white/72">
            {requestedPath}
          </code>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[8px] bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/85"
            >
              <Home className="h-4 w-4" aria-hidden />
              Return home
            </Link>
            <Link
              href="/login?redirect=/chat"
              className="inline-flex items-center gap-2 rounded-[8px] border border-white/35 px-6 py-3 font-semibold text-white transition hover:border-white/50 hover:bg-white/10"
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
