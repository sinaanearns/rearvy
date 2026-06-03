import Link from "next/link";
import { ArrowUpRight, Home, LockKeyhole, ShieldCheck } from "lucide-react";

import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";

export default function ForbiddenPage() {
  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <LockKeyhole className="h-3.5 w-3.5 text-cyan-200" />
          Access control
        </>
      }
      title={
        <>
          Access
          <span className="block">denied.</span>
        </>
      }
      description="This workspace route is protected. Return to the public site or sign in with an account that has access."
      primaryCta={{ href: "/", label: "Return home", icon: Home }}
      secondaryCta={{ href: "/login?redirect=/chat", label: "Sign in", icon: ArrowUpRight }}
      stats={[
        { value: "403", label: "Route status" },
        { value: "Private", label: "Workspace scope" },
        { value: "Auth", label: "Access required" },
      ]}
    >
      <section className="mx-auto w-full max-w-[860px] px-6">
        <div className="rounded-xl border border-white/12 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Permission check failed
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                Rearvy could not verify access for this page. If this should be available,
                sign in again and reopen the workspace route.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition hover:bg-white/85"
            >
              <Home className="h-4 w-4" />
              Return home
            </Link>
            <Link
              href="/login?redirect=/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/28 px-5 text-sm font-semibold text-white transition hover:border-white hover:bg-white hover:text-black"
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
