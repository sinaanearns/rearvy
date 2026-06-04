"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Home, SearchX } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

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
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white/48">
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
      <section className="mx-auto w-full max-w-[860px] px-6">
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
              <Home className="h-4 w-4" />
              Return home
            </Link>
            <Link
              href="/login?redirect=/chat"
              className="inline-flex items-center gap-2 rounded-[8px] border border-white/35 px-6 py-3 font-semibold text-white transition hover:border-white/50 hover:bg-white/10"
            >
              Sign in
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
