"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Download,
  MonitorDown,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { isElectron } from "@/lib/utils/env";

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

const windowsDownloadUrl = getWindowsDownloadUrl();
const terminalInstallCommand = "irm 'https://www.rearvy.com/install?win32=true' | iex";

const NAV_LINKS = [
  { href: "/#product", label: "SYSTEM" },
  { href: "/#agents", label: "OPERATORS" },
  { href: "/#process", label: "METHOD" },
  { href: "/download", label: "DOWNLOAD" },
  { href: "/#pricing", label: "ACCESS" },
  { href: "/contact", label: "CONTACT" },
];

const releaseNotes = [
  "Windows 10 and Windows 11 x64 installer",
  "Opens the Rearvy workspace in a native desktop window from the local packaged bundle",
  "Includes desktop bridge access for terminal, files, clipboard, and device workflows",
  "Keeps private API keys and Firebase service credentials on the hosted backend",
];

const desktopDetails = [
  {
    title: "One installer",
    body: "The generated .exe creates Start menu and desktop shortcuts through the Windows installer flow.",
    icon: MonitorDown,
  },
  {
    title: "Server-safe",
    body: "The desktop app does not bundle .env.local, Firebase service account JSON, or AI provider keys.",
    icon: ShieldCheck,
  },
  {
    title: "Installer only",
    body: "This page ships the Windows installer only, just like a standard desktop app release.",
    icon: Download,
  },
];

