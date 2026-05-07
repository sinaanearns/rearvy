"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Your Data
          </CardTitle>
          <CardDescription>
            This permanently deletes your Rearvy account data, including profile, chats,
            integrations, analytics, and synced records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Before continuing:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>This action cannot be undone.</li>
              <li>All connected data under your account will be removed.</li>
              <li>You will be signed out immediately after deletion.</li>
            </ul>
          </div>

          {!loading && !user ? (
            <div className="rounded-md border bg-background p-4 text-sm">
              <p className="mb-3 text-muted-foreground">
                You need to sign in to delete your data.
              </p>
              <Button asChild>
                <Link href="/login?redirect=/data-delete">Sign in to continue</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Type {CONFIRMATION_TEXT} to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={CONFIRMATION_TEXT}
                  autoComplete="off"
                  disabled={deleting}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAllData}
                  disabled={loading || deleting}
                >
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Permanently delete all my data
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/settings">Cancel</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}