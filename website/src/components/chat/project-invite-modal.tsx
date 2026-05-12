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
        <Button variant="outline" size="sm">
          <FolderOpen className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Invite to project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Project invite link
          </DialogTitle>
          <DialogDescription>
            Generate a shareable link so collaborators can join this project and see its chats and resources.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Share this link to invite others to collaborate on this project.
            They will be able to see all chats and resources.
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inviteCode ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/join-project/${inviteCode}`}
                className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs select-all"
              />
              <Button size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  "Copy link"
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-red-500">Failed to generate link.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
