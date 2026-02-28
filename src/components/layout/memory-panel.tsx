"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface MemoryItem {
  id: string;
  content: string;
  memory_type: string;
  importance: number;
  created_at: string;
}

export function MemoryPanel() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);

  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setIsLoadingMemories(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dashboard/memories", {
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
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMemories();
    }
  }, [user, fetchMemories]);

  const handleSaveMemory = async () => {
    if (!newMemory.trim() || !user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dashboard/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: newMemory.trim(),
          memory_type: "fact",
          importance: 5,
        }),
      });

      if (!response.ok) throw new Error("Failed to save memory");
      const data = await response.json();
      setMemories((prev) => [data, ...prev]);
      setNewMemory("");
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
    } catch (error) {
      console.error("Error deleting memory:", error);
    }
  };

  return (
    <aside className="hidden md:flex md:w-80 flex-col border-l bg-sidebar overflow-hidden h-full">
      {/* Header */}
      <div className="flex h-14 items-center border-b shrink-0 px-4 gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Brain className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">Memory</h2>
          <p className="text-[11px] text-muted-foreground">
            {memories.length} saved
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
                placeholder="Add a fact or preference..."
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
                Recent Memories
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
                  No memories saved yet. AI will save important facts here, or you can add them manually.
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
                        <p className="text-xs text-foreground leading-relaxed">
                          {memory.content}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">
                            {memory.memory_type}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">
                            {new Date(memory.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
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
