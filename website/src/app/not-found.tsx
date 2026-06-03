"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Home, SearchX } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

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
      stats={[
        { value: "404", label: "Route status" },
        { value: "Home", label: "Public fallback" },
        { value: "Chat", label: "Workspace redirect" },
      ]}
    >
      <section className="mx-auto w-full max-w-[860px] px-6">
        <div className="rounded-xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
            Requested path
          </p>
          <code className="mt-3 block break-all rounded-xl border border-white/10 bg-white/7 p-4 font-mono text-sm text-white/72">
            {requestedPath}
          </code>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-black transition hover:bg-white/85"
            >
              <Home className="h-4 w-4" />
              Return home
            </Link>
            <Link
              href="/login?redirect=/chat"
              className="inline-flex items-center gap-2 rounded-full border border-white/35 px-6 py-3 font-semibold text-white transition hover:border-white hover:bg-white hover:text-black"
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
