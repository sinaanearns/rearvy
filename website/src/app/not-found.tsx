"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Home, LogIn, SearchX } from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";

const WORKSPACE_REDIRECT = "/chat";
const LOGIN_REDIRECT_HREF = `/login?redirect=${encodeURIComponent(WORKSPACE_REDIRECT)}`;
const LOGIN_REDIRECT_LABEL = `/login?redirect=${WORKSPACE_REDIRECT}`;

export default function NotFound() {
  const pathname = usePathname();
  const requestedPath = pathname || "/";

  return (
    <div className="min-h-screen overflow-hidden bg-[#f2f2f2] text-[#050505] selection:bg-black selection:text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-[#f2f2f2]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-4" aria-label="Rearvy home">
            <RearvyLogo
              priority
              markSize={44}
              variant="dark"
              className="text-black"
              markClassName="h-11 w-11 rounded-none border-2 border-black"
              textClassName="hidden font-poster text-[21px] uppercase tracking-[0.3em] sm:inline"
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="campaign-button campaign-button-light h-10 px-4">
              <Home size={15} />
              Home
            </Link>
            <Link href={LOGIN_REDIRECT_HREF} className="campaign-button campaign-button-dark h-10 px-4">
              <LogIn size={15} />
              Login
            </Link>
          </div>
        </div>
      </header>

      <main className="poster-grain xerox-noise relative isolate min-h-screen pt-[72px]">
        <div className="mx-auto grid min-h-[calc(100svh-72px)] max-w-[1500px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.58fr_0.42fr] lg:items-center lg:px-10 lg:py-12">
          <section className="poster-rise relative z-10 max-w-4xl">
            <div className="inline-flex h-12 w-12 items-center justify-center border-2 border-black bg-white shadow-[4px_4px_0_#050505]">
              <SearchX className="h-6 w-6" aria-hidden />
            </div>

            <p className="mt-6 text-xs font-black uppercase tracking-[0.32em] text-black/70">
              404 / Route did not resolve
            </p>

            <h1 className="mt-4 font-poster text-[48px] leading-[0.86] text-black sm:text-[74px] lg:text-[104px] xl:text-[128px]">
              <span className="block">THIS PAGE</span>
              <span className="block">DROPPED OFF</span>
              <span className="block">THE BOARD.</span>
            </h1>

            <p className="mt-7 max-w-2xl border-t-4 border-black pt-6 text-base font-black leading-7 text-black sm:text-lg">
              Rearvy could not find this route. Jump back to the public site or sign in
              through the workspace redirect.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/" className="campaign-button campaign-button-dark h-12 px-5">
                <Home size={16} />
                Return home
              </Link>
              <Link href={LOGIN_REDIRECT_HREF} className="campaign-button campaign-button-light h-12 px-5">
                <LogIn size={16} />
                Login redirect
                <ArrowUpRight size={16} />
              </Link>
            </div>

            <div className="mt-7 grid max-w-2xl gap-2 text-[10px] font-black uppercase tracking-[0.16em] sm:text-[11px]">
              <div className="flex min-h-11 flex-wrap items-center gap-2 border-2 border-black bg-white px-3 py-2 shadow-[4px_4px_0_#050505]">
                <span className="bg-black px-2 py-1 text-white">Request</span>
                <code className="break-all font-mono normal-case tracking-normal text-black/75">
                  {requestedPath}
                </code>
              </div>
              <div className="flex min-h-11 flex-wrap items-center gap-2 border-2 border-black bg-white px-3 py-2 shadow-[4px_4px_0_#050505]">
                <span className="bg-black px-2 py-1 text-white">Login redirect</span>
                <code className="break-all font-mono normal-case tracking-normal text-black/75">
                  {LOGIN_REDIRECT_LABEL}
                </code>
              </div>
            </div>
          </section>

          <aside className="poster-rise relative min-h-[340px] overflow-hidden border-2 border-black bg-white p-2 shadow-[10px_10px_0_#050505] sm:min-h-[460px] lg:min-h-[640px]">
            <div className="absolute inset-2 overflow-hidden border border-black">
              <Image
                src="/images/rearvy-product-poster.png"
                alt="Rearvy product workspace poster"
                fill
                priority
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="photocopy-image bg-black object-contain"
              />
            </div>
            <div className="halftone-field absolute inset-0 opacity-70" aria-hidden />
            <div className="scanline-field absolute inset-0" aria-hidden />
            <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between border-2 border-black bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]">
              <span>Missing route</span>
              <span>Rearvy</span>
            </div>
            <div className="absolute bottom-4 left-4 right-4 z-10 border-2 border-black bg-[#f2f2f2] px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em]">
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span className="bg-black px-2 py-1 text-white">Reroute ready</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
