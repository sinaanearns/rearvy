import "server-only";

import type { CloudComputerConfig } from "./config";

type BrowserbaseSessionStatus =
  | "PENDING"
  | "RUNNING"
  | "ERROR"
  | "TIMED_OUT"
  | "COMPLETED";

export type BrowserbaseSessionSnapshot = {
  id: string;
  status: BrowserbaseSessionStatus | string;
  connectUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiresAt?: string | null;
};

export type BrowserbaseLiveView = {
  liveViewUrl: string | null;
  debuggerUrl: string | null;
  wsUrl: string | null;
  currentUrl: string | null;
  title: string | null;
};

export type BrowserbaseCommandSnapshot = {
  currentUrl: string | null;
  title: string | null;
  screenshotDataUrl: string | null;
  summary: string | null;
};

export type BrowserbaseDownloadsZip = {
  filename: string;
  contentType: string;
  size: number;
  buffer: Buffer;
};

type BrowserbaseSdkClient = {
  sessions: {
    create: (body: Record<string, unknown>) => Promise<BrowserbaseSessionSnapshot>;
    retrieve: (id: string) => Promise<BrowserbaseSessionSnapshot>;
    update: (id: string, body: Record<string, unknown>) => Promise<unknown>;
    debug: (id: string) => Promise<{
      debuggerFullscreenUrl?: string;
      debuggerUrl?: string;
      wsUrl?: string;
      pages?: Array<{
        debuggerFullscreenUrl?: string;
        debuggerUrl?: string;
        title?: string;
        url?: string;
      }>;
    }>;
    downloads: {
      list: (id: string) => Promise<Response>;
    };
    uploads: {
      create: (id: string, body: { file: unknown }) => Promise<{ message?: string }>;
    };
  };
};

function extractContentDispositionFilename(value: string | null) {
  if (!value) return null;
  const filenameStar = /filename\*=UTF-8''([^;]+)/i.exec(value)?.[1];
  if (filenameStar) {
    try {
      return decodeURIComponent(filenameStar.replace(/^"|"$/g, ""));
    } catch {
      return filenameStar.replace(/^"|"$/g, "");
    }
  }

  return /filename="?([^";]+)"?/i.exec(value)?.[1] || null;
}

