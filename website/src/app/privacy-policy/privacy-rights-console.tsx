"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LifeBuoy, PlugZap, Trash2 } from "lucide-react";

import { buildMailto, PRIVACY_CONTACT_EMAIL } from "@/lib/public-contact";

type RightsItem = {
  action: string;
  route: string;
  proof: string;
  outcome: string;
};

type PrivacyRightsConsoleProps = {
  items: RightsItem[];
};

function actionHref(action: string) {
  if (action.toLowerCase() === "delete") {
    return "/data-delete";
  }

  if (action.toLowerCase() === "disconnect") {
    return "#privacy-integrations";
  }

  return buildMailto(PRIVACY_CONTACT_EMAIL, `${action} Request`);
}

function PrivacyActionIcon({
  action,
  className,
}: {
  action: string;
  className?: string;
}) {
  if (action.toLowerCase() === "delete") {
    return <Trash2 className={className} aria-hidden />;
  }

  if (action.toLowerCase() === "disconnect") {
    return <PlugZap className={className} aria-hidden />;
  }

  return <LifeBuoy className={className} aria-hidden />;
}

export function PrivacyRightsConsole({ items }: PrivacyRightsConsoleProps) {
  const [selectedAction, setSelectedAction] = useState(items[0]?.action ?? "");
  const selectedItem = useMemo(
    () => items.find((item) => item.action === selectedAction) ?? items[0],
    [items, selectedAction],
  );
  const selectedHref = selectedItem ? actionHref(selectedItem.action) : "#privacy-request-builder";

  return (
    <section id="privacy-rights-console" className="mx-auto mt-6 w-full max-w-[1180px] scroll-mt-28 px-6">
      <div className="overflow-hidden rounded-xl border border-white/12 bg-black/42 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="grid lg:grid-cols-[0.62fr_1.38fr]">
          <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/80">Rights console</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Choose your privacy action
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/62">
              Pick the action you need and see the right route, proof, expected outcome, and next step.
            </p>

            <div className="mt-6 grid gap-2">
              {items.map((item) => {
                const isSelected = item.action === selectedItem?.action;

                return (
                  <button
                    key={item.action}
                    type="button"
                    onClick={() => setSelectedAction(item.action)}
                    className={[
                      "flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition",
                      isSelected
                        ? "border-cyan-200/38 bg-cyan-200/12 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/22 hover:bg-white/8 hover:text-white",
                    ].join(" ")}
                    aria-pressed={isSelected}
                  >
                    <span className="flex items-center gap-3">
                      <PrivacyActionIcon action={item.action} className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-bold">{item.action}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 opacity-45" aria-hidden />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <div className="rounded-xl border border-cyan-100/16 bg-cyan-200/10 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-100/24 bg-black/24 text-cyan-50">
                  <PrivacyActionIcon action={selectedItem?.action ?? ""} className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/70">
                    Selected action
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {selectedItem?.action ?? "Privacy action"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/64">{selectedItem?.outcome}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Route</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedItem?.route}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/38">Proof</p>
                  <p className="mt-2 text-sm font-semibold text-white">{selectedItem?.proof}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={selectedHref}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-100/24 bg-cyan-200/12 px-4 py-2 text-sm font-bold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-cyan-200/20"
                >
                  Start this action
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <a
                  href="#privacy-request-builder"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:border-white/28 hover:bg-white hover:text-black"
                >
                  Draft request
                </a>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              <div className="grid border-b border-white/10 bg-white/8 text-xs font-bold uppercase tracking-[0.16em] text-white/46 md:grid-cols-[0.34fr_0.42fr_0.4fr_1fr]">
                <div className="p-4">Action</div>
                <div className="border-white/10 p-4 md:border-l">Route</div>
                <div className="border-white/10 p-4 md:border-l">Proof</div>
                <div className="border-white/10 p-4 md:border-l">Outcome</div>
              </div>
              {items.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => setSelectedAction(item.action)}
                  className="grid w-full border-b border-white/10 text-left transition last:border-b-0 hover:bg-white/6 md:grid-cols-[0.34fr_0.42fr_0.4fr_1fr]"
                >
                  <div className="flex items-center gap-2 bg-black/22 p-4 text-sm font-semibold text-white">
                    {item.action === selectedItem?.action ? (
                      <CheckCircle2 className="h-4 w-4 text-cyan-100" aria-hidden />
                    ) : null}
                    {item.action}
                  </div>
                  <div className="border-white/10 p-4 text-sm leading-6 text-cyan-100/78 md:border-l">{item.route}</div>
                  <div className="border-white/10 p-4 text-sm leading-6 text-white/62 md:border-l">{item.proof}</div>
                  <div className="border-white/10 p-4 text-sm leading-6 text-white/66 md:border-l">{item.outcome}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
