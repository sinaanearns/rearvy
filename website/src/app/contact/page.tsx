import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock3, Download, Mail, Sparkles, ShieldCheck } from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";

export const metadata: Metadata = {
  title: "Contact Rearvy | Rearvy",
  description:
    "Contact Rearvy for product questions, business access, partnerships, or support.",
};

const CONTACT_EMAIL = "myrearvy@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Rearvy contact"
)}&body=${encodeURIComponent(
  "Hi Rearvy team,\n\nI wanted to get in touch about...\n"
)};

const contactReasons = [
  {
    title: "Product questions",
    detail: "Ask about the platform, features, pricing, or how Rearvy fits your workflow.",
  },
  {
    title: "Business access",
    detail: "If you want free Pro access, include your business name and how you plan to use Rearvy.",
  },
  {
    title: "Partnerships and support",
    detail: "Send partnership ideas, media requests, or support details with any useful links or screenshots.",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f2f2f2] text-[#050505] selection:bg-black selection:text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-black bg-[#f2f2f2]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-4" aria-label="Rearvy home">
            <RearvyLogo
              priority
              markSize={44}
              variant="dark"
              className="text-black"
              markClassName="h-11 w-11 rounded-none border-2 border-black"
              textClassName="font-poster text-[19px] uppercase tracking-[0.18em] sm:text-[21px] sm:tracking-[0.3em]"
            />
          </Link>

          <nav className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] lg:flex xl:text-[11px] xl:tracking-[0.24em]">
            <Link
              href="/"
              className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
            >
              Home
            </Link>
            <Link
              href="/download"
              className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
            >
              Download
            </Link>
            <Link
              href="/privacy-policy"
              className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="border-2 border-transparent px-3 py-2 transition-colors hover:border-black hover:bg-black hover:text-white"
            >
              Terms
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="campaign-button campaign-button-light h-10 px-4">
              Login
            </Link>
            <Link href="/download" className="campaign-button campaign-button-dark h-10 px-4">
              Download
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="poster-grain xerox-noise relative isolate overflow-hidden border-b-2 border-black bg-[#f2f2f2] pt-[72px]">
          <div className="mx-auto grid min-h-[calc(100svh-72px)] max-w-[1500px] grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.58fr_0.42fr] lg:items-center lg:px-10 lg:py-12">
            <div className="poster-rise relative z-10 max-w-4xl">
              <p className="stamp-label inline-flex items-center gap-3">
                <Sparkles size={16} />
                Contact
              </p>

              <h1 className="mt-5 font-poster text-[52px] leading-[0.86] text-black sm:text-[84px] lg:text-[108px] xl:text-[132px]">
                <span className="block">LET&apos;S TALK</span>
                <span className="block">ABOUT YOUR</span>
                <span className="block">REARVY WORKFLOW.</span>
              </h1>

              <div className="mt-7 grid max-w-3xl gap-6 border-t-4 border-black pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
                <p className="max-w-2xl text-base font-black leading-7 text-black sm:text-lg">
                  Reach the Rearvy team for product questions, business access,
                  partnerships, or support. If you want free Pro access, include
                  your business name and how you plan to use the platform.
                </p>
                <div className="flex flex-wrap gap-3 sm:flex-col">
                  <a href={CONTACT_MAILTO} className="campaign-button campaign-button-dark h-12 px-5">
                    <Mail size={16} />
                    Email us
                  </a>
                  <Link href="/signup" className="campaign-button campaign-button-light h-12 px-5">
                    Start free
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {contactReasons.map((reason) => (
                  <div key={reason.title} className="border-2 border-black bg-white p-4 shadow-[6px_6px_0_#050505]">
                    <p className="font-poster text-[24px] leading-none">{reason.title}</p>
                    <p className="mt-3 text-sm font-black leading-6 text-black/80">
                      {reason.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="poster-rise relative overflow-hidden border-2 border-black bg-black p-2 text-white shadow-[10px_10px_0_#050505]">
              <div className="absolute inset-2 border border-white/20" aria-hidden />
              <div className="relative flex h-full min-h-[420px] flex-col justify-between border border-white/20 p-6 sm:min-h-[560px] lg:min-h-[700px]">
                <div>
                  <p className="stamp-label stamp-label-invert inline-flex">Direct contact</p>
                  <div className="mt-6 space-y-4">
                    <div className="border-l-4 border-white pl-5">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                        Email
                      </p>
                      <a href={CONTACT_MAILTO} className="mt-2 block break-all text-2xl font-poster leading-none sm:text-4xl">
                        {CONTACT_EMAIL}
                      </a>
                    </div>
                    <div className="border-l-4 border-white pl-5">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
                        Typical response
                      </p>
                      <p className="mt-2 text-lg font-black leading-8 text-white">
                        Usually handled directly by the team once your message is in the queue.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center gap-3 border-2 border-white bg-white px-4 py-3 text-black">
                    <Clock3 className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-black">Use the email link above for the fastest route.</p>
                  </div>
                  <div className="flex items-center gap-3 border-2 border-white bg-white px-4 py-3 text-black">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-black">Include any business or account details that help us route the message.</p>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <a href={CONTACT_MAILTO} className="campaign-button campaign-button-invert h-12 px-5">
                      <Mail size={16} />
                      Open email
                    </a>
                    <a href={CONTACT_MAILTO} download className="campaign-button campaign-button-outline-invert h-12 px-5">
                      <Download size={16} />
                      Copy email draft
                    </a>
                  </div>
                </div>
              </div>
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
            <Link href="/" className="hover:underline">
              Home
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