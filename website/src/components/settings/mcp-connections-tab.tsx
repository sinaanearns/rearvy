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
import { Badge } from "@/components/ui/badge";
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
  Server,
  Globe,
  Monitor,
  Activity,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import { AppLogo } from "@/components/marketplace/marketplace-panel";

const log = createClientLogger("McpConnectionsTab");

type McpServer = {
  id: string;
  name: string;
  type: "stdio" | "sse" | "streamable_http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  is_active: boolean;
  capabilities?: string[];
  permissions?: string[];
  latency_ms?: number;
  health_status?: "healthy" | "degraded" | "unreachable" | "unknown";
  last_tested_at?: string;
};

export type McpConnectionsTabProps = {
  isBusinessView?: boolean;
};

export function McpConnectionsTab({ isBusinessView = false }: McpConnectionsTabProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingServer, setEditingServer] = useState<Partial<McpServer> | null>(null);

  const fetchServers = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch("/api/mcp/servers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch servers");
      }

      const allServers: McpServer[] = data.servers || [];
      const filtered = allServers.filter(
        (s) =>
          !s.name.toLowerCase().includes("github") &&
          !s.command?.toLowerCase().includes("github") &&
          !(Array.isArray(s.args) && s.args.some((a) => a.toLowerCase().includes("github")))
      );
      setServers(filtered);
    } catch (error) {
      log.error("Failed to fetch servers:", error);
      toast.error(getErrorMessage(error, "Failed to fetch connected apps"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleTestConnection = async (server: McpServer) => {
    setTestingId(server.id);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/mcp/servers/${encodeURIComponent(server.id)}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`"${server.name}" connected cleanly! Latency: ${data.latency_ms}ms, Capabilities: ${data.capabilities.length}`);
        fetchServers();
      } else {
        toast.error(`Connection failed: ${data.error || "Unreachable"}`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Test failed"));
    } finally {
      setTestingId(null);
    }
  };

  const handleSave = async () => {
    if (!editingServer?.name || !editingServer?.type) {
      toast.error("Please fill in required fields");
      return;
    }
    if (editingServer.type === "stdio" ? !editingServer.command?.trim() : !editingServer.url?.trim()) {
      toast.error(
        editingServer.type === "stdio"
          ? "A local app connection requires a command."
          : "A web app connection requires a URL."
      );
      return;
    }

    setIsSaving(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Authentication error");
        return;
      }

      const method = editingServer.id ? "PATCH" : "POST";
      const url = editingServer.id
        ? `/api/mcp/servers/${encodeURIComponent(editingServer.id)}`
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
        toast.success(editingServer.id ? "App updated" : "App connected");
        setIsDialogOpen(false);
        fetchServers();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save app integration");
      }
    } catch (error) {
      log.error("Failed to save server:", error);
      toast.error(getErrorMessage(error, "An error occurred"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this app?")) return;

    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(`/api/mcp/servers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success("App disconnected");
        fetchServers();
      } else {
        toast.error("Failed to disconnect app");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to disconnect app"));
    }
  };

  const sectionTitle = isBusinessView ? "Your Business MCP Servers" : "Connected Apps & Tool Integrations";
  const sectionDesc = isBusinessView
    ? "Connect custom tools, internal APIs, and Model Context Protocol servers to your Rearvy connectivity layer."
    : "Connect external applications and tools so Rearvy can coordinate their approved capabilities for your account.";
  const addButtonLabel = isBusinessView ? "Add MCP Server" : "Connect App";

  return (
    <div className="space-y-6">
      {!isBusinessView && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{sectionTitle}</h2>
            <p className="text-sm text-muted-foreground">{sectionDesc}</p>
          </div>
          <Button onClick={() => { setEditingServer({ type: "streamable_http", args: [] }); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            {addButtonLabel}
          </Button>
        </div>
      )}



      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : servers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No connected apps found.</p>
            <Button variant="link" className="mt-2 h-auto p-0" onClick={() => { setEditingServer({ type: "streamable_http", args: [] }); setIsDialogOpen(true); }}>
              Connect your first app
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {servers.map((server) => (
            <Card key={server.id} className="relative overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                      <AppLogo appId={server.name} className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base truncate max-w-[160px]">{server.name}</CardTitle>
                      {server.health_status === "healthy" ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTestConnection(server)} disabled={testingId === server.id}>
                      {testingId === server.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5 text-indigo-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingServer(server); setIsDialogOpen(true); }}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(server.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs font-medium">
                  {isBusinessView ? `${server.type.toUpperCase()} MCP Server` : "App Integration"} {server.latency_ms ? `• ${server.latency_ms}ms` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="text-xs text-muted-foreground truncate">
                  {server.type === "stdio" ? <code>{server.command} {server.args?.join(" ")}</code> : server.url}
                </div>

                {server.capabilities && server.capabilities.length > 0 ? (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {server.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                        <Zap className="mr-1 h-2.5 w-2.5 text-amber-500" />
                        {cap}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingServer?.id ? "Edit Connected App" : "Connect New App"}</DialogTitle>
            <DialogDescription>
              Provide your app connection URL or local command.
            </DialogDescription>
          </DialogHeader>
          <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); void handleSave(); }} className="grid gap-4 py-3">
            <div className="grid gap-2">
              <Label htmlFor="mcp-app-name-input">App Name</Label>
              <Input
                id="mcp-app-name-input"
                name="mcp_name_no_autofill"
                value={editingServer?.name || ""}
                onChange={(e) => setEditingServer({ ...editingServer, name: e.target.value })}
                placeholder="e.g. Canva, Gmail, Salesforce"
                autoComplete="off"
                data-1password-ignore="true"
                data-bwignore="true"
                data-lpignore="true"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Connection Mode</Label>
              <Select
                value={editingServer?.type || "streamable_http"}
                onValueChange={(value: "stdio" | "sse" | "streamable_http") =>
                  setEditingServer({ ...editingServer, type: value })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="streamable_http">Web Service (Recommended)</SelectItem>
                  <SelectItem value="sse">Legacy Web Service (SSE)</SelectItem>
                  <SelectItem value="stdio">Local Process (Command)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingServer?.type === "stdio" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="mcp-cmd-input">Command</Label>
                  <Input
                    id="mcp-cmd-input"
                    name="mcp_cmd_no_autofill"
                    value={editingServer?.command || ""}
                    onChange={(e) => setEditingServer({ ...editingServer, command: e.target.value })}
                    placeholder="e.g. npx"
                    autoComplete="off"
                    data-1password-ignore="true"
                    data-bwignore="true"
                    data-lpignore="true"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mcp-args-input">Arguments (comma separated)</Label>
                  <Input
                    id="mcp-args-input"
                    name="mcp_args_no_autofill"
                    value={editingServer?.args?.join(", ") || ""}
                    onChange={(e) =>
                      setEditingServer({
                        ...editingServer,
                        args: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="e.g. -y, @modelcontextprotocol/server-sqlite"
                    autoComplete="off"
                    data-1password-ignore="true"
                    data-bwignore="true"
                    data-lpignore="true"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="mcp-url-input">App Connection URL</Label>
                <Input
                  id="mcp-url-input"
                  name="mcp_url_no_autofill"
                  value={editingServer?.url || ""}
                  onChange={(e) => setEditingServer({ ...editingServer, url: e.target.value })}
                  placeholder={
                    editingServer?.type === "streamable_http"
                      ? "https://app.example.com/mcp"
                      : "https://app.example.com/sse"
                  }
                  autoComplete="off"
                  data-1password-ignore="true"
                  data-bwignore="true"
                  data-lpignore="true"
                />
              </div>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingServer?.id ? "Save Changes" : "Connect App"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
