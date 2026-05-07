"use client";

import Link from "next/link";
import Image from "next/image";
import { isElectron } from "@/lib/utils/env";
import { Button } from "@/components/ui/button";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href={isElectron() ? "/chat" : "/"} className="flex items-center">
              <Image
                src="/rearvy-wordmark.svg"
                alt="Rearvy"
                width={160}
                height={36}
                className="h-8 w-auto dark:invert"
                priority
              />
            </Link>
            <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              Demo Mode
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/demo/chat/new">
              <Button variant="ghost" size="sm">Demo chat</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Create account</Button>
            </Link>
          </div>
        </div>
      </header>
      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
