import type { Metadata } from "next";
import Image from "next/image";
import { Activity, Globe2, Mail, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Rearvy Account",
  description: "Rearvy account access for sign-in and signup.",
  robots: {
    index: false,
    follow: false,
  },
};

const authProofItems = [
  {
    label: "Browser",
    value: "Live web tasks",
    icon: Globe2,
    tone: "text-cyan-200",
  },
  {
    label: "Gmail",
    value: "Review before send",
    icon: Mail,
    tone: "text-emerald-200",
  },
  {
    label: "Media",
    value: "Campaign-ready assets",
    icon: Activity,
    tone: "text-amber-200",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050706] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(5,7,6,0.98),rgba(9,24,27,0.92)_38%,rgba(24,29,19,0.84)_74%,rgba(5,7,6,0.96))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-200/0 via-cyan-200/80 to-emerald-200/0" />

      <main className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.75fr)]">
        <section className="hidden min-h-screen flex-col justify-between px-10 py-8 lg:flex xl:px-14">
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
              <p className="text-sm font-semibold text-cyan-100">
                Rearvy
              </p>
              <p className="text-sm text-white/68">Agency AI workspace</p>
            </div>
          </div>

          <div className="max-w-3xl space-y-5">
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold leading-[1.03] tracking-tight xl:text-5xl">
                Run the client workspace without losing the thread.
              </h1>
              <p className="max-w-xl text-base leading-7 text-white/76">
                Rearvy keeps research, browser work, creative output, and account operations together for fast-moving growth teams.
              </p>
            </div>

            <div className="relative max-w-[680px] overflow-hidden rounded-[8px] border border-white/14 bg-white/[0.07] p-2.5 shadow-2xl shadow-black/35 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-2 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-300/85" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/85" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/85" />
                </div>
                <div className="flex items-center gap-2 rounded-[8px] border border-emerald-200/18 bg-emerald-200/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  Approval-ready
                </div>
              </div>
              <div className="relative mt-2.5 overflow-hidden rounded-[6px] bg-black">
                <Image
                  src="/images/hero_screenshot.png"
                  alt="Rearvy workspace preview"
                  width={1440}
                  height={900}
                  className="aspect-[16/9] w-full object-cover object-top"
                  priority
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/58 to-transparent" />

              </div>
            </div>
          </div>


        </section>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-8 text-slate-950 sm:px-6 lg:bg-white/96 lg:backdrop-blur-xl">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_88%_8%,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98)_42%)] lg:hidden"
          />
          <div className="relative z-10 flex w-[358px] max-w-full min-w-0 flex-col gap-4 sm:w-full sm:max-w-md">
            <div className="overflow-hidden rounded-[8px] border border-slate-200/80 bg-white/88 shadow-sm shadow-slate-950/10 backdrop-blur lg:hidden">
              <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" />
              <div className="p-3">
                <div className="flex items-center gap-3">
                  <Image
                    src="/rearvy-logo.png"
                    alt="Rearvy"
                    width={34}
                    height={34}
                    className="rounded-[8px] border border-slate-200 bg-white p-1"
                    priority
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">Rearvy</p>
                    <p className="text-xs leading-5 text-slate-600">
                      Client work, automations, and approvals in one workspace.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-medium text-slate-600">
                  {authProofItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.label}
                        className="flex min-w-0 items-center justify-center gap-1.5 rounded-[8px] border border-slate-200 bg-slate-50 px-2 py-1.5"
                      >
                        <Icon className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                        <span className="truncate">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
