"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isElectron } from "@/lib/utils/env";
import Image from "next/image";
import Link from "next/link";
import { Check, Download, MonitorDown, ShieldCheck, Terminal } from "lucide-react";
import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { Button } from "@/components/ui/button";

const defaultWindowsDownloadUrl =
  "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/RearvyUserSetup-x64.exe";

function getWindowsDownloadUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL?.trim();
  if (
    !configuredUrl ||
    configuredUrl.includes("github.com/mutalvita-cyber/rearvy2.0/") ||
    configuredUrl.includes("/releases/download/v0.1.0/") ||
    configuredUrl.includes("Rearvy-win-x64.exe")
  ) {
    return defaultWindowsDownloadUrl;
  }

  return configuredUrl;
}

const windowsDownloadUrl =
  getWindowsDownloadUrl();
const terminalInstallCommand = "irm 'https://www.rearvy.com/install?win32=true' | iex";

const releaseNotes = [
  "Windows 10 and Windows 11 x64 installer",
  "Opens the Rearvy workspace in a native desktop window from the local packaged bundle",
  "Includes desktop bridge access for terminal, files, clipboard, and device workflows",
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/45 px-5 py-4 text-white backdrop-blur-md">
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
        <section className="relative flex min-h-[82vh] items-end overflow-hidden px-5 pb-14 pt-28 text-white sm:pb-20">
          <Image
            src="/images/rearvy-download-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.28),rgba(2,6,23,0.72)_52%,rgba(2,6,23,0.96))]" />

          <div className="relative z-10 mx-auto w-full max-w-6xl">
            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 backdrop-blur">
                <MonitorDown className="h-4 w-4" />
                Desktop app for Windows
              </div>
              <div className="space-y-4">
                <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
                  Rearvy Desktop
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
                  Install Rearvy like a normal Windows app and open the same connected workspace your team already uses
                  in the browser.
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
              </div>
            </div>
        </section>

        <section className="border-y border-border/60 bg-background px-5 py-12">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                Current release
              </p>
              <h2 className="text-3xl font-bold tracking-tight">A native window for the live Rearvy product</h2>
              <p className="text-muted-foreground">
                This installer gives clients and team members a simple desktop entry point while the secure app logic
                continues to run from the hosted Rearvy backend.
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 font-mono text-sm">
                <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                <code className="overflow-x-auto whitespace-nowrap">{terminalInstallCommand}</code>
              </div>
            </div>

            <div className="grid gap-3">
              {releaseNotes.map((note) => (
                <div key={note} className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-sm text-muted-foreground">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-5 py-16 text-white">
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
            <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <MonitorDown className="h-5 w-5 text-white/80" />
              <h3 className="mt-4 text-lg font-semibold">One installer</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                The generated `.exe` creates Start menu and desktop shortcuts through the Windows installer flow.
              </p>
            </article>
            <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <ShieldCheck className="h-5 w-5 text-white/80" />
              <h3 className="mt-4 text-lg font-semibold">Server-safe</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                The desktop app does not bundle `.env.local`, Firebase service account JSON, or AI provider keys.
              </p>
            </article>
              <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <Download className="h-5 w-5 text-white/80" />
              <h3 className="mt-4 text-lg font-semibold">Installer only</h3>
              <p className="mt-2 text-sm leading-6 text-white/65">
                This page ships the Windows installer only, just like a standard desktop app release.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
