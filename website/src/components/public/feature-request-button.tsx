"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Lightbulb, Send, X, CheckCircle2 } from "lucide-react";

const featureRequestTriggerStyle = {
  position: "fixed",
  right: "max(1.5rem, env(safe-area-inset-right))",
  bottom: "max(1.5rem, env(safe-area-inset-bottom))",
  left: "auto",
} satisfies CSSProperties;

export function FeatureRequestButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("general");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !description) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          userEmail: email,
          category,
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string };

      if (!res.ok) {
        throw new Error(data?.error || "Failed to submit feature request.");
      }

      setSubmitted(true);
      setTitle("");
      setDescription("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setSubmitted(false);
    setError(null);
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="z-40 inline-flex max-w-[calc(100vw-3rem)] items-center gap-2 rounded-full border border-white/20 bg-black/80 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-xl transition hover:scale-105 hover:border-[#69d7ff]/50 hover:bg-[#080d16]"
        style={featureRequestTriggerStyle}
        aria-label="Request a feature"
      >
        <Lightbulb className="h-4 w-4 text-[#f7c948]" />
        <span>Request Feature</span>
      </button>

      {/* Feature Request Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-[14px] border border-white/16 bg-[#080b11] p-6 shadow-2xl">
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 text-white/50 hover:text-white transition"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {submitted ? (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">Feature Request Received!</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/70">
                  Thank you! Your request has been sent directly to the Rearvy product team.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-6 rounded-[8px] bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-cyan-50 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#f7c948]/30 bg-[#f7c948]/10 text-[#f7c948]">
                    <Lightbulb className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Request a Feature</h3>
                    <p className="text-xs text-white/50">Tell us what capability or workflow you need</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 grid gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-white/80">Feature Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Notion Database Sync"
                      required
                      className="mt-1 w-full rounded-[8px] border border-white/16 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#69d7ff] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white/80">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 w-full rounded-[8px] border border-white/16 bg-[#0f141d] px-3.5 py-2 text-xs text-white focus:border-[#69d7ff] focus:outline-none"
                    >
                      <option value="general">General</option>
                      <option value="integrations">Integrations</option>
                      <option value="automations">Automations</option>
                      <option value="desktop">Desktop Shell</option>
                      <option value="ui_ux">UI / UX</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white/80">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Explain how this feature should work and why it would help your business..."
                      rows={3}
                      required
                      className="mt-1 w-full rounded-[8px] border border-white/16 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#69d7ff] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-white/80">Your Email (optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="mt-1 w-full rounded-[8px] border border-white/16 bg-white/[0.05] px-3.5 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#69d7ff] focus:outline-none"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-[6px] p-2">
                      {error}
                    </p>
                  )}

                  <div className="mt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-[8px] border border-white/16 px-4 py-2 text-xs font-semibold text-white/70 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 rounded-[8px] bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-cyan-50 transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {loading ? "Sending..." : "Submit Request"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
