declare global {
  type DesktopFileFilter = { name?: string; extensions?: string[] };
  type DesktopMcpConfig = { mcp_servers?: unknown[] };
  type DesktopUpdateState = Record<string, unknown>;

  interface Window {
    electron?: {
      onAuthCredential?: (
        callback: (credential: { idToken?: string | null; accessToken?: string | null }) => void
      ) => () => void;
      sendAuthCredential?: (credential: { idToken?: string | null; accessToken?: string | null }) => void;
      onAuthToken?: (callback: (token: string) => void) => () => void;
      sendAuthToken?: (token: string) => void;
      onDesktopMcpConfig?: (callback: (config: DesktopMcpConfig) => void) => () => void;
      requestDesktopMcpConfig?: () => Promise<DesktopMcpConfig | null>;
      localApiPort?: () => Promise<number | null>;
      onLocalApiPort?: (callback: (port: number) => void) => () => void;
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
      updater?: {
        getState: () => Promise<DesktopUpdateState>;
        checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>;
        downloadUpdate: () => Promise<{ ok: boolean; reason?: string }>;
        installAndRestart: () => Promise<{ ok: boolean; reason?: string }>;
        onStateChange: (callback: (state: DesktopUpdateState) => void) => () => void;
      };
      automation?: {
        startWorkflow: (workflow: unknown) => Promise<{ ok: boolean; reason?: string }>;
        getState: () => Promise<unknown>;
        pause: () => Promise<{ ok: boolean; reason?: string }>;
        resume: () => Promise<{ ok: boolean; reason?: string }>;
        stop: () => Promise<{ ok: boolean; reason?: string }>;
        getHistory: (workflowId: string) => Promise<unknown>;
        runTest: () => Promise<{ ok: boolean; reason?: string }>;
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
      clicky?: { setPosition: (x: number, y: number) => void; setSize: (w: number, h: number) => void; getMousePosition: () => Promise<{ x: number; y: number }>; runCommand: (command: string) => Promise<unknown>; onStatus: (cb: (s: unknown) => void) => () => void };
    };
  }
}

export {};
