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

interface ProjectInviteModalProps {
  projectId: string;
}

export function ProjectInviteModal({ projectId }: ProjectInviteModalProps) {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.inviteCode) {
        setInviteCode(data.inviteCode);
      }
    } catch (err) {
      console.error("Failed to generate project invite link:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteCode) return;
    const link = `${window.location.origin}/join-project/${inviteCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/join-project/${inviteCode}`}
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
          ) : (
            <p className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">Failed to generate link.</p>
          )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
