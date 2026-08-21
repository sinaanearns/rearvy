"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RearvyPublicShell } from "@/components/public/rearvy-public-shell";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
import { signOut } from "@/lib/firebase/auth";

const CONFIRMATION_TEXT = "DELETE MY DATA";
const log = createClientLogger("DataDeletePage");

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const deletionSteps: Array<{
  title: string;
  detail: string;
  icon: LucideIcon;
}> = [
  {
    title: "Verify account",
    detail: "Sign in so Rearvy scopes deletion to your own account records.",
    icon: KeyRound,
  },
  {
    title: "Confirm intent",
    detail: `Type ${CONFIRMATION_TEXT} before any destructive request can run.`,
    icon: ShieldCheck,
  },
  {
    title: "Remove records",
    detail: "Chats, integrations, analytics, and synced data owned by the account are removed.",
    icon: Trash2,
  },
  {
    title: "Close session",
    detail: "The active session is signed out after the deletion request completes.",
    icon: LockKeyhole,
  },
];

const deletionScope = [
  "Profile and account-owned workspace records",
  "Chats, project context, memories, and generated outputs",
  "Connected integration records, analytics, and synced data",
];

async function readDeleteError(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  const error =
    isRecord(payload) && typeof payload.error === "string"
      ? payload.error.trim()
      : "";
  if (error) {
    return error;
  }

  return "Failed to delete your data.";
}

function DataDeleteHeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-red-200/0 via-red-200/70 to-cyan-200/0" />

      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-red-100/76">
            <AlertTriangle className="h-3.5 w-3.5" />
            Account deletion
          </div>
          <p className="mt-2 max-w-md text-xl font-semibold leading-tight text-white">
            Permanent deletion stays signed-in, explicit, and account-scoped
          </p>
        </div>
        <span className="rounded-[8px] border border-red-200/22 bg-red-200/12 px-3 py-1 text-xs font-semibold text-red-100">
          No undo
        </span>
      </div>

      <div className="grid gap-3 py-4 sm:grid-cols-2">
        {deletionSteps.map((step) => {
          const Icon = step.icon;

          return (
            <div key={step.title} className="min-w-0 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-5 text-white/60">{step.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3">
          <p className="text-xs font-medium text-cyan-100/74">Required state</p>
          <p className="mt-1 text-2xl font-semibold text-white">Signed in</p>
        </div>
        <div className="rounded-[8px] border border-red-200/18 bg-red-200/10 p-3">
          <p className="text-xs font-medium text-red-100/74">Confirmation</p>
          <p className="mt-1 break-words text-2xl font-semibold text-white">{CONFIRMATION_TEXT}</p>
        </div>
      </div>
    </div>
  );
}

export default function DataDeletePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const trimmedConfirmation = confirmText.trim();
  const confirmationProgress = Math.min(
    100,
    Math.round((trimmedConfirmation.length / CONFIRMATION_TEXT.length) * 100)
  );
  const isConfirmationReady = trimmedConfirmation === CONFIRMATION_TEXT;
  const accountLabel = user?.email || "Signed-in account";

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

      if (!response.ok) {
        throw new Error(await readDeleteError(response));
      }

      await signOut();
      toast.success("Your account data was permanently deleted.");
      router.replace("/login?deleted=1");
    } catch (error) {
      log.error("Failed to delete account data:", error);
      toast.error(getErrorMessage(error, "Failed to delete your data."));
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
      primaryCta={{
        href: "/login?redirect=/data-delete",
        label: "Sign in to continue",
      }}
      secondaryCta={{ href: "/privacy-policy", label: "Privacy Policy" }}
      sidePanel={<DataDeleteHeroPanel />}
      stats={[
        { value: "Permanent", label: "Deletion action" },
        { value: "Auth", label: "Required to verify" },
        { value: "Private", label: "Account scope" },
      ]}
    >
      <section
        aria-labelledby="data-delete-form-title"
        className="mx-auto w-full max-w-[1040px] px-6"
      >
        <div className="overflow-hidden rounded-[8px] border border-red-300/24 bg-red-300/10 shadow-sm shadow-black/25 backdrop-blur-xl">
          <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
            <aside className="border-b border-red-100/12 bg-black/30 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] border border-red-200/24 bg-red-200/12 text-red-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="mt-6 text-xs font-medium text-red-100/74">
                Destructive account action
              </p>
              <h2 className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight text-white">
                Delete your Rearvy data permanently.
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/68">
                This removes account-owned records including profile data, chats,
                integrations, analytics, and synced records.
              </p>
              <div className="mt-6 grid gap-2">
                {deletionScope.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 rounded-[8px] border border-white/10 bg-white/[0.05] p-3 text-sm leading-5 text-white/68"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-red-100" aria-hidden />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </aside>

            <div className="p-6 sm:p-8">
              <div className="rounded-[8px] border border-white/10 bg-black/28 p-5 text-sm leading-6 text-white/68">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p id="data-delete-form-title" className="font-semibold text-white">
                      Before continuing
                    </p>
                    <p className="mt-2 text-white/62">
                      Rearvy only enables deletion after the session is verified
                      and the exact confirmation phrase is typed.
                    </p>
                  </div>
                  <span className="hidden rounded-[8px] border border-red-200/18 bg-red-200/10 px-3 py-1 text-xs font-semibold text-red-100 sm:inline-flex">
                    Permanent
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    "This action cannot be undone.",
                    "Connected account data will be removed.",
                    "You will be signed out after deletion.",
                  ].map((item) => (
                    <div
                      key={item}
                      className="rounded-[8px] border border-white/10 bg-white/[0.05] p-3"
                    >
                      <CheckCircle2 className="h-4 w-4 text-cyan-100" aria-hidden />
                      <p className="mt-2 text-xs leading-5 text-white/64">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="mt-5 rounded-[8px] border border-white/10 bg-white/7 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 text-cyan-100">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Checking session</p>
                      <p className="mt-1 text-sm leading-6 text-white/64">
                        Rearvy is verifying whether this browser is signed in
                        before showing the deletion controls.
                      </p>
                    </div>
                  </div>
                </div>
              ) : !user ? (
                <div className="mt-5 rounded-[8px] border border-white/10 bg-white/7 p-5">
                  <p className="mb-4 text-sm leading-6 text-white/68">
                    Sign in first so Rearvy can verify the account and scope the
                    deletion to your records.
                  </p>
                  <Button
                    asChild
                    className="h-11 rounded-[8px] bg-white px-5 font-semibold text-black hover:bg-white/85"
                  >
                    <Link href="/login?redirect=/data-delete">
                      Sign in to continue
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <div className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-4">
                    <p className="text-xs font-medium text-cyan-100/74">
                      Verified account
                    </p>
                    <p className="mt-2 break-words text-lg font-semibold text-white">
                      {accountLabel}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/62">
                      Deletion is scoped to this signed-in account.
                    </p>
                  </div>

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
                      className="h-11 rounded-[8px] border-white/12 bg-white/8 text-white placeholder:text-white/50"
                      aria-describedby="confirm-delete-status"
                    />
                    <div
                      aria-hidden="true"
                      className="h-1.5 overflow-hidden rounded-full bg-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-300 via-amber-200 to-cyan-200 transition-all"
                        style={{ width: `${confirmationProgress}%` }}
                      />
                    </div>
                    <p
                      id="confirm-delete-status"
                      className="text-xs leading-5 text-white/58"
                    >
                      {isConfirmationReady
                        ? "Confirmation phrase matched. The destructive action is now available."
                        : "The delete button stays locked until the phrase matches exactly."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAllData}
                      disabled={deleting || !isConfirmationReady}
                      className="h-11 rounded-[8px] px-5 font-semibold"
                    >
                      {deleting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Permanently delete all my data
                    </Button>
                    <Button
                      variant="outline"
                      asChild
                      className="h-11 rounded-[8px] border-white/20 bg-transparent px-5 text-white hover:bg-white/10 hover:text-white"
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
