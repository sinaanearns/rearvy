"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  Check,
  Copy,
  Folder,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  PenLine,
  Pin,
  PinOff,
  Share2,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SidebarChatProject {
  id: string;
  name: string;
}

export interface SidebarChatRecord {
  id: string;
  user_id?: string;
  is_owner?: boolean;
  project_id?: string | null;
  title: string | null;
  updated_at: string | null;
  is_pinned?: boolean;
  is_group?: boolean;
}

interface SidebarChatItemProps {
  chat: SidebarChatRecord;
  pathname: string;
  projects: SidebarChatProject[];
  currentUserId?: string | null;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: (chatId: string) => void;
  onChatUpdated: (chat: SidebarChatRecord) => void;
  onChatRemoved: (chatId: string) => void;
  onProjectCreated: (project: SidebarChatProject) => void;
}

type ShareDialogMode = "share" | "group";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

function parseChatRecord(value: unknown): SidebarChatRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const title = typeof value.title === "string" ? value.title : null;
  const updatedAt = typeof value.updated_at === "string" ? value.updated_at : null;

  return {
    id: value.id,
    user_id: typeof value.user_id === "string" ? value.user_id : undefined,
    is_owner: typeof value.is_owner === "boolean" ? value.is_owner : undefined,
    project_id:
      typeof value.project_id === "string"
        ? value.project_id
        : value.project_id === null
          ? null
          : undefined,
    title,
    updated_at: updatedAt,
    is_pinned: typeof value.is_pinned === "boolean" ? value.is_pinned : undefined,
    is_group: typeof value.is_group === "boolean" ? value.is_group : undefined,
  };
}

function parseProject(value: unknown, fallbackName: string): SidebarChatProject | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }

  return {
    id: value.id,
    name: typeof value.name === "string" && value.name.trim() ? value.name : fallbackName,
  };
}

