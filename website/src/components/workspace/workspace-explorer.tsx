"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  KeyRound,
  Loader2,
  Pencil,
  Pin,
  Search,
  Settings2,
  Shield,
  Star,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WorkspaceCategory = "All" | "Credentials" | "Contacts" | "Projects" | "Documents" | "Browser Sessions" | "Downloads" | "Notes" | "Research" | "Calendar" | "Business" | "Settings" | "Trash";
type WorkspaceItem = {
  id: string;
  title: string;
  relativePath: string;
  category: string;
  content: string;
  excerpt: string;
  size: number;
  createdAt: string;
  updatedAt: string;
};

const categories: Array<{ label: WorkspaceCategory; icon: typeof FolderOpen }> = [
  { label: "All", icon: HardDrive },
  { label: "Credentials", icon: KeyRound },
  { label: "Contacts", icon: Users },
  { label: "Projects", icon: FolderOpen },
  { label: "Documents", icon: FileText },
  { label: "Browser Sessions", icon: WandSparkles },
  { label: "Downloads", icon: Download },
  { label: "Notes", icon: FileText },
  { label: "Research", icon: Search },
  { label: "Calendar", icon: CalendarDays },
  { label: "Business", icon: Archive },
  { label: "Settings", icon: Settings2 },
  { label: "Trash", icon: Trash2 },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryMatches(item: WorkspaceItem, category: WorkspaceCategory) {
  if (category === "All") return true;
  if (category === "Contacts") return item.category === "People";
  if (category === "Documents") return item.category === "Files";
  if (category === "Browser Sessions" || category === "Downloads" || category === "Settings" || category === "Trash") return false;
  return item.category === category;
}

export function WorkspaceExplorer({ variant = "page" }: { variant?: "page" | "panel" }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<WorkspaceCategory>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [seenAt, setSeenAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem("rearvy.workspace.favorites") || "[]"));
      setPinned(JSON.parse(localStorage.getItem("rearvy.workspace.pinned") || "[]"));
      setSeenAt(JSON.parse(localStorage.getItem(`rearvy.workspace.seen.${user?.uid || "guest"}`) || "{}"));
    } catch {
      setFavorites([]);
      setPinned([]);
    }
  }, [user?.uid]);

  const loadItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/workspace?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => null)) as { items?: WorkspaceItem[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Workspace could not be loaded.");
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      const seenKey = `rearvy.workspace.seen.${user.uid}`;
      if (localStorage.getItem(seenKey) === null) {
        const initialSeen = Object.fromEntries(nextItems.map((item) => [item.id, item.updatedAt]));
        localStorage.setItem(seenKey, JSON.stringify(initialSeen));
        setSeenAt(initialSeen);
      }
      setItems(nextItems);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Workspace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [query, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItems(), 180);
    return () => window.clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => void loadItems(), 15000);
    return () => window.clearInterval(refreshTimer);
  }, [loadItems]);

  const visibleItems = useMemo(
    () => items.filter((item) => categoryMatches(item, activeCategory)).sort((left, right) => Number(pinned.includes(right.id)) - Number(pinned.includes(left.id))),
    [activeCategory, items, pinned]
  );
  const selected = selectedId ? visibleItems.find((item) => item.id === selectedId) ?? null : null;

  function startEditing(item: WorkspaceItem) {
    setDraftContent(item.content);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftContent("");
    setIsEditing(false);
  }

  async function saveEditing() {
    if (!selected || !user || !draftContent.trim()) return;
    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ path: selected.relativePath, content: draftContent }),
      });
      const payload = (await response.json().catch(() => null)) as { item?: WorkspaceItem; error?: string } | null;
      if (!response.ok || !payload?.item) throw new Error(payload?.error || "Workspace file could not be updated.");
      setItems((current) => current.map((item) => item.id === payload.item?.id ? payload.item as WorkspaceItem : item));
      setSeenAt((current) => ({ ...current, [payload.item?.id || selected.id]: payload.item?.updatedAt || selected.updatedAt }));
      cancelEditing();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Workspace file could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  function markSeen(id: string, updatedAt: string) {
    const nextSeenAt = { ...seenAt, [id]: updatedAt };
    setSeenAt(nextSeenAt);
    localStorage.setItem(`rearvy.workspace.seen.${user?.uid || "guest"}`, JSON.stringify(nextSeenAt));
  }

  function isNew(item: WorkspaceItem) {
    const lastSeen = seenAt[item.id];
    return Boolean(lastSeen && new Date(item.updatedAt).getTime() > new Date(lastSeen).getTime()) || (!lastSeen && Object.keys(seenAt).length > 0);
  }

  function toggleStored(setter: typeof setFavorites, key: string, id: string) {
    setter((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className={cn("flex min-w-0 flex-col overflow-hidden border-border/70 bg-card/40 shadow-sm lg:flex-row", variant === "panel" ? "h-full w-full rounded-none border-0" : "min-h-[calc(100vh-7rem)] rounded-2xl border")}>
      <aside className={cn("w-full shrink-0 border-b border-border/70 bg-background/40 p-3 lg:w-56 lg:border-b-0 lg:border-r", variant === "panel" && "hidden")}>
        <div className="mb-5 flex items-center gap-3 px-2 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Shield className="h-4 w-4" /></div>
          <div><p className="text-sm font-semibold">Workspace</p><p className="text-[11px] text-muted-foreground">AI file explorer</p></div>
        </div>
        <nav className="grid grid-cols-2 gap-1 lg:block lg:space-y-0.5">
          {categories.map(({ label, icon: Icon }) => (
            <button key={label} type="button" onClick={() => setActiveCategory(label)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors", activeCategory === label ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5 shrink-0" />{label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1 text-xs text-muted-foreground"><span>Workspace</span><ChevronRight className="h-3 w-3" /><span>{activeCategory}</span></div><h1 className="mt-1 text-xl font-semibold tracking-tight">{activeCategory === "All" ? "Everything Rearvy knows" : activeCategory}</h1></div>
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace" className="h-9 rounded-lg pl-9 pr-8" />{query ? <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button> : null}</div>
        </header>
          <div className={cn("flex min-h-0 flex-1 flex-col", variant === "page" && "xl:flex-row")}>
          <div className={cn("min-w-0 flex-1 overflow-y-auto p-4 sm:p-6", selected && "hidden")}>
            <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{visibleItems.length} items <span className="mx-1">·</span> organized by Rearvy AI</p>{loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}</div>
            {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div> : null}
            {!loading && !error && visibleItems.length === 0 ? <div className="rounded-xl border border-dashed border-border p-10 text-center"><FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" /><p className="text-sm font-medium">Nothing here yet</p><p className="mt-1 text-xs text-muted-foreground">Items created, discovered, or saved by Rearvy will appear here.</p></div> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {visibleItems.map((item) => <div key={item.id} role="button" tabIndex={0} onClick={() => { setSelectedId(item.id); markSeen(item.id, item.updatedAt); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { setSelectedId(item.id); markSeen(item.id, item.updatedAt); } }} className={cn("group rounded-xl border p-4 text-left transition-all hover:border-primary/40 hover:bg-muted/30", selected?.id === item.id ? "border-primary/50 bg-primary/[0.04]" : "border-border/70 bg-background/30")}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40"><FileText className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="truncate text-[11px] text-muted-foreground">{item.relativePath}</p></div></div><div className="flex items-center gap-1"><button type="button" aria-label="Favorite" onClick={(event) => { event.stopPropagation(); toggleStored(setFavorites, "rearvy.workspace.favorites", item.id); }} className="rounded p-1 text-muted-foreground hover:text-amber-400"><Star className={cn("h-3.5 w-3.5", favorites.includes(item.id) && "fill-amber-400 text-amber-400")} /></button><button type="button" aria-label="Pin" onClick={(event) => { event.stopPropagation(); toggleStored(setPinned, "rearvy.workspace.pinned", item.id); }} className="rounded p-1 text-muted-foreground hover:text-primary"><Pin className={cn("h-3.5 w-3.5", pinned.includes(item.id) && "fill-primary text-primary")} /></button>{isNew(item) ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">New</span> : null}</div></div><div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground"><span>{item.category}</span><span>{formatDate(item.updatedAt)}</span></div></div>)}
            </div>
          </div>
          <aside className={cn("w-full shrink-0 border-t border-border/70 bg-background/30 p-4 sm:p-6 xl:border-t-0", selected ? "flex-1" : "hidden", variant === "page" && selected && "xl:border-l") }>
            {selected ? <><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Preview</p><h2 className="mt-1 text-lg font-semibold">{selected.title}</h2></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" title="Close preview" aria-label="Close preview" className="h-8 w-8" onClick={() => { cancelEditing(); setSelectedId(null); }}><X className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" title="Edit file" aria-label="Edit file" className="h-8 w-8" onClick={() => startEditing(selected)} disabled={isEditing}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStored(setFavorites, "rearvy.workspace.favorites", selected.id)}><Star className={cn("h-4 w-4", favorites.includes(selected.id) && "fill-amber-400 text-amber-400")} /></Button></div></div><div className="mb-4 flex flex-wrap gap-1.5"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">{selected.category}</span><span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">Created by Rearvy AI</span></div>{isEditing ? <div className="space-y-3"><textarea value={draftContent} onChange={(event) => setDraftContent(event.target.value)} className="min-h-[22rem] w-full resize-y rounded-xl border border-border/70 bg-background p-3 font-mono text-xs leading-5 outline-none focus:border-primary" aria-label={`Edit ${selected.title}`} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={cancelEditing} disabled={isSaving}>Cancel</Button><Button type="button" onClick={() => void saveEditing()} disabled={isSaving || !draftContent.trim()}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save changes</Button></div></div> : <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-border/70 bg-background p-3"><pre className="whitespace-pre-wrap break-words font-sans text-xs leading-5 text-foreground/85">{selected.content}</pre></div>}<dl className="mt-5 space-y-3 text-xs"><div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Created</dt><dd>{formatDate(selected.createdAt)}</dd></div><div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Updated</dt><dd>{formatDate(selected.updatedAt)}</dd></div><div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">Size</dt><dd>{formatSize(selected.size)}</dd></div></dl></> : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
