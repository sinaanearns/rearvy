import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Rearvy Account",
  description: "Rearvy account access for sign-in and signup.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0d1117] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,17,23,0.96),rgba(17,24,39,0.9)_38%,rgba(39,56,92,0.76))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <main className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.75fr)]">
        <section className="hidden min-h-screen flex-col justify-between px-10 py-10 lg:flex xl:px-16">
          <div className="flex items-center gap-3">
            <Image
              src="/rearvy-logo.png"
              alt="Rearvy"
              width={42}
              height={42}
              className="rounded-lg border border-white/15 bg-white/95 p-1.5"
              priority
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Rearvy
              </p>
              <p className="text-sm text-white/58">Agency AI workspace</p>
            </div>
          </div>

          <div className="max-w-3xl space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/74 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Client work, automations, and approvals in one place
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-5xl font-semibold leading-[1.03] tracking-tight xl:text-6xl">
                Run the client workspace without losing the thread.
              </h1>
              <p className="max-w-xl text-base leading-7 text-white/68">
                Rearvy keeps research, browser work, creative output, and account operations together for fast-moving growth teams.
              </p>
            </div>

            <div className="relative max-w-3xl overflow-hidden rounded-[8px] border border-white/12 bg-white/8 p-3 shadow-2xl shadow-black/40 backdrop-blur">
              <Image
                src="/images/hero_screenshot.png"
                alt="Rearvy workspace preview"
                width={1440}
                height={900}
                className="aspect-[16/10] w-full rounded-[6px] object-cover object-top"
                priority
              />
              <div className="absolute bottom-5 left-5 grid grid-cols-3 gap-2 text-xs">
                {["Research", "Review", "Ship"].map((label) => (
                  <span
                    key={label}
                    className="rounded-[6px] border border-white/14 bg-[#0d1117]/78 px-3 py-2 font-medium text-white/78 backdrop-blur"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid max-w-2xl grid-cols-3 gap-3 text-sm text-white/62">
            {[
              ["Browser", "Live web tasks"],
              ["Gmail", "Review before send"],
              ["Media", "Campaign-ready assets"],
            ].map(([label, value]) => (
              <div key={label} className="border-t border-white/14 pt-4">
                <p className="font-semibold text-white">{label}</p>
                <p>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-white px-4 py-8 text-slate-950 sm:px-6 lg:bg-white/96 lg:backdrop-blur-xl">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </div>
  );
}
