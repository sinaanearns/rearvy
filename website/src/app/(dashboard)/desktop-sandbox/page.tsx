"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  Bell,
  CheckCircle2,
  Chrome,
  Cpu,
  FileText,
  FolderOpen,
  Monitor,
  MousePointer2,
  Play,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Usb,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WorkspaceScope = { mode: "folder" | "full-access" | "bypass"; path: string };
type CheckStatus = "idle" | "running" | "success" | "error" | "unavailable";
type BaseDesktopBridge = NonNullable<Window["electron"]>;
type DesktopBridge = BaseDesktopBridge & {
  getCapabilities?: () => Promise<DesktopCapabilities>;
  workspace?: {
    getScope: () => Promise<WorkspaceScope>;
    setScope: (scope: WorkspaceScope) => Promise<WorkspaceScope>;
    useSandbox?: () => Promise<WorkspaceScope>;
    pickFolder: () => Promise<WorkspaceScope>;
  };
  browser?: {
    getConnectionStatus: () => Promise<DesktopBrowserConnectionStatus>;
  };
  device?: {
    listSerialPorts: () => Promise<unknown[]>;
  };
};

type SandboxCheck = {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  detail: string;
};

const SANDBOX_PROBE_FILE = "rearvy-sandbox-probe.txt";

const INITIAL_CHECKS: SandboxCheck[] = [
  {
    id: "workspace",
    label: "Sandbox folder",
    description: "Creates and selects the local Rearvy Sandbox folder.",
    status: "idle",
    detail: "Not selected",
  },
  {
    id: "file",
    label: "File read/write",
    description: "Writes and reads a small probe file inside the sandbox only.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "screen",
    label: "Screen capture",
    description: "Checks the desktop screenshot bridge without saving anything.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "maria",
    label: "Maria readiness",
    description: "Verifies the local Maria bridge, shortcuts, and runtime state.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "browser",
    label: "Browser relay",
    description: "Checks direct browser and extension relay connectivity.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "local-api",
    label: "Local API",
    description: "Confirms the private desktop API port is available.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "device",
    label: "Device bridge",
    description: "Lists serial devices through the sandboxed desktop bridge.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "notification",
    label: "Notification",
    description: "Sends a harmless local desktop notification.",
    status: "idle",
    detail: "Waiting",
  },
  {
    id: "terminal",
    label: "Terminal probe",
    description: "Runs a one-line echo command with the sandbox as working folder.",
    status: "idle",
    detail: "Waiting",
  },
];

const checkIcons: Record<string, ElementType> = {
  workspace: FolderOpen,
  file: FileText,
  screen: Monitor,
  maria: MousePointer2,
  browser: Chrome,
  "local-api": Cpu,
  device: Usb,
  notification: Bell,
  terminal: Terminal,
};

function getElectronBridge(): DesktopBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.electron ?? null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

function joinDesktopPath(basePath: string, fileName: string) {
  const separator = basePath.includes("\\") ? "\\" : "/";
  return `${basePath.replace(/[\\/]+$/, "")}${separator}${fileName}`;
}

function summarizeValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStatusTone(status: CheckStatus) {
  if (status === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "error") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (status === "running") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }

  if (status === "unavailable") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-slate-700 bg-slate-900 text-slate-300";
}

function getCapabilityState(value: unknown) {
  return value ? "Available" : "Unavailable";
}

