"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Laptop, Loader2, RefreshCw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getIdToken } from "@/lib/firebase/auth";
import { getLabelForSlot, PROFILE_MEMORY_SLOTS, type ProfileMemorySlot } from "@/lib/profile-memory/types";
import { cn } from "@/lib/utils";

type ProfileFact = {
  slot: ProfileMemorySlot;
  label: string;
  value: string;
  importance: number;
  tags: string[];
};

type ProfileSnapshot = {
  entries: ProfileFact[];
  updated_at?: string;
  source?: string;
};

type DesktopProfilePayload = {
  snapshot: ProfileSnapshot;
  filePath?: string | null;
};

type DesktopBridge = {
  get?: () => Promise<DesktopProfilePayload | null>;
  capture?: (options?: { authToken?: string }) => Promise<DesktopProfilePayload | null>;
  onUpdated?: (callback: (payload: DesktopProfilePayload | null) => void) => () => void;
};

const SLOT_ORDER: ProfileMemorySlot[] = [...PROFILE_MEMORY_SLOTS];

function groupFactsBySlot(facts: ProfileFact[]) {
  const map = new Map<ProfileMemorySlot, ProfileFact[]>();
  for (const fact of facts) {
    const list = map.get(fact.slot) ?? [];
    list.push(fact);
    map.set(fact.slot, list);
  }
  return map;
}

function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const electron = (window as Window & { electron?: { deviceProfile?: DesktopBridge } }).electron;
  return electron?.deviceProfile ?? null;
}

export function ProfileMemoryCard() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await fetch("/api/profile/memory", { headers, cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load profile memory (${response.status})`);
      }
      const payload = (await response.json()) as { snapshot?: ProfileSnapshot };
      setSnapshot(payload.snapshot ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load profile memory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge?.onUpdated) return;
    const unsubscribe = bridge.onUpdated((payload) => {
      if (payload?.snapshot) {
        setSnapshot({
          entries: payload.snapshot.entries ?? [],
          updated_at: payload.snapshot.updated_at,
          source: payload.snapshot.source,
        });
      }
    });
    return unsubscribe;
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getIdToken();
      const response = await fetch("/api/profile/memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userText: draft.trim() }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save profile memory (${response.status})`);
      }
      const payload = (await response.json()) as { snapshot?: ProfileSnapshot; added?: ProfileFact[] };
      if (payload.snapshot) {
        setSnapshot(payload.snapshot);
      }
      setDraft("");
      const addedCount = payload.added?.length ?? 0;
      setInfo(addedCount > 0 ? `Saved ${addedCount} new memory fact${addedCount === 1 ? "" : "s"}.` : "No new memory facts detected.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile memory.");
    } finally {
      setSaving(false);
    }
  }, [draft, router]);

  const handleSyncFromDesktop = useCallback(async () => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setError("This feature requires the Rearvy desktop app.");
      return;
    }
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      const token = await getIdToken();
      let payload: DesktopProfilePayload | null = null;
      if (bridge.capture) {
        payload = await bridge.capture({ authToken: token || undefined });
      } else if (bridge.get) {
        payload = await bridge.get();
      }
      if (!payload?.snapshot) {
        throw new Error("Desktop app did not return a profile snapshot.");
      }
      const response = await fetch("/api/desktop/profile-memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rearvy-desktop": "1",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ entries: payload.snapshot.entries }),
      });
      if (!response.ok) {
        throw new Error(`Failed to sync desktop profile (${response.status})`);
      }
      const result = (await response.json()) as { snapshot?: ProfileSnapshot; added?: ProfileFact[] };
      if (result.snapshot) {
        setSnapshot(result.snapshot);
      }
      const addedCount = result.added?.length ?? 0;
      setInfo(addedCount > 0 ? `Synced ${addedCount} new tool${addedCount === 1 ? "" : "s"} from desktop.` : "Desktop tools already up to date.");
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Failed to sync desktop profile.");
    } finally {
      setSyncing(false);
    }
  }, [router]);

  const groupedFacts = snapshot ? groupFactsBySlot(snapshot.entries) : new Map<ProfileMemorySlot, ProfileFact[]>();
  const hasEntries = (snapshot?.entries?.length ?? 0) > 0;

  const wellKnownSet = new Set<string>(SLOT_ORDER);
  const dynamicSlots = Array.from(groupedFacts.keys())
    .filter((slot) => !wellKnownSet.has(slot))
    .sort((a, b) => a.localeCompare(b));
  const allSlots = [...SLOT_ORDER, ...dynamicSlots];

  return (
    <Card className="border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Laptop className="h-4 w-4" /> Device &amp; software memory
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture installed apps, code editors, AI assistants, browsers, and the rest of the stack once.
              The model reuses this memory on the next chat instead of re-asking.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadSnapshot()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => void handleSyncFromDesktop()} disabled={syncing || loading}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Sync from desktop
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            {info}
          </p>
        ) : null}

        <div className="space-y-3">
          {allSlots.map((slot) => {
            const facts = groupedFacts.get(slot) ?? [];
            if (!wellKnownSet.has(slot) && facts.length === 0) return null;

            return (
              <div key={slot} className="rounded-md border border-border/60 bg-background/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">{getLabelForSlot(slot)}</div>
                  <Badge variant="secondary">{facts.length}</Badge>
                </div>
                {facts.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">No tools saved yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {facts.map((fact) => (
                      <li
                        key={`${slot}-${fact.value}`}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border border-border/60 bg-card/85 px-2.5 py-1 text-xs",
                        )}
                      >
                        <span className="font-medium">{fact.value}</span>
                        {fact.tags.includes("user-confirmed") ? (
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">confirmed</Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-md border border-dashed border-border/70 bg-background/40 p-3">
          <label htmlFor="profile-memory-draft" className="text-sm font-medium text-foreground">
            Tell the model about your tools
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Example: "I use DaVinci Resolve for editing, VS Code + Codex for code, and Chrome for
            browsing." The model will save each tool under the right slot.
          </p>
          <Textarea
            id="profile-memory-draft"
            className="mt-2 min-h-[88px]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={hasEntries ? "Add or correct a tool" : "Describe the apps you use most often"}
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !draft.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to memory
            </Button>
          </div>
        </div>

        {snapshot?.updated_at ? (
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(snapshot.updated_at).toLocaleString()} from {snapshot.source ?? "merge"}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
