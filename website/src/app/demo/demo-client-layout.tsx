"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";
import { isElectron } from "@/lib/utils/env";

export function DemoClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [homeHref, setHomeHref] = useState("/");

  useEffect(() => {
    if (isElectron()) {
      setHomeHref("/chat");
    }
  }, []);

  return (
    <div className="dark min-h-screen overflow-x-hidden bg-[#0d1117] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.16),transparent_32%),linear-gradient(315deg,rgba(105,215,255,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0d1117]/88 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 overflow-hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={homeHref} className="flex min-w-0 items-center">
              <RearvyLogo
                priority
                markSize={32}
                markClassName="h-8 w-8"
                textClassName="text-xl text-white"
              />
            </Link>
            <span className="hidden rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-xs font-semibold text-cyan-100 min-[440px]:inline-flex">
              Demo Mode
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/demo/chat/new" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-white/72 hover:bg-white/10 hover:text-white">
                Demo chat
              </Button>
            </Link>
            <Link href="/signup" className="shrink-0">
              <Button size="sm" className="rounded-[8px] bg-white px-4 font-semibold text-black hover:bg-white/85">
                <span className="hidden min-[460px]:inline">Create account</span>
                <span className="min-[460px]:hidden">Create</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <div className="relative z-10 overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </div>
    </div>
  );
}
