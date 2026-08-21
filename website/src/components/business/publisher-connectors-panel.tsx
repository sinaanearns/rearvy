"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ConnectorStatus =
  | "draft"
  | "sandbox"
  | "in_review"
  | "verified"
  | "published"
  | "suspended";

interface PublisherConnector {
  id: string;
  connector_id: string;
  connector_version: string;
  visibility: "private" | "catalog";
  lifecycle_status: ConnectorStatus;
  contract_validation?: {
    passed?: boolean;
    errors?: string[];
  };
  manifest?: {
    displayName?: string;
    capabilities?: unknown[];
  };
}

interface SandboxDraft {
  endpoint: string;
  testInstructions: string;
}

const SAMPLE_MANIFEST = `{
  "schemaVersion": "1.0",
  "id": "example-platform",
  "displayName": "Example Platform",
  "description": "Approved capabilities exposed to Rearvy workflows.",
  "version": "1.0.0",
  "publisher": "Example Publisher",
  "transport": "mcp",
  "privacy": "private",
  "capabilities": [
    {
      "id": "example.search",
      "name": "Search items",
      "description": "Search items the connected user can access.",
      "risk": "read",
      "approvalRequired": false,
      "inputSchema": {
        "type": "object",
        "properties": { "query": { "type": "string" } },
        "required": ["query"]
      },
      "outputSchema": { "type": "object" }
    }
  ],
  "requiredScopes": ["example.items.read"],
  "webhookEvents": []
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function statusLabel(status: ConnectorStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeConnector(value: unknown): PublisherConnector | null {
  if (!isRecord(value)) return null;
  const status = value.lifecycle_status;
  if (
    status !== "draft" &&
    status !== "sandbox" &&
    status !== "in_review" &&
    status !== "verified" &&
    status !== "published" &&
    status !== "suspended"
  ) {
    return null;
  }
  if (typeof value.id !== "string" || typeof value.connector_id !== "string") return null;

  return value as unknown as PublisherConnector;
}

export function PublisherConnectorsPanel() {
  const { user } = useAuth();
  const [manifestJson, setManifestJson] = useState(SAMPLE_MANIFEST);
  const [visibility, setVisibility] = useState<"private" | "catalog">("private");
  const [connectors, setConnectors] = useState<PublisherConnector[]>([]);
  const [sandboxDrafts, setSandboxDrafts] = useState<Record<string, SandboxDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadConnectors = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/business/connectors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "Unable to load connector drafts."));
      const items = isRecord(payload) && Array.isArray(payload.connectors) ? payload.connectors : [];
      setConnectors(items.flatMap((item) => {
        const connector = normalizeConnector(item);
        return connector ? [connector] : [];
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load connector drafts.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadConnectors();
  }, [loadConnectors]);

  const saveDraft = async () => {
    if (!user) return;
    let manifest: unknown;
    try {
      manifest = JSON.parse(manifestJson);
    } catch {
      toast.error("The manifest must be valid JSON.");
      return;
    }

    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/business/connectors", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ manifest, visibility }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const details = isRecord(payload) && Array.isArray(payload.details)
          ? ` ${payload.details.filter((item): item is string => typeof item === "string").join(" ")}`
          : "";
        throw new Error(`${readError(payload, "Unable to save connector draft.")}${details}`);
      }
      const created = normalizeConnector(payload);
      if (created) setConnectors((current) => [created, ...current]);
      toast.success("Connector draft saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save connector draft.");
    } finally {
      setIsSaving(false);
    }
  };

  const runLifecycleAction = async (
    connector: PublisherConnector,
    action: "validate_contract" | "submit_review" | "return_to_draft"
  ) => {
    if (!user) return;
    setActionId(connector.id);
    try {
      const token = await user.getIdToken();
      const sandboxDraft = sandboxDrafts[connector.id] ?? { endpoint: "", testInstructions: "" };
      const response = await fetch(`/api/business/connectors/${encodeURIComponent(connector.id)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          sandbox_submission:
            action === "submit_review"
              ? {
                  endpoint: sandboxDraft.endpoint,
                  test_instructions: sandboxDraft.testInstructions,
                }
              : undefined,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(readError(payload, "Unable to update connector."));
      const updated = normalizeConnector(payload);
      if (updated) {
        setConnectors((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
      }
      toast.success(
        action === "validate_contract"
          ? "Contract validated. Sandbox details can now be submitted."
          : action === "submit_review"
            ? "Connector submitted for Rearvy review."
            : "Connector returned to draft."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update connector.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b0b0b]/80 p-6 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="border-b border-white/10 pb-4">
        <h2 className="text-lg font-bold text-white">Submit the connector contract</h2>
        <p className="mt-1 text-xs leading-5 text-white/55">
          Submit only the bounded connector manifest. Do not paste source code, API keys, access tokens, or customer data.
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="space-y-2 text-xs font-semibold text-white/75">
          rearvy.manifest.json
          <Textarea
            value={manifestJson}
            onChange={(event) => setManifestJson(event.target.value)}
            rows={18}
            spellCheck={false}
            className="min-h-80 resize-y border-white/10 bg-black/60 font-mono text-xs leading-5 text-white placeholder:text-white/30 focus-visible:border-white/35 focus-visible:ring-white/10"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="space-y-2 text-xs font-semibold text-white/75">
            Intended visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "private" | "catalog")}
              className="block h-10 rounded-lg border border-white/10 bg-[#050505] px-3 text-xs font-normal text-white outline-none focus:border-white/35"
            >
              <option value="private">Private to approved users</option>
              <option value="catalog">Verified catalog after review</option>
            </select>
          </label>
          <Button
            type="button"
            onClick={() => void saveDraft()}
            disabled={isSaving}
            className="bg-white font-semibold text-black hover:bg-white/90"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Save connector draft
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <h3 className="text-sm font-semibold text-white">Connector lifecycle</h3>
        <p className="mt-1 text-xs text-white/50">
          Publishers can create drafts and request review. Only Rearvy review can verify or publish a connector.
        </p>

        {isLoading ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-white/55">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading connectors…
          </div>
        ) : connectors.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-xs text-white/50">
            No connector versions submitted yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {connectors.map((connector) => {
              const draft = sandboxDrafts[connector.id] ?? { endpoint: "", testInstructions: "" };
              const isActing = actionId === connector.id;
              return (
                <article key={connector.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {connector.manifest?.displayName || connector.connector_id}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        {connector.connector_id} · v{connector.connector_version} · {connector.manifest?.capabilities?.length ?? 0} capabilities
                      </p>
                    </div>
                    <Badge className="w-fit border-white/15 bg-white/[0.06] text-white/70">
                      {statusLabel(connector.lifecycle_status)}
                    </Badge>
                  </div>

                  {connector.lifecycle_status === "sandbox" ? (
                    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4">
                      <Input
                        value={draft.endpoint}
                        onChange={(event) =>
                          setSandboxDrafts((current) => ({
                            ...current,
                            [connector.id]: { ...draft, endpoint: event.target.value },
                          }))
                        }
                        placeholder="Sandbox endpoint, e.g. https://sandbox.example.com/mcp"
                        className="border-white/10 bg-black/50 text-xs text-white placeholder:text-white/30"
                      />
                      <Textarea
                        value={draft.testInstructions}
                        onChange={(event) =>
                          setSandboxDrafts((current) => ({
                            ...current,
                            [connector.id]: { ...draft, testInstructions: event.target.value },
                          }))
                        }
                        placeholder="Or provide local bridge / desktop test instructions. Never include credentials."
                        className="border-white/10 bg-black/50 text-xs text-white placeholder:text-white/30"
                      />
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {connector.lifecycle_status === "draft" ? (
                      <Button
                        size="sm"
                        onClick={() => void runLifecycleAction(connector, "validate_contract")}
                        disabled={isActing}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        {isActing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-2 h-3.5 w-3.5" />}
                        Validate contract
                      </Button>
                    ) : null}
                    {connector.lifecycle_status === "sandbox" ? (
                      <Button
                        size="sm"
                        onClick={() => void runLifecycleAction(connector, "submit_review")}
                        disabled={isActing}
                        className="bg-white text-black hover:bg-white/90"
                      >
                        {isActing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                        Submit for review
                      </Button>
                    ) : null}
                    {connector.lifecycle_status === "sandbox" || connector.lifecycle_status === "in_review" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void runLifecycleAction(connector, "return_to_draft")}
                        disabled={isActing}
                        className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                      >
                        <Clock className="mr-2 h-3.5 w-3.5" /> Return to draft
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
