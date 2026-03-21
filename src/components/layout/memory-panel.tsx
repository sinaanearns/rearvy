"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MEMORY_UPDATED_EVENT } from "@/lib/memory-events";

interface MemoryItem {
  id: string;
  content: string;
  memory_type: string;
  importance: number;
  created_at: string;
  project_id?: string;
}

function emitMemoryUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
  }
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

  // Extract projectId from pathname
  const projectMatch = pathname?.match(/\/projects\/([a-zA-Z0-9_-]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;

  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setIsLoadingMemories(true);
    try {
      const token = await user.getIdToken();
      const url = activeProjectId
        ? `/api/dashboard/memories?project_id=${activeProjectId}`
        : "/api/dashboard/memories";
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch memories");
      const data = await response.json();
      if (data.memories) setMemories(data.memories);
    } catch (error) {
      console.error("Error fetching memories:", error);
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

      if (!response.ok) throw new Error("Failed to save memory");
      const data = await response.json();
      setMemories((prev) => [data, ...prev]);
      setNewMemory("");
      emitMemoryUpdated();
    } catch (error) {
      console.error("Error saving memory:", error);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/dashboard/memories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete memory");
      setMemories((prev) => prev.filter((m) => m.id !== id));
      emitMemoryUpdated();
    } catch (error) {
      console.error("Error deleting memory:", error);
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
      const response = await fetch(`/api/dashboard/memories/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!response.ok) throw new Error("Failed to update memory");

      setMemories((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, content: editContent.trim() } : m
        )
      );
      setEditingId(null);
      setEditContent("");
      emitMemoryUpdated();
    } catch (error) {
      console.error("Error updating memory:", error);
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col overflow-hidden h-full bg-sidebar",
        variant === "desktop"
          ? "hidden md:flex md:w-80 border-l"
          : "w-full min-w-0"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center border-b shrink-0 px-4 gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">Memory</h2>
          <p className="text-[11px] text-muted-foreground">
            {activeProjectId ? "Project notes" : "Global notes"} · {memories.length} saved
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Save
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={activeProjectId ? "Add a project note..." : "Add an important note..."}
                className="flex-1 bg-background border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
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
                className="h-8 w-8 shrink-0"
                onClick={handleSaveMemory}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {activeProjectId ? "Project Memories" : "Recent Memories"}
              </h3>
              {isLoadingMemories && (
                <span className="text-[10px] text-muted-foreground animate-pulse">
                  Loading...
                </span>
              )}
            </div>
            {memories.length === 0 && !isLoadingMemories ? (
              <div className="py-8 text-center text-muted-foreground/60 border border-dashed rounded-xl">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-[11px]">
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
                    className="group relative rounded-xl border border-border/50 bg-card p-3 transition-all hover:border-border/80"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        {editingId === memory.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-background border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-6 px-2 text-[10px]"
                                onClick={handleSaveEdit}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px]"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-foreground leading-relaxed">
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
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={() => handleStartEdit(memory)}
                            className="p-1 text-muted-foreground hover:text-primary transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMemory(memory.id)}
                            className="p-1 text-muted-foreground hover:text-red-500 transition-all"
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
