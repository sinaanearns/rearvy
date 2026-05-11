"use client";

import { useEffect } from "react";

function shouldRewriteApiUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input.startsWith("/api/");
  }

  if (input instanceof URL) {
    return input.pathname.startsWith("/api/");
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      return new URL(input.url, window.location.href).pathname.startsWith("/api/");
    } catch {
      return false;
    }
  }

  return false;
}

function buildLocalApiUrl(input: RequestInfo | URL, port: number) {
  const baseUrl = `http://localhost:${port}`;

  if (typeof input === "string") {
    return new URL(input, baseUrl).toString();
  }

  if (input instanceof URL) {
    return new URL(`${input.pathname}${input.search}${input.hash}`, baseUrl).toString();
  }

  return null;
}

export default function DesktopApiInterceptor() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.electron) {
      return;
    }

    // In desktop development we often load the website from http://localhost:3000.
    // That origin already serves the API correctly, so only rewrite requests in the
    // packaged rearvy:// app where relative /api calls would otherwise break.
    if (window.location.protocol !== "rearvy:") {
      return;
    }

    const electron = window.electron;
    const originalFetch = globalThis.fetch.bind(globalThis);
    let active = true;

    const applyPatch = (port: number) => {
      if (!active) {
        return;
      }

      globalThis.fetch = async (input, init) => {
        if (!shouldRewriteApiUrl(input)) {
          return originalFetch(input, init);
        }

        const localUrl = buildLocalApiUrl(input, Number(port) || 4000);
        if (!localUrl) {
          return originalFetch(input, init);
        }

        const mergedInit: RequestInit = {
          ...(init || {}),
          credentials: (init?.credentials as RequestCredentials | undefined) || "include",
        };

        return originalFetch(localUrl, mergedInit);
      };
    };

    const unsubscribe = electron.onLocalApiPort?.((port) => {
      applyPatch(Number(port) || 4000);
    });

    const resolveInitialPort = async () => {
      if (electron.localApiPort) {
        try {
          const port = await electron.localApiPort();
          applyPatch(Number(port) || 4000);
          return;
        } catch {
          // Fall through to the default port.
        }
      }

      applyPatch(4000);
    };

    void resolveInitialPort();

    if (!electron.onLocalApiPort && !electron.localApiPort) {
      applyPatch(4000);
    }

    return () => {
      active = false;
      unsubscribe?.();
      globalThis.fetch = originalFetch;
    };
  }, []);

  return null;
}