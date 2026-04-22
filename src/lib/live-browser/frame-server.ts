import "server-only";

import { WebSocketServer } from "ws";
import {
  BROWSER_WS_STREAM_PATH,
  getConfiguredBrowserWsPort,
} from "./shared";
import { getLiveBrowserSessionManager } from "./session-manager";

type LiveBrowserFrameServer = {
  port: number;
  server: WebSocketServer;
};

declare global {
  var __rearvyLiveBrowserFrameServer:
    | LiveBrowserFrameServer
    | undefined;
}

export function ensureLiveBrowserFrameServer() {
  if (globalThis.__rearvyLiveBrowserFrameServer) {
    return globalThis.__rearvyLiveBrowserFrameServer;
  }

  const port = getConfiguredBrowserWsPort();
  const server = new WebSocketServer({
    port,
    path: BROWSER_WS_STREAM_PATH,
  });

  server.on("connection", (socket, request) => {
    const requestUrl = new URL(
      request.url ?? BROWSER_WS_STREAM_PATH,
      `http://${request.headers.host ?? "127.0.0.1"}`
    );
    const sessionId = requestUrl.searchParams.get("sessionId") ?? "";
    const token = requestUrl.searchParams.get("token") ?? "";

    getLiveBrowserSessionManager().attachSocket(sessionId, token, socket);
  });

  const instance = { port, server };
  globalThis.__rearvyLiveBrowserFrameServer = instance;
  return instance;
}