function commandLooksLikeUrl(command: string) {
  const trimmed = command.trim();
  const directUrl = /(https?:\/\/[^\s"'<>]+)/i.exec(trimmed)?.[1];
  if (directUrl) return directUrl;

  const openTarget = /^(?:open|go to|navigate to|visit)\s+([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i.exec(
    trimmed
  )?.[1];
  if (openTarget) return `https://${openTarget}`;

  return null;
}

async function createBrowserbaseClient(config: CloudComputerConfig) {
  const browserbaseSdk = await import("@browserbasehq/sdk");
  const Browserbase = browserbaseSdk.default || browserbaseSdk.Browserbase;
  return new Browserbase({
    apiKey: config.apiKey,
    baseURL: config.apiBaseUrl,
    timeout: 30000,
    maxRetries: 1,
  }) as unknown as BrowserbaseSdkClient;
}

export async function createBrowserbaseSession(config: CloudComputerConfig) {
  const client = await createBrowserbaseClient(config);
  const session = await client.sessions.create({
    projectId: config.projectId,
    region: config.region,
    keepAlive: true,
    timeout: config.timeoutSeconds,
    browserSettings: {
      viewport: {
        width: 1440,
        height: 900,
      },
      logSession: true,
      recordSession: true,
      solveCaptchas: false,
    },
    userMetadata: {
      app: "rearvy",
      runtime: "cloud-computer-v1",
    },
  });

  return session;
}

export async function retrieveBrowserbaseSession(
  config: CloudComputerConfig,
  providerSessionId: string
) {
  const client = await createBrowserbaseClient(config);
  return client.sessions.retrieve(providerSessionId);
}

export async function getBrowserbaseLiveView(
  config: CloudComputerConfig,
  providerSessionId: string
): Promise<BrowserbaseLiveView> {
  const client = await createBrowserbaseClient(config);
  const debug = await client.sessions.debug(providerSessionId);
  const firstPage = debug.pages?.[0] || null;

  return {
    liveViewUrl:
      firstPage?.debuggerFullscreenUrl ||
      firstPage?.debuggerUrl ||
      debug.debuggerFullscreenUrl ||
      debug.debuggerUrl ||
      null,
    debuggerUrl: firstPage?.debuggerUrl || debug.debuggerUrl || null,
    wsUrl: debug.wsUrl || null,
    currentUrl: firstPage?.url || null,
    title: firstPage?.title || null,
  };
}

export async function requestBrowserbaseSessionStop(
  config: CloudComputerConfig,
  providerSessionId: string
) {
  const client = await createBrowserbaseClient(config);
  await client.sessions.update(providerSessionId, {
    projectId: config.projectId,
    status: "REQUEST_RELEASE",
  });
}

export async function getBrowserbaseDownloadsZip(
  config: CloudComputerConfig,
  providerSessionId: string
): Promise<BrowserbaseDownloadsZip | null> {
  const client = await createBrowserbaseClient(config);
  const response = await client.sessions.downloads.list(providerSessionId);
  const contentLength = Number(response.headers.get("content-length") || "0");
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length && !contentLength) {
    return null;
  }

  return {
    filename:
      extractContentDispositionFilename(response.headers.get("content-disposition")) ||
      `browserbase-downloads-${providerSessionId}.zip`,
    contentType: response.headers.get("content-type") || "application/zip",
    size: buffer.length,
    buffer,
  };
}

export async function uploadFileToBrowserbaseSession(params: {
  config: CloudComputerConfig;
  providerSessionId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}) {
  const browserbaseSdk = await import("@browserbasehq/sdk");
  const file = await browserbaseSdk.toFile(params.buffer, params.fileName, {
    type: params.contentType,
  });
  const client = await createBrowserbaseClient(params.config);
  return client.sessions.uploads.create(params.providerSessionId, { file });
}

export async function runBrowserbaseStagehandCommand(params: {
  config: CloudComputerConfig;
  providerSessionId: string;
  command: string;
}): Promise<BrowserbaseCommandSnapshot> {
  const { Stagehand } = await import("@browserbasehq/stagehand");
  const model = params.config.modelApiKey
    ? {
        modelName: params.config.stagehandModel,
        apiKey: params.config.modelApiKey,
      }
    : params.config.stagehandModel;
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: params.config.apiKey,
    projectId: params.config.projectId,
    browserbaseSessionID: params.providerSessionId,
    keepAlive: true,
    disablePino: true,
    verbose: 0,
    waitForCaptchaSolves: false,
    actTimeoutMs: 25000,
    model,
    browserbaseSessionCreateParams: {
      projectId: params.config.projectId,
      region: params.config.region,
      keepAlive: true,
      timeout: params.config.timeoutSeconds,
      browserSettings: {
        viewport: {
          width: 1440,
          height: 900,
        },
        logSession: true,
        recordSession: true,
        solveCaptchas: false,
      },
    },
  });

  try {
    await stagehand.init();
    const page = stagehand.context.activePage() || stagehand.context.pages()[0];
    const urlTarget = commandLooksLikeUrl(params.command);

    if (urlTarget && page) {
      await page.goto(urlTarget, { waitUntil: "domcontentloaded", timeoutMs: 20000 });
    } else {
      await stagehand.act(params.command);
    }

    const activePage = stagehand.context.activePage() || stagehand.context.pages()[0];
    const screenshot = activePage
      ? await activePage.screenshot({ type: "png", fullPage: false, timeout: 10000 })
      : null;
    const currentUrl = activePage?.url() || null;
    const title = activePage ? await activePage.title().catch(() => "") : "";

    return {
      currentUrl,
      title: title || null,
      screenshotDataUrl: screenshot
        ? `data:image/png;base64,${screenshot.toString("base64")}`
        : null,
      summary: urlTarget
        ? `Opened ${urlTarget}.`
        : "Cloud computer command completed.",
    };
  } finally {
    await stagehand.close().catch(() => undefined);
  }
}