export default function DesktopSandboxPage() {
  const [checks, setChecks] = useState<SandboxCheck[]>(INITIAL_CHECKS);
  const [capabilities, setCapabilities] = useState<DesktopCapabilities | null>(null);
  const [scope, setScope] = useState<WorkspaceScope | null>(null);
  const [bridgeState, setBridgeState] = useState<"checking" | "browser" | "ready">("checking");
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [screenPreview, setScreenPreview] = useState<string | null>(null);
  const [terminalLog, setTerminalLog] = useState<string[]>([]);

  const updateCheck = useCallback((id: string, patch: Partial<SandboxCheck>) => {
    setChecks((currentChecks) =>
      currentChecks.map((check) => (check.id === id ? { ...check, ...patch } : check))
    );
  }, []);

  const refreshDesktopState = useCallback(async () => {
    const electron = getElectronBridge();
    if (!electron) {
      setBridgeState("browser");
      setCapabilities(null);
      setScope(null);
      return;
    }

    setBridgeState("ready");

    const [nextCapabilities, nextScope] = await Promise.all([
      electron.getCapabilities?.().catch((error: unknown) => ({ error: getErrorMessage(error) })),
      electron.workspace?.getScope?.().catch(() => null),
    ]);

    setCapabilities(nextCapabilities ?? null);
    setScope(nextScope ?? null);
  }, []);

  useEffect(() => {
    void refreshDesktopState();
    window.addEventListener("rearvy-electron-ready", refreshDesktopState);

    return () => {
      window.removeEventListener("rearvy-electron-ready", refreshDesktopState);
    };
  }, [refreshDesktopState]);

  useEffect(() => {
    const unsubscribeOutput = window.electron?.terminal?.onOutput?.((entry) => {
      setTerminalLog((currentLog) => [
        ...currentLog.slice(-5),
        `${entry.type}: ${String(entry.data || "").trim()}`,
      ].filter(Boolean));
    });
    const unsubscribeStatus = window.electron?.terminal?.onStatusChange?.((entry) => {
      setTerminalLog((currentLog) => [
        ...currentLog.slice(-5),
        `status: ${entry.status}${typeof entry.code === "number" ? ` (${entry.code})` : ""}`,
      ]);
    });

    return () => {
      unsubscribeOutput?.();
      unsubscribeStatus?.();
    };
  }, []);

  const sandboxPath = capabilities?.sandbox?.path ?? "";
  const activeSandboxPath = scope?.mode === "folder" && scope.path ? scope.path : "";
  const isSandboxSelected = Boolean(
    sandboxPath && activeSandboxPath && sandboxPath.toLowerCase() === activeSandboxPath.toLowerCase()
  );

  const capabilityRows = useMemo(
    () => [
      ["Bridge", bridgeState === "ready" ? "Ready" : bridgeState === "browser" ? "Browser only" : "Checking"],
      ["App version", capabilities?.appVersion ?? "Unknown"],
      ["Local API", capabilities?.localApi?.available ? `Port ${capabilities.localApi.port}` : "Unavailable"],
      ["Automation", getCapabilityState(capabilities?.automation)],
      ["Maria", getCapabilityState(capabilities?.maria)],
      ["Browser relay", getCapabilityState(capabilities?.browser)],
      ["Terminal", getCapabilityState(capabilities?.terminal)],
      ["Sandbox path", sandboxPath || "Unknown until desktop bridge is ready"],
    ],
    [bridgeState, capabilities, sandboxPath]
  );

  async function activateSandboxScope() {
    const electron = getElectronBridge();
    const workspace = electron?.workspace;

    if (!workspace) {
      throw new Error("Desktop workspace bridge is unavailable.");
    }

    updateCheck("workspace", {
      status: "running",
      detail: "Creating or selecting the sandbox folder",
    });

    const nextScope =
      typeof workspace.useSandbox === "function"
        ? await workspace.useSandbox()
        : sandboxPath
          ? await workspace.setScope({ mode: "folder", path: sandboxPath })
          : await workspace.pickFolder();

    setScope(nextScope);
    updateCheck("workspace", {
      status: nextScope.path ? "success" : "error",
      detail: nextScope.path || "No folder selected",
    });

    await refreshDesktopState();
    return nextScope;
  }

  async function withCheck(id: string, task: () => Promise<string>) {
    updateCheck(id, { status: "running", detail: "Running" });

    try {
      const detail = await task();
      updateCheck(id, { status: "success", detail });
    } catch (error) {
      updateCheck(id, { status: "error", detail: getErrorMessage(error) });
    }
  }

  async function runFileProbe() {
    await withCheck("file", async () => {
      const electron = getElectronBridge();
      const nextScope = isSandboxSelected && scope ? scope : await activateSandboxScope();
      const filePath = joinDesktopPath(nextScope.path, SANDBOX_PROBE_FILE);
      const content = `Rearvy desktop sandbox probe\n${new Date().toISOString()}\n`;

      await electron?.file?.writeText(filePath, content);
      const savedContent = await electron?.file?.readText(filePath);

      if (savedContent !== content) {
        throw new Error("Probe file content did not round-trip correctly.");
      }

      return `Probe file verified: ${filePath}`;
    });
  }

  async function runScreenProbe() {
    await withCheck("screen", async () => {
      const dataUrl = await getElectronBridge()?.system?.captureScreen?.();
      if (!dataUrl) {
        throw new Error("Screen capture returned no image.");
      }

      setScreenPreview(dataUrl);
      return "Screenshot captured in memory.";
    });
  }

  async function runMariaProbe() {
    await withCheck("maria", async () => {
      const readiness = (await getElectronBridge()?.maria?.getReadiness?.()) as MariaReadiness | undefined;
      if (!readiness) {
        throw new Error("Maria readiness bridge is unavailable.");
      }

      return readiness.ok
        ? "Maria is ready."
        : `Needs attention: ${(readiness.issues || []).join("; ") || readiness.status || "unknown"}`;
    });
  }

  async function runBrowserProbe() {
    await withCheck("browser", async () => {
      const status = await getElectronBridge()?.browser?.getConnectionStatus?.();
      if (!status) {
        throw new Error("Browser bridge is unavailable.");
      }

      const method = status.recommendedMethod || "unknown";
      const connected = Boolean(status.cdpDirect?.connected || status.extensionRelay?.connected);
      return `${connected ? "Connected" : "Not connected"}; recommended method: ${method}`;
    });
  }

  async function runLocalApiProbe() {
    await withCheck("local-api", async () => {
      const port = await getElectronBridge()?.localApiPort?.();
      if (!port) {
        throw new Error("Local API port is unavailable.");
      }

      return `Local API is listening on port ${port}.`;
    });
  }

  async function runDeviceProbe() {
    await withCheck("device", async () => {
      const ports = await getElectronBridge()?.device?.listSerialPorts?.();
      if (!Array.isArray(ports)) {
        throw new Error("Device bridge is unavailable.");
      }

      return ports.length ? `${ports.length} serial device(s) detected.` : "No serial devices detected.";
    });
  }

  async function runNotificationProbe() {
    await withCheck("notification", async () => {
      const result = await getElectronBridge()?.notifications?.show(
        "Rearvy Sandbox",
        "Desktop notification bridge is working."
      );

      return result?.ok === false ? `Notification skipped: ${result.reason || "unknown"}` : "Notification sent.";
    });
  }

  async function runTerminalProbe() {
    await withCheck("terminal", async () => {
      const electron = getElectronBridge();
      const nextScope = isSandboxSelected && scope ? scope : await activateSandboxScope();
      const result = await electron?.terminal?.runCommand({
        command: "Write-Output 'rearvy-sandbox-ok'",
        cwd: nextScope.path,
      });

      if (!result?.success) {
        throw new Error(result?.error || "Terminal probe did not start.");
      }

      return `Started terminal probe in ${nextScope.path}`;
    });
  }

  async function runAllProbes() {
    setIsRunningAll(true);
    try {
      await activateSandboxScope();
      await runFileProbe();
      await runScreenProbe();
      await runMariaProbe();
      await runBrowserProbe();
      await runLocalApiProbe();
      await runDeviceProbe();
      await runNotificationProbe();
      await runTerminalProbe();
    } finally {
      setIsRunningAll(false);
    }
  }

  const actions: Array<{ id: string; label: string; run: () => Promise<void> }> = [
    { id: "workspace", label: "Use sandbox", run: async () => {
      await activateSandboxScope();
    } },
    { id: "file", label: "Test files", run: runFileProbe },
    { id: "screen", label: "Capture screen", run: runScreenProbe },
    { id: "maria", label: "Check Maria", run: runMariaProbe },
    { id: "browser", label: "Check browser", run: runBrowserProbe },
    { id: "local-api", label: "Check API", run: runLocalApiProbe },
    { id: "device", label: "Check devices", run: runDeviceProbe },
    { id: "notification", label: "Notify", run: runNotificationProbe },
    { id: "terminal", label: "Terminal echo", run: runTerminalProbe },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[8px] border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-4 border-emerald-400/25 bg-emerald-400/10 text-emerald-100" variant="outline">
                Desktop-only safety workspace
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Rearvy Desktop Sandbox
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                Use this screen to validate privileged desktop features in a known local folder before letting them into
                regular workflows. File and terminal probes are forced through the selected sandbox scope.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void refreshDesktopState()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                type="button"
                onClick={() => void runAllProbes()}
                disabled={bridgeState !== "ready" || isRunningAll}
              >
                <Play className="h-4 w-4" />
                Run sandbox checks
              </Button>
            </div>
          </div>
        </section>

        {bridgeState === "browser" && (
          <Card className="border-amber-500/25 bg-amber-500/10 text-amber-100">
            <CardHeader>
              <CardTitle>Desktop bridge unavailable</CardTitle>
              <CardDescription className="text-amber-100/80">
                Open this route inside the Rearvy desktop app. Browser mode cannot access local desktop features.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <section className="grid gap-4 sm:grid-cols-2">
            {checks.map((check) => {
              const Icon = checkIcons[check.id] ?? ShieldCheck;
              const action = actions.find((candidate) => candidate.id === check.id);

              return (
                <Card key={check.id} className="border-slate-800 bg-slate-900/80 text-slate-100">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="rounded-[8px] border border-slate-700 bg-slate-950 p-2 text-slate-200">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <CardTitle className="text-base">{check.label}</CardTitle>
                          <CardDescription className="mt-1 text-xs text-slate-400">
                            {check.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={cn("capitalize", getStatusTone(check.status))} variant="outline">
                        {check.status === "success" ? <CheckCircle2 className="h-3 w-3" /> : null}
                        {check.status === "error" ? <XCircle className="h-3 w-3" /> : null}
                        {check.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <pre className="min-h-16 overflow-auto rounded-[8px] border border-slate-800 bg-slate-950/80 p-3 text-xs leading-5 text-slate-300">
                      {check.detail}
                    </pre>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                      disabled={bridgeState !== "ready" || check.status === "running" || !action}
                      onClick={() => void action?.run()}
                    >
                      Run check
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <aside className="flex flex-col gap-6">
            <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
              <CardHeader>
                <CardTitle>Runtime state</CardTitle>
                <CardDescription className="text-slate-400">
                  Current desktop bridge and sandbox scope.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {capabilityRows.map(([label, value]) => (
                  <div key={label} className="rounded-[8px] border border-slate-800 bg-slate-950/70 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
                    <div className="mt-1 break-words text-sm text-slate-200">{value}</div>
                  </div>
                ))}
                <div className="rounded-[8px] border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active scope</div>
                  <div className="mt-1 break-words text-sm text-slate-200">
                    {scope?.path || "No folder scope selected"}
                  </div>
                  <Badge
                    className={cn(
                      "mt-3",
                      isSandboxSelected
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    )}
                    variant="outline"
                  >
                    {isSandboxSelected ? "Sandbox selected" : "Not sandboxed"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {screenPreview && (
              <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
                <CardHeader>
                  <CardTitle>Screen preview</CardTitle>
                  <CardDescription className="text-slate-400">
                    In-memory preview from the last capture check.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenPreview}
                    alt="Latest desktop sandbox capture"
                    className="max-h-64 w-full rounded-[8px] border border-slate-800 object-cover"
                  />
                </CardContent>
              </Card>
            )}

            {terminalLog.length > 0 && (
              <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
                <CardHeader>
                  <CardTitle>Terminal events</CardTitle>
                  <CardDescription className="text-slate-400">
                    Latest sandbox terminal probe output.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="overflow-auto rounded-[8px] border border-slate-800 bg-slate-950/80 p-3 text-xs leading-5 text-slate-300">
                    {terminalLog.join("\n")}
                  </pre>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-800 bg-slate-900/80 text-slate-100">
              <CardHeader>
                <CardTitle>Policy</CardTitle>
                <CardDescription className="text-slate-400">
                  Features that can touch local state should prove themselves here first.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm leading-6 text-slate-300">
                  <li>File writes must stay inside the selected sandbox folder.</li>
                  <li>Terminal commands must use the sandbox as their working folder.</li>
                  <li>Screen, browser, Maria, device, and notification bridges must report availability before use.</li>
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
