"use client";

import { useState } from "react";
import { UserPlus, Copy } from "lucide-react";
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
    toast.success("Link copied to clipboard");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full border-muted-foreground/30 bg-background/50 backdrop-blur">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Invite with link</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-zinc-950 border-zinc-800 text-zinc-100 dark">
        <DialogHeader>
          <DialogTitle>Group link</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Use a group link to invite others to join your group chat. Anyone can join your group chat with this link, and they'll be able to see the previous messages in this group chat.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 pt-4">
          <div className="grid flex-1 gap-2">
            <Input
              id="link"
              value={inviteLink || (isLoading ? "Generating..." : "")}
              readOnly
              className="bg-zinc-900 border-zinc-700 text-zinc-300"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2 mt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-full">
            Cancel
          </Button>
          <Button onClick={copyToClipboard} disabled={!inviteLink || isLoading} className="bg-white text-black hover:bg-zinc-200 rounded-full">
            <Copy className="mr-2 h-4 w-4" />
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
