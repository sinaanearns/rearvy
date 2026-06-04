"use client";

import { useState } from "react";
import { Check, Copy, Link2, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-utils";

interface InviteModalProps {
  chatId: string;
}

export function InviteModal({ chatId }: InviteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const generateLink = async () => {
    if (!user || !chatId) return;
    
    setIsLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/chat/${chatId}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await response.json()) as { error?: string; inviteCode?: string };
      
      if (!response.ok) throw new Error(data.error || "Failed to generate invite link");
      if (!data.inviteCode) throw new Error("Invite response did not include a code");
      
      const link = `${window.location.origin}/join/${data.inviteCode}`;
      setInviteLink(link);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to generate invite link"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !inviteLink) {
      generateLink();
    }
  };

  const copyToClipboard = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copied to clipboard");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-[8px] border-border/70 bg-background/80 shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Invite with link</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="overflow-hidden rounded-[8px] border-border/70 p-0 shadow-sm sm:max-w-md">
        <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" />
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-border/70 bg-muted/40">
                <Link2 className="h-4 w-4" />
              </span>
              Group invite link
            </DialogTitle>
            <DialogDescription className="leading-6">
              Share a private link so collaborators can join this chat and review the previous messages.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="rounded-[8px] border border-border/70 bg-muted/25 px-3 py-3 text-sm leading-6 text-muted-foreground">
              Anyone with this link can join the group chat, so only share it with people who should see the conversation.
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="link"
                value={inviteLink || (isLoading ? "Generating invite link..." : "")}
                readOnly
                className="h-10 min-w-0 flex-1 select-all rounded-[8px] border-border/70 bg-muted/60 px-3 text-xs shadow-sm"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="rounded-[8px]"
            >
              Cancel
            </Button>
            <Button
              onClick={copyToClipboard}
              disabled={!inviteLink || isLoading}
              className="rounded-[8px]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
