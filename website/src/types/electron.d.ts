declare global {
  type DesktopFileFilter = { name?: string; extensions?: string[] };
  type DesktopMcpConfig = { mcp_servers?: unknown[] };
  type DesktopUpdateState = Record<string, unknown>;
  type DesktopWorkflowAction =
    | { type: "screenshot"; analyze?: boolean }
    | { type: "wait"; ms?: number }
    | { type: "launchApp"; appPath?: string; path?: string; url?: string; args?: string[]; wait?: boolean }
    | { type: "openPath"; target?: string; path?: string; url?: string; appPath?: string; wait?: boolean }
    | { type: "revealPath"; target?: string; path?: string; filePath?: string }
    | { type: "readFile"; filePath?: string; path?: string; target?: string }
    | { type: "writeFile"; filePath?: string; path?: string; target?: string; content?: string }
    | { type: "shellCommand"; command: string; cwd?: string }
    | { type: "closeWindow"; windowTitle?: string; force?: boolean }
    | { type: "click"; x: number; y: number; button?: string; double?: boolean }
    | { type: "moveMouse"; x: number; y: number }
    | { type: "dragMouse"; x?: number; y?: number; fromX?: number; fromY?: number; toX?: number; toY?: number; button?: string; durationMs?: number; steps?: number }
    | { type: "mouseDown"; button?: string }
    | { type: "mouseUp"; button?: string }
    | { type: "type"; text?: string; delay?: number; delayMs?: number }
    | { type: "keyPress"; key: string; modifiers?: string[] }
    | { type: "setClipboard"; text?: string }
    | { type: "getClipboard" }
    | { type: "scroll"; direction?: "up" | "down" | "left" | "right"; amount?: number };
  type DesktopWorkflow = {
    id: string;
    name: string;
    description?: string;
    source: "chat-tool" | "template" | "test";
    requiresApproval: boolean;
    steps: Array<{
      id: string;
      name: string;
      description?: string;
      action: DesktopWorkflowAction | { type: string; [key: string]: unknown };
      timeout?: number;
      retry?: { max: number; backoffMs: number };
    }>;
  };
  type ClickyAssistantEvent =
    | { type: "command-started"; command: string }
    | { type: "command-completed"; command: string; mode: string }
    | { type: "command-failed"; command: string; error: string }
    | { type: "command-stopped"; reason?: string; message?: string }
    | { type: "research-started"; query: string; hasScreenshotContext: boolean }
    | { type: "research-completed"; query: string; headline: string; results: Array<{ title: string; url: string; description: string; summary: string }> }
    | { type: "scrape-started"; url: string }
    | { type: "scrape-completed"; url: string; result: { title: string; url: string; summary: string; links: string[] } }
    | { type: "screen-analysis-started"; command?: string }
    | { type: "screen-analysis-completed"; command?: string; reply?: string; modelRoute?: unknown }
    | { type: "screen-analysis-failed"; command?: string; message?: string; error?: string }
    | { type: "screen-point"; command?: string; x: number; y: number; label?: string; spokenText?: string; screenNumber?: number | null }
    | { type: "assistant-reply"; reply?: string; message?: string }
    | { type: "wake-word-detected"; transcript?: string; command?: string; requestId?: string; origin?: string }
    | { type: "policy-response"; command?: string; message?: string }
    | { type: "command-blocked"; command?: string; reason?: string; message?: string }
    | { type: "calendar-check-started"; command: string }
    | { type: "calendar-check-completed"; command: string; openedTarget?: string; reply?: string; modelRoute?: unknown }
    | { type: "calendar-check-failed"; command: string; openedTarget?: string; reason?: string; error?: string; message?: string }
    | { type: "desktop-workflow-started"; command?: string; workflowId: string; summary?: string }
    | { type: "desktop-workflow-completed"; command?: string; workflowId: string; state?: string; reply?: string }
    | { type: "desktop-workflow-failed"; command?: string; workflowId: string; state?: string; message?: string };
  type ClickyCommandPayload = {
    command: string;
    requestId?: string;
    origin?: string;
  };
  type ClickyCommandResult = {
    ok?: boolean;
    mode?: "chat" | "screen_analysis" | "research" | "scrape" | "memory" | "calendar_check" | "desktop_workflow" | string;
    reason?: string;
    message?: string;
    reply?: string;
    workflowId?: string;
    state?: string;
    openedTarget?: string;
    error?: string;
    aiUnavailable?: boolean;
    modelRoute?: unknown;
  };
  type DesktopCapabilities = {
    appVersion?: string;
    bridgeVersion?: string;
    rendererBridgeVersion?: string;
    platform?: string;
    isPackaged?: boolean;
    appUrl?: string;
    terminal?: boolean;
    localApi?: { available?: boolean; port?: number | null };
    devicePermissions?: {
      autoGrant?: boolean;
      trustedOrigins?: string[];
      permissions?: string[];
    };
    automation?: boolean;
    clicky?: boolean;
    browser?: boolean;
    renderer?: Record<string, boolean>;
    error?: string;
  };
  type DesktopBrowserConnectionStatus = {
    cdpDirect?: {
      connected?: boolean;
      method?: "cdp-direct";
      port?: number;
      browser?: string | null;
      version?: string | null;
      webSocketDebuggerUrl?: string | null;
      error?: string;
    };
    extensionRelay?: {
      connected?: boolean;
      method?: "extension-relay";
      port?: number;
      extensionId?: string | null;
      version?: string | null;
      tabCount?: number;
      lastSeenAt?: string | null;
      error?: string;
    };
    recommendedMethod?: "cdp-direct" | "extension-relay" | "managed-runner";
  };
  type DesktopBrowserRelayInfo = {
    ok?: boolean;
    port?: number;
    extensionPath?: string;
    extensionId?: string | null;
    extensionOptionsUrl?: string | null;
    relaySetupUrl?: string | null;
    pairingCode?: string | null;
    appVersion?: string | null;
  };

  interface Window {
    electron?: {
      getCapabilities?: () => Promise<DesktopCapabilities>;
      onAuthCredential?: (
        callback: (credential: { idToken?: string | null; accessToken?: string | null }) => void
      ) => () => void;
      sendAuthCredential?: (credential: { idToken?: string | null; accessToken?: string | null }) => void;
      onAuthToken?: (callback: (token: string) => void) => () => void;
      sendAuthToken?: (token: string) => void;
      onOpenPath?: (
        callback: (payload: { path: string; cwd: string; kind: "file" | "directory" }) => void
      ) => () => void;
      onDesktopMcpConfig?: (callback: (config: DesktopMcpConfig) => void) => () => void;
      requestDesktopMcpConfig?: () => Promise<DesktopMcpConfig | null>;
      localApiPort?: () => Promise<number | null>;
      onLocalApiPort?: (callback: (port: number) => void) => () => void;
      workspace?: {
        getScope: () => Promise<{ mode: "folder" | "full-access"; path: string }>;
        setScope: (scope: { mode: "folder" | "full-access"; path: string }) => Promise<{ mode: "folder" | "full-access"; path: string }>;
        pickFolder: () => Promise<{ mode: "folder" | "full-access"; path: string }>;
      };
      file?: {
        pickOpenPath: (filters?: DesktopFileFilter[]) => Promise<string | null>;
        readText: (filePath: string) => Promise<string>;
        pickSavePath: (defaultPath?: string, filters?: DesktopFileFilter[]) => Promise<string | null>;
        writeText: (filePath: string, content: string) => Promise<{ ok: true }>;
      };
      clipboard?: { readText: () => Promise<string>; writeText: (text: string) => Promise<{ ok: true }> };
      notifications?: { show: (title: string, body?: string) => Promise<{ ok: boolean; reason?: string }> };
      system?: { 
        openExternal: (url: string) => Promise<{ ok: true }>; 
        revealInFolder: (filePath: string) => Promise<{ ok: true }>; 
        captureScreen?: () => Promise<string | null>;
        openDevTools?: () => Promise<{ success: boolean }>;
      };
      browser?: {
        getConnectionStatus: () => Promise<DesktopBrowserConnectionStatus>;
        openBrowserInternalUrl?: (url: string) => Promise<{ ok?: boolean; success?: boolean; browser?: string; url?: string; error?: string }>;
        openChromeInternalUrl: (url: string) => Promise<{ ok?: boolean; success?: boolean; error?: string }>;
        openExtensionOptions?: (options?: { pairingCode?: string; relayUrl?: string }) => Promise<{ ok?: boolean; browser?: string; url?: string; optionsUrl?: string; setupUrl?: string; extensionId?: string | null; fallback?: boolean; reason?: string; error?: string }>;
        openExtensionFolder: () => Promise<{ ok?: boolean; extensionPath?: string; error?: string }>;
        copyExtensionPath: () => Promise<{ ok?: boolean; extensionPath?: string; error?: string }>;
        createRelayPairingCode: () => Promise<{ ok?: boolean; pairingCode?: string; expiresAt?: string; port?: number; error?: string }>;
        getRelayInfo: () => Promise<DesktopBrowserRelayInfo>;
      };
      updater?: {
        getState: () => Promise<DesktopUpdateState>;
        checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>;
        downloadUpdate: () => Promise<{ ok: boolean; reason?: string }>;
        installAndRestart: () => Promise<{ ok: boolean; reason?: string }>;
        onStateChange: (callback: (state: DesktopUpdateState) => void) => () => void;
      };
      automation?: {
        startWorkflow: (workflow: DesktopWorkflow | unknown) => Promise<{ success?: boolean; ok?: boolean; reason?: string; error?: string; state?: unknown }>;
        approveWorkflow: (workflowId: string) => Promise<{ success: boolean; error?: string }>;
        rejectWorkflow: (workflowId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
        getState: () => Promise<unknown>;
        pause: () => Promise<{ ok: boolean; reason?: string }>;
        resume: () => Promise<{ ok: boolean; reason?: string }>;
        stop: () => Promise<{ ok: boolean; reason?: string }>;
        getHistory: (workflowId?: string) => Promise<unknown>;
        runTest: () => Promise<{ success?: boolean; ok?: boolean; error?: string; reason?: string; state?: unknown }>;
        onStateChange: (callback: (state: unknown) => void) => () => void;
        onPaused: (callback: () => void) => () => void;
        onResumed: (callback: () => void) => () => void;
        onStopped: (callback: () => void) => () => void;
      };
      terminal?: {
        runCommand: (options: { command: string; cwd?: string }) => Promise<{ success: boolean; processId?: string; error?: string }>;
        stopProcess: (processId: string) => Promise<{ success: boolean; error?: string }>;
        openExternal: (path?: string) => Promise<{ success: boolean; error?: string }>;
        onOutput: (callback: (data: { id: string; type: string; data: string }) => void) => () => void;
        onStatusChange: (callback: (data: { id: string; status: string; code?: number }) => void) => () => void;
      };
      clicky?: {
        setPosition: (x: number, y: number) => void;
        setSize: (w: number, h: number) => void;
        setMousePassthrough?: (passthrough: boolean) => void;
        getMousePosition: () => Promise<{ x: number; y: number }>;
        runCommand: (command: string | ClickyCommandPayload) => Promise<ClickyCommandResult>;
        research?: (command: string | ClickyCommandPayload) => Promise<ClickyCommandResult>;
        stop?: () => Promise<{ ok: boolean; stopped?: boolean; reason?: string; message?: string }>;
        wakeDetected?: (payload?: { transcript?: string; command?: string; requestId?: string; origin?: string }) => void;
        onStatus: (cb: (s: unknown) => void) => () => void;
        onAssistantEvent?: (cb: (event: ClickyAssistantEvent) => void) => () => void;
      };
    };
  }
}

export {};
