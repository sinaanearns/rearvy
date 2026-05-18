import Link from "next/link";
import { Download, MonitorDown, ShieldCheck, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const windowsDownloadUrl = "https://github.com/mutalvita-cyber/rearvy2.0/releases/download/v0.1.2/RearvyUserSetup-x64-0.1.2.exe";

export default function UnlockFeaturesPage() {
  return (
    <div className="min-h-screen bg-[#05060a] px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-1.5 text-sm font-medium text-cyan-100">
            <MonitorDown className="h-4 w-4" />
            Desktop features live in the Windows app
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Unlock Full Rearvy Features</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
            The website stays on localhost for browsing and account access. To use terminal commands, device access,
            and other local features, install the Rearvy desktop app instead of running npm commands here.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={windowsDownloadUrl} download>
              <Button size="lg" className="w-full bg-white px-6 text-slate-950 hover:bg-white/90 sm:w-auto">
                <Download className="h-4 w-4" />
                Download Windows App
              </Button>
            </a>
            <Link href="/download">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white sm:w-auto"
              >
                <ShieldCheck className="h-4 w-4" />
                View download page
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <TerminalSquare className="h-5 w-5 text-cyan-200" />
            <h2 className="mt-4 text-lg font-semibold">Terminal Agent</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Available in the desktop app for running shell commands from inside Rearvy.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
            <h2 className="mt-4 text-lg font-semibold">AI automation & MCP</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Use the desktop app when you want local tools, automation, and device integrations.
            </p>
          </article>
          <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <MonitorDown className="h-5 w-5 text-cyan-200" />
            <h2 className="mt-4 text-lg font-semibold">Website stays local-hosted</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              The browser app remains on localhost for the web experience and account access.
            </p>
          </article>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-50">
          If you are developing Rearvy locally, the setup commands belong in the repo docs and terminal guides, not on
          the public website page.
        </div>
      </div>
    </div>
  );
}
