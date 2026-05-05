import type { Metadata } from "next";
import { AnthropicDirectoryBrowser } from "@/components/directory/anthropic-directory-browser";
import { loadAnthropicDirectory } from "@/lib/anthropic-directory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Directory | Rearvy",
  description: "Browse Anthropic skills, connectors, and plugins inside Rearvy.",
};

export default async function DirectoryPage() {
  const directory = await loadAnthropicDirectory();
  const totalItems = directory.skills.length + directory.connectors.length + directory.plugins.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-6 py-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.16),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Anthropic directory</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Skills, connectors, and plugins in one searchable view.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              This page pulls the current public Anthropic catalog into Rearvy so you can browse official
              skills, connectors, and plugins without leaving the workspace.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto lg:min-w-[360px]">
            {[
              { label: "Skills", value: directory.skills.length },
              { label: "Connectors", value: directory.connectors.length },
              { label: "Plugins", value: directory.plugins.length },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{totalItems} total entries</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Live Anthropic pages</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Search, filter, and sort</span>
        </div>
      </section>

      <AnthropicDirectoryBrowser directory={directory} />
    </div>
  );
}
