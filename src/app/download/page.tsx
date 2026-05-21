"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isElectron } from "@/lib/utils/env";
import Image from "next/image";
import Link from "next/link";
import { Check, Download, Globe, MonitorDown, ShieldCheck, Sparkles } from "lucide-react";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";

const windowsDownloadUrl = "https://github.com/mutalvita-cyber/rearvy2.0/releases/download/v0.1.2/RearvyUserSetup-x64-0.1.2.exe";

const releaseNotes = [
  "Windows 10 and Windows 11 x64 installer",
  "Opens the live Rearvy workspace in a native desktop window",
  "Keeps private API keys and Firebase service credentials on the hosted backend",
];

export default function DownloadPage() {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#05060a] text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/40 px-5 py-4 text-white backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center">
            <RearvyLogo
              priority
              markSize={36}
              className="text-white"
              markClassName="h-9 w-9"
              textClassName="text-[21px] font-extrabold"
            />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                Sign in
              </Button>
            </Link>
            <a href={windowsDownloadUrl} download>
              <Button className="bg-white text-slate-950 hover:bg-white/90">
                <Download className="h-4 w-4" />
                Windows
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[84vh] items-end overflow-hidden px-5 pb-14 pt-28 text-white sm:pb-20">
          <Image
            src="/images/dashboard_mockup.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-top opacity-40"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.15),rgba(2,6,23,0.78)_50%,rgba(2,6,23,0.96))]" />
          <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-24 bottom-14 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />

          <div className="relative z-10 mx-auto w-full max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div className="max-w-3xl space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  Desktop app for Windows
                </div>
                <div className="space-y-4">
                  <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
                    Download Rearvy
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
                    Install Rearvy in one click, sign in, and continue in the same workspace with local terminal access
                    and cloud-synced projects.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a href={windowsDownloadUrl} download>
                    <Button size="lg" className="w-full bg-white px-7 text-slate-950 hover:bg-white/90 sm:w-auto">
                      <Download className="h-4 w-4" />
                      Download Rearvy Installer
                    </Button>
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-5 text-sm text-white/70">
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-300" />
                    Windows 10/11 x64
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-300" />
                    One-time setup
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-300" />
                    Auto updates built in
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">What you get</p>
                <div className="mt-4 grid gap-3">
                  {releaseNotes.map((note) => (
                    <div key={note} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span className="text-sm text-white/85">{note}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-50">
                  First launch tip: If Windows shows SmartScreen, click More info and then Run anyway.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0a0f1d] px-5 py-14 text-white">
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-white/12 bg-white/[0.04] p-5">
              <MonitorDown className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-4 text-lg font-semibold">One installer</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                App installs like standard Windows software with desktop and Start menu shortcuts.
              </p>
            </article>
            <article className="rounded-xl border border-white/12 bg-white/[0.04] p-5">
              <ShieldCheck className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-4 text-lg font-semibold">Server-safe</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Secrets stay on the hosted backend. The desktop package does not ship your private env files.
              </p>
            </article>
            <article className="rounded-xl border border-white/12 bg-white/[0.04] p-5">
              <Globe className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-4 text-lg font-semibold">Same workspace</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Users sign in with existing accounts and continue with the same projects and data.
              </p>
            </article>
              <article className="rounded-xl border border-white/12 bg-white/[0.04] p-5">
              <Download className="h-5 w-5 text-cyan-200" />
              <h3 className="mt-4 text-lg font-semibold">Installer only</h3>
              <p className="mt-2 text-sm leading-6 text-white/70">
                The download page ships the Windows installer only, like a standard desktop app release.
              </p>
            </article>
          </div>
        </section>

        <section className="bg-[#05060a] px-5 py-14 text-white">
          <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/70 p-7 sm:p-10">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">Choose your download</p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Download the Rearvy installer</h2>
                <p className="mt-3 text-sm leading-6 text-white/75">
                  This page gives you the Windows installer directly. It creates the normal desktop entry and Start menu flow, without a second source download.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
                <a href={windowsDownloadUrl} download>
                  <Button className="w-full bg-white text-slate-950 hover:bg-white/90">
                    <Download className="h-4 w-4" />
                    Get Rearvy Installer
                  </Button>
                </a>
                <Link href="/login">
                  <Button variant="ghost" className="w-full text-white hover:bg-white/10 hover:text-white">
                    <Globe className="h-4 w-4" />
                    Open Web App
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
