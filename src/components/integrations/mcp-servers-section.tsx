"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Settings2,
  Loader2,
  AlertCircle,
  Puzzle,
  Server,
  Globe,
  Monitor,
} from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";
import { toast } from "sonner";

function isLocalhostMcpUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) {
    return false;
  }

  try {
    const hostname = new URL(rawUrl.trim()).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function isNgrokFreeAppUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) {
    return false;
  }

  try {
    return new URL(rawUrl.trim()).hostname.toLowerCase().endsWith(".ngrok-free.app");
  } catch {
    return false;
  }
}

type McpServer = {
  id: string;
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  is_active: boolean;
};

type DesktopMcpServerConfig = {
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

type DesktopMcpConfig = {
  mcp_servers?: DesktopMcpServerConfig[];
  servers?: DesktopMcpServerConfig[];
};

export function McpServersSection() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingServer, setEditingServer] = useState<Partial<McpServer> | null>(null);
  const [desktopConfig, setDesktopConfig] = useState<DesktopMcpConfig | null>(null);
  const [isImportingConfig, setIsImportingConfig] = useState(false);
  const editedUrl = editingServer?.url?.trim() || "";
  const showLocalhostUrlWarning = editingServer?.type === "sse" && isLocalhostMcpUrl(editedUrl);
  const showNgrokHint = editingServer?.type === "sse" && !showLocalhostUrlWarning;
  const showNgrokDetected = editingServer?.type === "sse" && isNgrokFreeAppUrl(editedUrl);

  const fetchServers = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch("/api/mcp/servers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (error) {
      console.error("Failed to fetch MCP servers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();

    let removeDesktopConfigListener: (() => void) | undefined;

    if (typeof window !== "undefined" && window.electron?.onDesktopMcpConfig) {
      removeDesktopConfigListener = window.electron.onDesktopMcpConfig((config) => {
        setDesktopConfig(config);
      });
    }

    if (typeof window !== "undefined" && window.electron?.requestDesktopMcpConfig) {
      void window.electron.requestDesktopMcpConfig().then((config) => {
        if (config) {
          setDesktopConfig(config);
        }
      });
    }

    return () => {
      removeDesktopConfigListener?.();
    };
  }, []);

  const handleImportDesktopConfig = async () => {
    const configServers = desktopConfig?.mcp_servers || desktopConfig?.servers || [];
    if (!configServers.length) {
      toast.error("No desktop MCP servers found in config.");
      return;
    }

    const existingNames = new Set(servers.map((server) => server.name));
    const serversToImport = configServers.filter(
      (server) => server.name && server.type && !existingNames.has(server.name)
    );

    if (!serversToImport.length) {
      toast.error("No new desktop MCP servers to import.");
      return;
    }

    setIsImportingConfig(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Unable to authenticate desktop config import.");
        return;
      }

      const importRequests = serversToImport.map((server) =>
        fetch("/api/mcp/servers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: server.name,
            type: server.type,
            command: server.command || null,
            args: server.args || [],
            env: server.env || {},
            url: server.url || null,
          }),
        })
      );

      const responses = await Promise.all(importRequests);
      const successCount = responses.filter((res) => res.ok).length;

      if (successCount > 0) {
        toast.success(`Imported ${successCount} desktop MCP server${successCount === 1 ? "" : "s"}`);
        fetchServers();
      } else {
        toast.error("Failed to import desktop MCP servers.");
      }
    } catch (error) {
      console.error("Desktop config import error:", error);
      toast.error("Failed to import desktop MCP config.");
    } finally {
      setIsImportingConfig(false);
    }
  };

  const handleSave = async () => {
    if (!editingServer?.name || !editingServer?.type) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);
    try {
      const token = await getIdToken();
      const method = editingServer.id ? "PATCH" : "POST";
      const url = editingServer.id 
        ? `/api/mcp/servers/${editingServer.id}` 
        : "/api/mcp/servers";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingServer),
      });

      if (res.ok) {
        toast.success(editingServer.id ? "Server updated" : "Server added");
        setIsDialogOpen(false);
        fetchServers();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to save server");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this MCP server?")) return;

    try {
      const token = await getIdToken();
      const res = await fetch(`/api/mcp/servers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success("Server deleted");
        fetchServers();
      }
    } catch (error) {
      toast.error("Failed to delete server");
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold">Model Context Protocol (MCP)</h2>
        </div>
        <Button size="sm" onClick={() => { setEditingServer({ type: "stdio", args: [] }); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add MCP Server
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Extend the AI&apos;s capabilities by connecting MCP servers. Stdio servers work in local/desktop mode, while SSE servers work everywhere.
      </p>

      {desktopConfig?.mcp_servers?.length || desktopConfig?.servers?.length ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
          <div className="mb-2 font-semibold">Desktop config detected</div>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
            A local desktop MCP config file was found. You can import these server definitions into Rearvy.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleImportDesktopConfig} disabled={isImportingConfig}>
              {isImportingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Import desktop config
            </Button>
            <span className="text-xs text-muted-foreground">
              {desktopConfig?.mcp_servers?.length || desktopConfig?.servers?.length} server(s) available
            </span>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : servers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No MCP servers configured yet.</p>
            <Button variant="link" className="mt-2 h-auto p-0" onClick={() => { setEditingServer({ type: "stdio", args: [] }); setIsDialogOpen(true); }}>
              Add your first server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {servers.map((server) => (
            <Card key={server.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {server.type === "stdio" ? (
                      <Monitor className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Globe className="h-4 w-4 text-sky-500" />
                    )}
                    <CardTitle className="text-base truncate max-w-[200px]">{server.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingServer(server); setIsDialogOpen(true); }}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(server.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs uppercase tracking-wider">
                  {server.type} server
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {server.type === "stdio" ? (
                    <div className="truncate">
                      <code className="rounded bg-muted px-1 py-0.5">{server.command}</code> {server.args?.join(" ")}
                    </div>
                  ) : (
                    <div className="truncate text-sky-600 dark:text-sky-400">
                      {server.url}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingServer?.id ? "Edit MCP Server" : "Add MCP Server"}</DialogTitle>
            <DialogDescription>
              Configure an MCP server to extend the AI&apos;s capabilities.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Friendly Name</Label>
              <Input
                id="name"
                value={editingServer?.name || ""}
                onChange={(e) => setEditingServer({ ...editingServer, name: e.target.value })}
                placeholder="e.g. SQLite Tools"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Transport Type</Label>
              <Select
                value={editingServer?.type || "stdio"}
                onValueChange={(value: "stdio" | "sse") => setEditingServer({ ...editingServer, type: value })}
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">Stdio (Local Process)</SelectItem>
                  <SelectItem value="sse">SSE (Server-Sent Events)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingServer?.type === "stdio" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="command">Command</Label>
                  <Input
                    id="command"
                    value={editingServer?.command || ""}
                    onChange={(e) => setEditingServer({ ...editingServer, command: e.target.value })}
                    placeholder="e.g. npx"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="args">Arguments (comma separated)</Label>
                  <Input
                    id="args"
                    value={editingServer?.args?.join(", ") || ""}
                    onChange={(e) => setEditingServer({ ...editingServer, args: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    placeholder="e.g. -y, @modelcontextprotocol/server-sqlite, --db, ./data.db"
                  />
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Environment Restriction
                  </div>
                  <p className="mt-1">
                    Stdio servers only work when running Rearvy locally or in the desktop app. 
                    They will not be available in the hosted web version.
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="url">Server URL</Label>
                <Input
                  id="url"
                  value={editingServer?.url || ""}
                  onChange={(e) => setEditingServer({ ...editingServer, url: e.target.value })}
                  placeholder="https://mcp-server.example.com/sse"
                />
                {showNgrokHint ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Local server tip
                    </div>
                    <p className="mt-1 leading-5">
                      If your MCP server runs on your own machine, expose the local port with ngrok and paste the public HTTPS URL here.
                      Rearvy on Vercel cannot reach localhost directly.
                    </p>
                    <p className="mt-2 text-[11px] text-sky-600/90 dark:text-sky-300/80">
                      Example: run ngrok for the local MCP port, then use the generated https://...ngrok-free.app URL in this field.
                    </p>
                  </div>
                ) : null}
                {showLocalhostUrlWarning ? (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Localhost URL warning
                    </div>
                    <p className="mt-1 leading-5">
                      Localhost URLs won&apos;t work in production. Use ngrok to expose your local MCP server, then paste the public URL here.
                    </p>
                  </div>
                ) : null}
                {showNgrokDetected ? (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    ngrok URL detected. Rearvy will add the browser-warning bypass header automatically.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingServer?.id ? "Save Changes" : "Add Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
