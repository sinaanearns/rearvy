"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { signOut } from "@/lib/firebase/auth";

const CONFIRMATION_TEXT = "DELETE MY DATA";

export default function DataDeletePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAllData() {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    if (confirmText.trim() !== CONFIRMATION_TEXT) {
      toast.error(`Type ${CONFIRMATION_TEXT} exactly to continue.`);
      return;
    }

    setDeleting(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch("/api/account/data-delete", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete your data.");
      }

      await signOut();
      toast.success("Your account data was permanently deleted.");
      router.replace("/login?deleted=1");
    } catch (error) {
      console.error("Failed to delete account data:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete your data."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <RearvyPublicShell
      eyebrow={
        <>
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
          Account data
        </>
      }
      title={
        <>
          Delete your
          <span className="block">Rearvy data.</span>
        </>
      }
      description="This page explains and handles account data deletion. You must sign in before Rearvy can verify and delete account-owned records."
      primaryCta={{ href: "/login?redirect=/data-delete", label: "Sign in to continue" }}
      secondaryCta={{ href: "/privacy-policy", label: "Privacy Policy" }}
      stats={[
        { value: "Permanent", label: "Deletion action" },
        { value: "Auth", label: "Required to verify" },
        { value: "Private", label: "Account scope" },
      ]}
    >
      <section className="mx-auto w-full max-w-[1040px] px-6">
        <div className="overflow-hidden rounded-[8px] border border-red-300/24 bg-red-300/10 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <aside className="border-b border-red-100/12 bg-black/30 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-red-200/24 bg-red-200/12 text-red-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-red-100/70">
                Destructive account action
              </p>
              <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white">
                Delete your Rearvy data permanently.
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/68">
                This removes account-owned records including profile data, chats, integrations, analytics, and synced records.
              </p>
            </aside>

            <div className="p-6 sm:p-8">
              <div className="rounded-[8px] border border-white/10 bg-black/28 p-5 text-sm leading-6 text-white/68">
                <p className="font-semibold text-white">Before continuing</p>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  <li>This action cannot be undone.</li>
                  <li>All connected data under your account will be removed.</li>
                  <li>You will be signed out immediately after deletion.</li>
                </ul>
              </div>

              {!loading && !user ? (
                <div className="mt-5 rounded-[8px] border border-white/10 bg-white/7 p-5">
                  <p className="mb-4 text-sm leading-6 text-white/68">
                    Sign in first so Rearvy can verify the account and scope the deletion to your records.
                  </p>
                  <Button asChild className="h-11 rounded-[8px] bg-white px-5 font-semibold text-black hover:bg-white/85">
                    <Link href="/login?redirect=/data-delete">Sign in to continue</Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="confirm-delete" className="text-white">
                      Type {CONFIRMATION_TEXT} to confirm
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      placeholder={CONFIRMATION_TEXT}
                      autoComplete="off"
                      disabled={deleting}
                      className="h-11 rounded-[8px] border-white/12 bg-white/8 text-white placeholder:text-white/35"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAllData}
                      disabled={loading || deleting}
                      className="h-11 rounded-[8px] px-5 font-semibold"
                    >
                      {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Permanently delete all my data
                    </Button>
                    <Button
                      variant="outline"
                      asChild
                      className="h-11 rounded-[8px] border-white/20 bg-transparent px-5 text-white hover:bg-white hover:text-black"
                    >
                      <Link href="/settings">Cancel</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </RearvyPublicShell>
  );
}
