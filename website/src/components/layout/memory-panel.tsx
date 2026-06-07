"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";

const log = createClientLogger("MemoryPanel");

interface MemoryItem {
  id: string;
  content: string;
  memory_type: string;
  importance: number;
  created_at: string;
  project_id?: string;
}

type MemoriesResponse = {
  memories?: unknown;
  error?: unknown;
};

type MemoryMutationResponse = {
  memory?: unknown;
  error?: unknown;
};

function emitMemoryUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMemoryItem(value: unknown): value is MemoryItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.content === "string" &&
    typeof value.memory_type === "string" &&
    typeof value.importance === "number" &&
    Number.isFinite(value.importance) &&
    typeof value.created_at === "string" &&
    (value.project_id === undefined || typeof value.project_id === "string")
  );
}

async function readMemoriesResponse(response: Response): Promise<MemoriesResponse> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    memories: payload.memories,
    error: payload.error,
  };
}

async function readMemoryMutationResponse(response: Response): Promise<MemoryMutationResponse> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    memory: payload,
    error: payload.error,
  };
}

function getResponseError(payload: { error?: unknown }, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
}

export function MemoryPanel({
  variant = "desktop",
}: {
  variant?: "desktop" | "mobile";
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extract projectId from pathname
  const projectMatch = pathname?.match(/\/projects\/([a-zA-Z0-9_-]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;

  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setIsLoadingMemories(true);
    try {
      const token = await user.getIdToken();
      const url = activeProjectId
        ? `/api/dashboard/memories?project_id=${encodeURIComponent(activeProjectId)}`
        : "/api/dashboard/memories";
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readMemoriesResponse(response);

      if (!response.ok) {
        throw new Error(getResponseError(data, "Failed to fetch memories"));
      }

      setMemories(Array.isArray(data.memories) ? data.memories.filter(isMemoryItem) : []);
      setErrorMessage(null);
    } catch (error) {
      log.error("Error fetching memories:", error);
      setErrorMessage(getErrorMessage(error, "Failed to fetch memories"));
    } finally {
      setIsLoadingMemories(false);
    }
  }, [user, activeProjectId]);

  useEffect(() => {
    if (user) {
      fetchMemories();
    }
  }, [user, fetchMemories]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMemoryUpdated = () => {
      void fetchMemories();
    };

    window.addEventListener(MEMORY_UPDATED_EVENT, handleMemoryUpdated);
    return () => {
      window.removeEventListener(MEMORY_UPDATED_EVENT, handleMemoryUpdated);
    };
  }, [fetchMemories]);

  const handleSaveMemory = async () => {
    if (!newMemory.trim() || !user) return;

    try {
      const token = await user.getIdToken();
      const body: Record<string, unknown> = {
        content: newMemory.trim(),
        memory_type: "fact",
        importance: 5,
      };
      if (activeProjectId) {
        body.project_id = activeProjectId;
      }

      const response = await fetch("/api/dashboard/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await readMemoryMutationResponse(response);
      if (!response.ok) {
        throw new Error(getResponseError(data, "Failed to save memory"));
      }

      const savedMemory = data.memory;
      if (isMemoryItem(savedMemory)) {
        setMemories((prev) => [savedMemory, ...prev]);
      } else {
        await fetchMemories();
      }
      setNewMemory("");
      setErrorMessage(null);
      emitMemoryUpdated();
    } catch (error) {
      log.error("Error saving memory:", error);
      setErrorMessage(getErrorMessage(error, "Failed to save memory"));
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/dashboard/memories/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await readMemoriesResponse(response);
        throw new Error(getResponseError(data, "Failed to delete memory"));
      }
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setErrorMessage(null);
      emitMemoryUpdated();
    } catch (error) {
      log.error("Error deleting memory:", error);
      setErrorMessage(getErrorMessage(error, "Failed to delete memory"));
    }
  };

  const handleStartEdit = (memory: MemoryItem) => {
    setEditingId(memory.id);
    setEditContent(memory.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim() || !user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/dashboard/memories/${encodeURIComponent(editingId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!response.ok) {
        const data = await readMemoriesResponse(response);
        throw new Error(getResponseError(data, "Failed to update memory"));
      }

      setMemories((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, content: editContent.trim() } : m
        )
      );
      setEditingId(null);
      setEditContent("");
      setErrorMessage(null);
      emitMemoryUpdated();
    } catch (error) {
      log.error("Error updating memory:", error);
      setErrorMessage(getErrorMessage(error, "Failed to update memory"));
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden bg-sidebar",
        variant === "desktop"
          ? "hidden md:flex md:w-80 border-l"
          : "w-full min-w-0"
      )}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-primary/15 bg-primary/10 shadow-sm">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">Memory</h2>
          <p className="text-[11px] text-muted-foreground">
            {activeProjectId ? "Project notes" : "Global notes"} / {memories.length} saved
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
        <div className="space-y-4 p-4">
          <div className="rounded-[8px] border border-border/70 bg-card/70 p-3 shadow-sm shadow-slate-950/[0.03]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                Quick Save
              </h3>
              <span className="rounded-[8px] border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {activeProjectId ? "Project" : "Global"}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={activeProjectId ? "Add a project note..." : "Add an important note..."}
                className="h-9 min-w-0 flex-1 rounded-[8px] border border-border/70 bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveMemory();
                  }
                }}
              />
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 shrink-0 rounded-[8px] border-border/70 bg-background shadow-sm"
                onClick={handleSaveMemory}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {errorMessage ? (
              <p className="mt-2 rounded-[8px] border border-destructive/20 bg-destructive/10 px-2 py-1.5 text-[11px] leading-4 text-destructive">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                {activeProjectId ? "Project Memories" : "Recent Memories"}
              </h3>
              {isLoadingMemories && (
                <span className="text-[10px] text-muted-foreground animate-pulse">
                  Loading...
                </span>
              )}
            </div>
            {memories.length === 0 && !isLoadingMemories ? (
              <div className="rounded-[8px] border border-dashed border-border/70 bg-background/60 px-4 py-8 text-center text-muted-foreground shadow-sm">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-border/70 bg-muted/40">
                  <Brain className="h-4 w-4 opacity-70" />
                </div>
                <p className="text-xs leading-5">
                  {activeProjectId
                    ? "No project notes yet. Rearvy will keep important project context here, or you can add it manually."
                    : "No notes saved yet. Rearvy will keep important context here, or you can add it manually."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="group relative rounded-[8px] border border-border/60 bg-card/85 p-3 shadow-sm shadow-slate-950/[0.03] transition-all hover:border-border/90 hover:bg-card"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="min-w-0 flex-1">
                        {editingId === memory.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full resize-none rounded-[8px] border border-border/70 bg-background px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-6 rounded-[8px] px-2 text-[10px]"
                                onClick={handleSaveEdit}
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 rounded-[8px] px-2 text-[10px]"
                                onClick={handleCancelEdit}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs leading-relaxed text-foreground">
                              {memory.content}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground/70">
                                Saved note
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">
                                {new Date(memory.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {editingId !== memory.id && (
                        <div className="flex flex-col gap-1 opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            onClick={() => handleStartEdit(memory)}
                            className="rounded-[8px] border border-transparent p-1 text-muted-foreground transition-all hover:border-border/60 hover:bg-background hover:text-primary"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMemory(memory.id)}
                            className="rounded-[8px] border border-transparent p-1 text-muted-foreground transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:hover:border-red-900/50 dark:hover:bg-red-950/30"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