export function SidebarChatItem({
  chat,
  pathname,
  projects,
  currentUserId,
  selectionMode = false,
  isSelected = false,
  onSelectToggle,
  onChatUpdated,
  onChatRemoved,
  onProjectCreated,
}: SidebarChatItemProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner =
    typeof chat.is_owner === "boolean"
      ? chat.is_owner
      : Boolean(currentUserId && chat.user_id === currentUserId);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  function openFreshNewChat() {
    router.push(`/chat/new?fresh=${Date.now()}`);
  }
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title || "New Chat");
  const [inviteLink, setInviteLink] = useState("");
  const [shareMode, setShareMode] = useState<ShareDialogMode>("share");
  const [createProjectName, setCreateProjectName] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  async function getToken() {
    if (!user) {
      toast.error("You need to be signed in to manage chats.");
      return null;
    }

    return user.getIdToken();
  }

  async function patchChat(action: string, body: Record<string, unknown>) {
    const token = await getToken();
    if (!token) {
      return null;
    }

    const response = await fetch(`/api/dashboard/chats/${encodeURIComponent(chat.id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...body }),
    });

    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(getErrorMessage(data, "Failed to update chat"));
    }

    const updatedChat = isRecord(data) ? parseChatRecord(data.chat) : null;
    if (!updatedChat) {
      throw new Error("Chat update returned an invalid response");
    }

    return updatedChat;
  }

  async function handleRename() {
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      toast.error("Chat title is required.");
      return;
    }

    setIsWorking(true);
    try {
      const updatedChat = await patchChat("rename", { title: nextTitle });
      if (updatedChat) {
        onChatUpdated(updatedChat);
        setIsRenameOpen(false);
        toast.success("Chat renamed.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename chat");
    } finally {
      setIsWorking(false);
    }
  }

  async function handlePinToggle() {
    setIsWorking(true);
    try {
      const updatedChat = await patchChat("pin", { value: !chat.is_pinned });
      if (updatedChat) {
        onChatUpdated(updatedChat);
        toast.success(updatedChat.is_pinned ? "Chat pinned." : "Chat unpinned.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update pin");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleArchive() {
    setIsWorking(true);
    try {
      await patchChat("archive", { value: true });
      onChatRemoved(chat.id);
      if (pathname === `/chat/${chat.id}`) {
        openFreshNewChat();
      }
      toast.success("Chat archived.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive chat");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleMoveToProject(projectId: string | null) {
    setIsWorking(true);
    try {
      const updatedChat = await patchChat("move", { projectId });
      if (updatedChat) {
        onChatUpdated(updatedChat);
        toast.success(projectId ? "Chat moved to project." : "Chat removed from project.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move chat");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDelete() {
    const token = await getToken();
    if (!token) {
      return;
    }

    setIsWorking(true);
    try {
      const response = await fetch(`/api/dashboard/chats/${encodeURIComponent(chat.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to delete chat"));
      }

      onChatRemoved(chat.id);
      setIsDeleteOpen(false);
      if (pathname === `/chat/${chat.id}`) {
        openFreshNewChat();
      }
      toast.success("Chat deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete chat");
    } finally {
      setIsWorking(false);
    }
  }

  async function ensureInviteLink(mode: ShareDialogMode) {
    const token = await getToken();
    if (!token) {
      return;
    }

    setShareMode(mode);
    setIsShareOpen(true);
    setIsGeneratingInvite(true);
    try {
      const response = await fetch(`/api/chat/${encodeURIComponent(chat.id)}/invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to generate invite link"));
      }

      const inviteCode = isRecord(data) && typeof data.inviteCode === "string" ? data.inviteCode.trim() : "";
      if (!inviteCode) {
        throw new Error("Invite link response was missing a code");
      }

      const link = `${window.location.origin}/join/${encodeURIComponent(inviteCode)}`;
      setInviteLink(link);
      onChatUpdated({
        ...chat,
        is_group: true,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate invite link");
      setIsShareOpen(false);
    } finally {
      setIsGeneratingInvite(false);
    }
  }

  function copyInviteLink() {
    if (!inviteLink) {
      return;
    }

    navigator.clipboard.writeText(inviteLink);
    toast.success("Link copied to clipboard.");
  }

  async function handleCreateProject() {
    const projectName = createProjectName.trim();
    if (!projectName) {
      toast.error("Project name is required.");
      return;
    }

    const token = await getToken();
    if (!token) {
      return;
    }

    setIsWorking(true);
    try {
      const response = await fetch("/api/dashboard/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description: null,
          template_id: null,
        }),
      });

      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to create project"));
      }

      const newProject = parseProject(data, projectName);
      if (!newProject) {
        throw new Error("Project creation returned an invalid response");
      }

      onProjectCreated(newProject);
      await handleMoveToProject(newProject.id);
      setCreateProjectName("");
      setIsCreateProjectOpen(false);
      toast.success("Project created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setIsWorking(false);
    }
  }

  const isActive = pathname === `/chat/${chat.id}`;
  const currentProjectId = chat.project_id || null;
  const canSelect = isOwner;

  function handleSelectionToggle() {
    if (!selectionMode || !canSelect || !onSelectToggle) {
      return;
    }

    onSelectToggle(chat.id);
  }

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-[8px] border border-transparent px-2 py-1 transition-colors",
          selectionMode && isSelected && "border-sidebar-border/70 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
          selectionMode && !canSelect && "opacity-60",
          !selectionMode && isActive
            ? "border-sidebar-border/70 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : !selectionMode && "hover:border-sidebar-border/60 hover:bg-sidebar-accent/50"
        )}
      >
        {selectionMode ? (
          <button
            type="button"
            onClick={handleSelectionToggle}
            disabled={!canSelect}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-0 py-1.5 text-left text-sm",
              canSelect ? "text-sidebar-foreground/80" : "cursor-not-allowed text-sidebar-foreground/50"
            )}
          >
            {isSelected ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <Square className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate font-medium text-inherit">{chat.title || "New Chat"}</span>
            {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" /> : null}
          </button>
        ) : (
          <Link
            href={`/chat/${encodeURIComponent(chat.id)}`}
            className="min-w-0 flex-1 rounded-[8px] px-0 py-1.5 text-sm text-sidebar-foreground/80"
          >
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-inherit">{chat.title || "New Chat"}</span>
              {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50" /> : null}
            </div>
          </Link>
        )}

        {isOwner && !selectionMode ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0 rounded-[8px] text-sidebar-foreground/60 opacity-80 hover:opacity-100"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open chat actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void ensureInviteLink("share")}> 
                <Share2 className="h-4 w-4" />
                Share chat
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void ensureInviteLink("group")}>
                <Users className="h-4 w-4" />
                Start group chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setRenameValue(chat.title || "New Chat");
                  setIsRenameOpen(true);
                }}
              >
                <PenLine className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Folder className="h-4 w-4" />
                  Move to project
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  <DropdownMenuItem onSelect={() => void handleMoveToProject(null)}>
                    <Folder className="h-4 w-4" />
                    No project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onSelect={() => void handleMoveToProject(project.id)}
                      className={project.id === currentProjectId ? "font-medium" : undefined}
                    >
                      <Folder className="h-4 w-4" />
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setIsCreateProjectOpen(true)}>
                    <FolderPlus className="h-4 w-4" />
                    New project
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => void handlePinToggle()} disabled={isWorking}>
                {chat.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {chat.is_pinned ? "Unpin chat" : "Pin chat"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleArchive()} disabled={isWorking}>
                <Archive className="h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a clearer name for this conversation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`rename-${chat.id}`}>Chat name</Label>
            <Input
              id={`rename-${chat.id}`}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleRename()} disabled={isWorking}>
              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{shareMode === "group" ? "Start group chat" : "Share chat"}</DialogTitle>
            <DialogDescription>
              {shareMode === "group"
                ? "Generate a group link so other people can join this chat and see its history."
                : "Copy a shareable link for this chat. The same invite flow is used for collaborators."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`share-${chat.id}`}>Invite link</Label>
            <Input
              id={`share-${chat.id}`}
              value={isGeneratingInvite ? "Generating..." : inviteLink}
              readOnly
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsShareOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={copyInviteLink} disabled={!inviteLink || isGeneratingInvite}>
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Create a project and move this chat into it immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`project-${chat.id}`}>Project name</Label>
            <Input
              id={`project-${chat.id}`}
              value={createProjectName}
              onChange={(event) => setCreateProjectName(event.target.value)}
              placeholder="Q2 growth plan"
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateProjectOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateProject()} disabled={isWorking}>
              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              This permanently removes the chat and all of its saved messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={isWorking}>
              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
