"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Link2, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-utils";

interface ProjectInviteModalProps {
  projectId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readInviteResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    error: typeof payload.error === "string" ? payload.error : undefined,
    inviteCode:
      typeof payload.inviteCode === "string" && payload.inviteCode.trim()
        ? payload.inviteCode.trim()
        : undefined,
  };
}

export function ProjectInviteModal({ projectId }: ProjectInviteModalProps) {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLink = async () => {
    if (!user) {
      setError("Sign in before generating a project invite link.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readInviteResponse(res);

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate project invite link.");
      }

      if (!data.inviteCode) {
        throw new Error("Project invite response did not include a code.");
      }

      setInviteCode(data.inviteCode);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to generate project invite link."));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/join-project/${encodeURIComponent(inviteCode)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Project invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to copy project invite link."));
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && !inviteCode && generateLink()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-[8px] border-border/70 bg-background/80 shadow-sm">
          <FolderOpen className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Invite to project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden rounded-[8px] border-border/70 p-0 shadow-sm sm:max-w-md">
        <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" />
        <div className="p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border/70 bg-muted/40">
              <Link2 className="h-4 w-4" />
            </span>
            Project invite link
          </DialogTitle>
          <DialogDescription>
            Generate a shareable link so collaborators can join this project and see its chats and resources.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="rounded-[8px] border border-border/70 bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
            Share this link to invite others to collaborate on this project.
            They will be able to see all chats and resources.
          </p>
          {loading ? (
            <div className="flex items-center justify-center rounded-[8px] border border-dashed border-border/70 bg-muted/20 py-5">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inviteCode ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/join-project/${encodeURIComponent(inviteCode)}`}
                className="h-10 min-w-0 flex-1 select-all rounded-[8px] border border-border/70 bg-muted/60 px-3 text-xs shadow-sm"
              />
              <Button size="sm" className="rounded-[8px]" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  "Copy link"
                )}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
