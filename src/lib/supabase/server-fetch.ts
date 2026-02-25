import dns from "node:dns";
import { Agent } from "undici";

const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 4000;
const DEFAULT_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];

let supabaseDnsAgent: Agent | null = null;

function parseTimeoutMs(rawValue: string | undefined): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
  }
  if (parsed === 0) {
    return 0;
  }
  if (parsed < 0) {
    return DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

function getTimeoutMs() {
  return parseTimeoutMs(process.env.SUPABASE_FETCH_TIMEOUT_MS);
}

function getSupabaseHostname() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;

  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function getDnsServers() {
  const raw = process.env.SUPABASE_DNS_SERVERS;
  if (!raw) return DEFAULT_DNS_SERVERS;

  const servers = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return servers.length > 0 ? servers : DEFAULT_DNS_SERVERS;
}

function getSupabaseDnsAgent() {
  if (supabaseDnsAgent) {
    return supabaseDnsAgent;
  }

  const resolver = new dns.Resolver();
  resolver.setServers(getDnsServers());
  const supabaseHost = getSupabaseHostname();

  supabaseDnsAgent = new Agent({
    connect: {
      lookup(hostname, options, callback) {
        const fallbackLookup = () => dns.lookup(hostname, options, callback);

        if (!supabaseHost || hostname !== supabaseHost) {
          fallbackLookup();
          return;
        }

        resolver.resolve4(hostname, (resolveError, addresses) => {
          if (resolveError || !addresses || addresses.length === 0) {
            fallbackLookup();
            return;
          }

          if (options.all) {
            callback(
              null,
              addresses.map((address) => ({
                address,
                family: 4,
              }))
            );
            return;
          }

          callback(null, addresses[0], 4);
        });
      },
    },
  });

  return supabaseDnsAgent;
}

function getHostnameFromInput(input: Parameters<typeof fetch>[0]) {
  try {
    if (typeof input === "string") {
      return new URL(input).hostname;
    }

    if (input instanceof URL) {
      return input.hostname;
    }

    return new URL(input.url).hostname;
  } catch {
    return null;
  }
}

const supabaseServerFetchWithTimeoutImpl = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1]
) => {
  const requestInit = init ?? {};
  const timeoutMs = getTimeoutMs();
  const requestHost = getHostnameFromInput(input);
  const supabaseHost = getSupabaseHostname();
  const shouldUseDnsOverride = Boolean(
    supabaseHost && requestHost && supabaseHost === requestHost
  );

  const requestOptions = {
    ...requestInit,
    ...(shouldUseDnsOverride ? { dispatcher: getSupabaseDnsAgent() } : {}),
  } as RequestInit & { dispatcher?: Agent };

  if (timeoutMs <= 0 || requestInit.signal) {
    return fetch(input, requestOptions);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new DOMException(
        `Supabase request timed out after ${timeoutMs}ms`,
        "TimeoutError"
      )
    );
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...requestOptions,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const supabaseServerFetchWithTimeout =
  supabaseServerFetchWithTimeoutImpl as typeof fetch;