export default function DownloadPage() {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f2f2f2] text-[#050505] selection:bg-black selection:text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-[#f2f2f2]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-3 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-4" aria-label="Rearvy home">
            <RearvyLogo
              priority
              markSize={44}
              variant="dark"
              className="text-black"
              markClassName="h-10 w-10 rounded-none sm:h-11 sm:w-11"
              textClassName="hidden font-poster text-[19px] uppercase tracking-[0.18em] sm:inline sm:text-[21px] sm:tracking-[0.3em]"
            />
          </Link>

          <nav className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] lg:flex xl:text-[11px] xl:tracking-[0.24em]">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="campaign-button campaign-button-light h-9 px-3 sm:h-10 sm:px-4">
              Login
            </Link>
            <a
              href={windowsDownloadUrl}
              download
              className="campaign-button campaign-button-dark h-9 px-3 sm:h-10 sm:px-4"
            >
              <Download size={15} />
              Windows
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="poster-grain xerox-noise relative isolate overflow-hidden border-b-2 border-black bg-[#f2f2f2] pt-[72px]">
          <div className="mx-auto grid min-h-[calc(88svh-72px)] max-w-[1500px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.52fr_0.48fr] lg:items-center lg:px-10 lg:py-12">
            <div className="poster-rise relative z-10 max-w-4xl">
              <div className="mb-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.2em] sm:text-[11px]">
                <span className="stamp-label">Desktop release</span>
                <span className="stamp-label">Windows x64</span>
                <span className="stamp-label">Live workspace</span>
              </div>

              <h1 className="font-poster text-[52px] leading-[0.86] text-black sm:text-[82px] lg:text-[104px] xl:text-[124px]">
                <span className="block">DOWNLOAD</span>
                <span className="block">REARVY</span>
                <span className="block">DESKTOP.</span>
              </h1>

              <div className="mt-7 grid max-w-3xl gap-6 border-t-4 border-black pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <p className="max-w-xl text-base font-black leading-7 text-black sm:text-lg">
                  Install Rearvy like a normal Windows app and open the same
                  connected workspace your team already uses in the browser.
                </p>
                <div className="flex flex-wrap gap-3 sm:flex-col">
                  <a href={windowsDownloadUrl} download className="campaign-button campaign-button-dark h-12 px-5">
                    <Download size={16} />
                    Installer
                  </a>
                  <Link href="/signup" className="campaign-button campaign-button-light h-12 px-5">
                    Start free
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid max-w-3xl border-y-2 border-black sm:grid-cols-3 sm:divide-x-2 sm:divide-black">
                <div className="border-b-2 border-black py-4 sm:border-b-0 sm:px-4">
                  <p className="font-poster text-[38px] leading-none">10/11</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/62">
                    Windows
                  </p>
                </div>
                <div className="border-b-2 border-black py-4 sm:border-b-0 sm:px-4">
                  <p className="font-poster text-[38px] leading-none">x64</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/62">
                    Installer
                  </p>
                </div>
                <div className="py-4 sm:px-4">
                  <p className="font-poster text-[38px] leading-none">LIVE</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-black/62">
                    Workspace
                  </p>
                </div>
              </div>
            </div>

            <div className="poster-rise relative min-h-[390px] overflow-hidden border-2 border-black bg-white p-2 shadow-[10px_10px_0_#050505] lg:min-h-[640px]">
              <div className="absolute inset-2 overflow-hidden border border-black bg-white">
                <Image
                  src="/images/rearvy-product-poster.png"
                  alt="Rearvy product workspace poster"
                  fill
                  priority
                  sizes="(min-width: 1024px) 48vw, 100vw"
                  className="photocopy-image bg-white object-contain"
                />
              </div>
              <div className="halftone-field absolute inset-0 opacity-70" aria-hidden />
              <div className="scanline-field absolute inset-0" aria-hidden />
              <div className="absolute left-4 top-4 z-10 border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#050505]">
                RearvyUserSetup-x64.exe
              </div>
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]">
                <span>Desktop Proof</span>
                <span>Download</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-black bg-black px-4 py-16 text-white sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-[1500px] gap-8 lg:grid-cols-[0.44fr_0.56fr]">
            <div>
              <p className="stamp-label stamp-label-invert inline-flex">
                Current release
              </p>
              <h2 className="mt-5 font-poster text-[48px] leading-[0.9] sm:text-[72px] lg:text-[88px]">
                A NATIVE WINDOW FOR LIVE REARVY WORK.
              </h2>
              <p className="mt-6 max-w-xl border-l-4 border-white pl-5 text-base font-black leading-7 text-white sm:text-lg">
                This installer gives clients and team members a simple desktop
                entry point while secure app logic continues to run from the
                hosted Rearvy backend.
              </p>
              <div className="mt-8 flex items-center gap-3 border-2 border-white bg-white px-4 py-3 font-mono text-xs font-black text-black shadow-[6px_6px_0_rgba(255,255,255,0.45)] sm:text-sm">
                <Terminal className="h-4 w-4 shrink-0" />
                <code className="overflow-x-auto whitespace-nowrap">
                  {terminalInstallCommand}
                </code>
              </div>
            </div>

            <div className="grid border-y-2 border-white">
              {releaseNotes.map((note) => (
                <div
                  key={note}
                  className="grid gap-4 border-b-2 border-white py-6 last:border-b-0 sm:grid-cols-[44px_1fr] sm:items-start"
                >
                  <Check className="mt-0.5 h-6 w-6 shrink-0" />
                  <span className="text-base font-bold leading-7 text-white/76">
                    {note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="poster-grain border-b-2 border-black bg-[#f2f2f2] px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-6 border-b-4 border-black pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="stamp-label inline-flex">Installer file</p>
                <h2 className="mt-5 font-poster text-[48px] leading-[0.92] sm:text-[76px]">
                  BUILT LIKE AN APP. CONNECTED LIKE REARVY.
                </h2>
              </div>
              <a href={windowsDownloadUrl} download className="campaign-button campaign-button-dark h-12 px-5">
                <Download size={16} />
                Download installer
              </a>
            </div>

            <div className="grid border-b-2 border-black md:grid-cols-3 md:divide-x-2 md:divide-black">
              {desktopDetails.map((detail) => {
                const Icon = detail.icon;

                return (
                  <article
                    key={detail.title}
                    className="border-b-2 border-black py-8 last:border-b-0 md:border-b-0 md:px-7"
                  >
                    <Icon size={31} strokeWidth={2} />
                    <h3 className="mt-10 font-poster text-[42px] leading-none">
                      {detail.title}
                    </h3>
                    <p className="mt-4 max-w-sm text-base font-bold leading-7 text-black/72">
                      {detail.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-black bg-[#f2f2f2] px-4 py-10 text-black sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 text-[11px] font-black uppercase tracking-[0.2em] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="font-poster text-2xl tracking-normal">REARVY</span>
            <span className="border-l-2 border-black pl-3 text-black/62">
              AI business execution platform
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
            <Link href="/download" className="hover:underline">
              Download
            </Link>
            <Link href="/privacy-policy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
