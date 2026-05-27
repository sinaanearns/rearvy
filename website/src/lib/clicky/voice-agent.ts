const VOICE_AGENT_WS_URL = "wss://agents.assemblyai.com/v1/ws";
const WORKLET_URL = "/clicky-voice-agent-input.worklet.js";
const SAMPLE_RATE = 24000;

export type ClickyVoiceAgentStatus =
  | "Connecting"
  | "Maria listening"
  | "Maria speaking"
  | "Running Clicky action"
  | "Disconnected"
  | "Voice Agent unavailable";

export type ClickyVoiceAgentToolMode = "command" | "research";

export type ClickyVoiceAgentToolRequest = {
  callId: string;
  command: string;
  mode: ClickyVoiceAgentToolMode;
};

export type ClickyVoiceAgentToolResult = {
  ok: boolean;
  message?: string;
  reply?: string;
  data?: unknown;
};

export type ClickyVoiceAgentTranscript = {
  role: "user" | "assistant";
  text: string;
};

export type ClickyVoiceAgentOptions = {
  onStatus: (status: ClickyVoiceAgentStatus) => void;
  onNote: (note: string) => void;
  onToolCall: (request: ClickyVoiceAgentToolRequest) => Promise<ClickyVoiceAgentToolResult>;
  onTranscript?: (transcript: ClickyVoiceAgentTranscript) => void;
  onError?: (message: string, error: unknown) => void;
};

type TokenPayload = {
  ok?: unknown;
  token?: unknown;
  error?: unknown;
  code?: unknown;
  detail?: unknown;
  expiresInSeconds?: unknown;
  maxSessionDurationSeconds?: unknown;
};

type VoiceAgentMessage = {
  type?: string;
  session_id?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
  text?: unknown;
  data?: unknown;
  audio?: unknown;
  interrupted?: unknown;
  call_id?: unknown;
  callId?: unknown;
  name?: unknown;
  args?: unknown;
  arguments?: unknown;
};

type PendingToolResult = {
  callId: string;
  result: ClickyVoiceAgentToolResult;
};

type ReadyWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: number;
};

export class ClickyVoiceAgentError extends Error {
  code: string;
  detail?: unknown;

  constructor(message: string, code = "voice_agent_unavailable", detail?: unknown) {
    super(message);
    this.name = "ClickyVoiceAgentError";
    this.code = code;
    this.detail = detail;
  }
}

export function getClickyVoiceAgentFailureMessage(error: unknown) {
  if (error instanceof ClickyVoiceAgentError) {
    if (error.code === "microphone_permission_denied") {
      return "Microphone permission needed.";
    }

    if (error.code === "microphone_unavailable") {
      return "Microphone unavailable.";
    }
  }

  return "Voice Agent unavailable.";
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return window.btoa(binary);
}

function base64ToUint8Array(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function getAudioContextConstructor() {
  return window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function parseToolArgs(value: unknown) {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readToolMode(value: unknown): ClickyVoiceAgentToolMode {
  return value === "research" ? "research" : "command";
}

function buildMariaSessionUpdate() {
  return {
    type: "session.update",
    session: {
      system_prompt: [
        "You are Maria, Clicky's real-time voice assistant for Rearvy.",
        "Speak in a concise, direct desktop-assistant style.",
        "Do not claim that an action is complete unless a tool result confirms it.",
        "Clicky has approval-gated access to the user's desktop through the Rearvy desktop app, including screenshots, mouse movement, clicks, drags, scrolling, typing, key presses, clipboard actions, opening apps, and local workflows.",
        "For any request to move, click, drag, scroll, type, press keys, open apps, inspect the screen, or otherwise interact with the device, call run_clicky_command and wait for the result.",
        "Do not say you cannot control the mouse. Explain that Clicky can do it through the desktop bridge after user approval, then use run_clicky_command when the user asks for an action.",
        "If Clicky asks for approval and the user answers yes, no, approve, cancel, stop, or similar, call run_clicky_command with that approval response.",
        "You can take screenshots and inspect the screen through Clicky. If the user asks whether you can take a screenshot or look at the screen, say yes and call run_clicky_command.",
        "Never use research mode for screenshots, screen inspection, or questions about the visible screen.",
        "For personal memory requests, saved names, preferences, goals, or questions like 'what is my name', call run_clicky_command so Clicky can save or read memory.",
        "If a request is unclear, ask one short clarifying question.",
        "While a tool is running, say a brief transition such as 'One moment.'",
      ].join(" "),
      greeting: "Hi, I'm Maria. How can I help?",
      input: {
        format: { encoding: "audio/pcm" },
        keyterms: ["Clicky", "Rearvy", "Reavry", "Maria", "memory", "Shopify", "Firecrawl", "campaign metrics"],
        turn_detection: {
          interrupt_response: true,
          vad_threshold: 0.5,
          min_silence: 450,
          max_silence: 1200,
        },
      },
      output: {
        voice: "ivy",
        format: { encoding: "audio/pcm" },
      },
      tools: [
        {
          type: "function",
          name: "run_clicky_command",
          description:
            "Run a Clicky command through the Rearvy desktop bridge. Use this for mouse movement, clicks, drags, scrolling, typing, key presses, screenshots, visible-screen inspection, opening apps, memory requests, local workflows, or research requests. Use research mode only for web research or metric lookup requests.",
          parameters: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "The user request to send to Clicky.",
              },
              mode: {
                type: "string",
                enum: ["command", "research"],
                description: "Use research for research/search requests; otherwise use command.",
              },
            },
            required: ["command", "mode"],
          },
        },
      ],
    },
  };
}

export class ClickyVoiceAgentSession {
  private audioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private silentGainNode: GainNode | null = null;
  private webSocket: WebSocket | null = null;
  private ready = false;
  private stopped = false;
  private playbackTime = 0;
  private playbackSources = new Set<AudioBufferSourceNode>();
  private pendingToolResults: PendingToolResult[] = [];
  private toolResultsCanSend = false;
  private toolGeneration = 0;
  private readyWaiter: ReadyWaiter | null = null;
  private sessionId = "";

  constructor(private readonly options: ClickyVoiceAgentOptions) {}

  async start() {
    if (this.webSocket) {
      return;
    }

    this.stopped = false;
    this.options.onStatus("Connecting");
    this.options.onNote("Connecting Maria...");

    try {
      const [audioResult, tokenResult] = await Promise.allSettled([
        this.startAudio(),
        this.fetchToken(),
      ] as const);

      this.throwIfStopped();

      if (audioResult.status === "rejected") {
        throw audioResult.reason;
      }

      if (tokenResult.status === "rejected") {
        throw tokenResult.reason;
      }

      this.throwIfStopped();
      await this.connect(tokenResult.value);
    } catch (error) {
      await this.cleanupMediaResources();
      throw error;
    }
  }

  async stop() {
    this.stopped = true;
    this.ready = false;
    this.rejectReadyWaiter(this.createDisconnectedError());
    await this.closeAndCleanup(1000, "client-disconnect");
    this.options.onStatus("Disconnected");
  }

  private async startAudio() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ClickyVoiceAgentError("Microphone is not available.", "microphone_unavailable");
    }

    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      throw new ClickyVoiceAgentError("AudioContext is not available.", "voice_agent_audio_unavailable");
    }

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
        },
      });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw new ClickyVoiceAgentError("Microphone permission needed.", "microphone_permission_denied", error);
      }

      throw new ClickyVoiceAgentError("Could not start microphone.", "microphone_unavailable", error);
    }

    this.throwIfStopped();
    this.audioContext = new AudioContextConstructor({ sampleRate: SAMPLE_RATE });
    await this.audioContext.audioWorklet.addModule(WORKLET_URL);
    this.throwIfStopped();
    await this.audioContext.resume();
    this.throwIfStopped();

    this.sourceNode = this.audioContext.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "clicky-voice-agent-input");
    this.silentGainNode = this.audioContext.createGain();
    this.silentGainNode.gain.value = 0;

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      this.sendInputAudio(event.data);
    };

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.silentGainNode);
    this.silentGainNode.connect(this.audioContext.destination);
  }

  private async fetchToken() {
    const requestId = crypto.randomUUID();
    const port = await window.electron?.localApiPort?.().catch(() => null);
    const localApiPort = typeof port === "number" && Number.isFinite(port) ? port : 4000;
    const tokenUrl = `http://127.0.0.1:${localApiPort}/api/internal/clicky/voice-agent-token?requestId=${encodeURIComponent(
      requestId
    )}`;

    let response: Response;
    try {
      response = await fetch(tokenUrl, { method: "GET" });
    } catch (error) {
      throw new ClickyVoiceAgentError("Clicky voice service is not running.", "voice_service_unreachable", error);
    }

    let payload: TokenPayload | null = null;
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      throw new ClickyVoiceAgentError(
        readString(payload?.error, "Voice Agent token request failed."),
        readString(payload?.code, "voice_agent_token_failed"),
        payload?.detail
      );
    }

    const token = readString(payload?.token);
    if (!token) {
      throw new ClickyVoiceAgentError("Voice Agent token response was invalid.", "voice_agent_token_missing");
    }

    return token;
  }

  private async connect(token: string) {
    this.throwIfStopped();
    const wsUrl = new URL(VOICE_AGENT_WS_URL);
    wsUrl.searchParams.set("token", token);

    const socket = new WebSocket(wsUrl.toString());
    this.webSocket = socket;

    const readyPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.rejectReadyWaiter(
          new ClickyVoiceAgentError("Voice Agent did not become ready.", "voice_agent_ready_timeout")
        );
      }, 15000);

      this.readyWaiter = {
        resolve,
        reject,
        timeoutId,
      };
    });

    socket.addEventListener("open", () => {
      if (this.stopped || this.webSocket !== socket) {
        return;
      }

      this.sendJson(buildMariaSessionUpdate());
    });

    socket.addEventListener("message", (event) => {
      if (this.stopped || this.webSocket !== socket) {
        return;
      }

      this.handleMessage(event.data);
    });

    socket.addEventListener("error", (event) => {
      if (this.webSocket !== socket) {
        return;
      }

      if (!this.ready) {
        this.rejectReadyWaiter(new ClickyVoiceAgentError("Voice Agent connection failed.", "voice_agent_ws_error", event));
        return;
      }

      this.options.onStatus("Voice Agent unavailable");
      this.options.onError?.("Voice Agent unavailable.", event);
    });

    socket.addEventListener("close", (event) => {
      if (this.webSocket !== socket) {
        return;
      }

      this.ready = false;
      this.webSocket = null;
      const closeError = new ClickyVoiceAgentError(
        `Voice Agent closed before it was ready (${event.code || "unknown"}).`,
        "voice_agent_ws_closed",
        { code: event.code, reason: event.reason, sessionId: this.sessionId || null }
      );

      if (!this.stopped) {
        this.rejectReadyWaiter(closeError);
        void this.cleanupMediaResources().finally(() => {
          this.options.onStatus("Disconnected");
          this.options.onNote("Maria disconnected.");
        });
      } else {
        this.rejectReadyWaiter(this.createDisconnectedError());
        void this.cleanupMediaResources();
      }
    });

    await readyPromise;
  }

  private createDisconnectedError() {
    return new ClickyVoiceAgentError("Voice Agent disconnected.", "voice_agent_disconnected");
  }

  private throwIfStopped() {
    if (this.stopped) {
      throw this.createDisconnectedError();
    }
  }

  private async closeAndCleanup(code: number, reason: string) {
    const socket = this.webSocket;
    this.webSocket = null;

    try {
      if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
        socket.close(code, reason);
      }
    } catch {}

    await this.cleanupMediaResources();
  }

  private async cleanupMediaResources() {
    this.ready = false;
    this.flushPlayback();

    try {
      this.workletNode?.port.postMessage({ type: "set-muted", muted: true });
    } catch {}

    try {
      this.sourceNode?.disconnect();
    } catch {}
    try {
      this.workletNode?.disconnect();
    } catch {}
    try {
      this.silentGainNode?.disconnect();
    } catch {}

    this.sourceNode = null;
    this.workletNode = null;
    this.silentGainNode = null;

    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;

    const context = this.audioContext;
    this.audioContext = null;
    await context?.close().catch(() => undefined);

    this.pendingToolResults = [];
    this.toolResultsCanSend = false;
    this.toolGeneration += 1;
  }

  private resolveReadyWaiter() {
    if (!this.readyWaiter) {
      return;
    }

    window.clearTimeout(this.readyWaiter.timeoutId);
    this.readyWaiter.resolve();
    this.readyWaiter = null;
  }

  private rejectReadyWaiter(error: Error) {
    if (!this.readyWaiter) {
      return;
    }

    window.clearTimeout(this.readyWaiter.timeoutId);
    this.readyWaiter.reject(error);
    this.readyWaiter = null;
  }

  private sendJson(value: unknown) {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(value));
    }
  }

  private sendInputAudio(buffer: ArrayBuffer) {
    if (!this.ready || this.webSocket?.readyState !== WebSocket.OPEN || !buffer.byteLength) {
      return;
    }

    this.sendJson({
      type: "input.audio",
      audio: arrayBufferToBase64(buffer),
    });
  }

  private handleMessage(rawData: unknown) {
    let message: VoiceAgentMessage;
    try {
      message = JSON.parse(String(rawData || "{}")) as VoiceAgentMessage;
    } catch {
      return;
    }

    const type = readString(message.type);
    if (!type) {
      return;
    }

    if (type === "session.ready") {
      this.ready = true;
      this.sessionId = readString(message.session_id);
      if (this.sessionId) {
        console.info("[ClickyVoiceAgent] Maria session ready", { sessionId: this.sessionId });
      }
      this.playbackTime = this.audioContext?.currentTime || 0;
      this.resolveReadyWaiter();
      this.options.onStatus("Maria listening");
      this.options.onNote("Maria is listening.");
      return;
    }

    if (type === "session.error" || type === "error") {
      const error = new ClickyVoiceAgentError(
        readString(message.message, "Voice Agent unavailable."),
        readString(message.code, "voice_agent_session_error"),
        message
      );
      this.options.onStatus("Voice Agent unavailable");
      this.options.onError?.("Voice Agent unavailable.", error);
      this.rejectReadyWaiter(error);
      return;
    }

    if (type === "input.speech.started") {
      this.options.onStatus("Maria listening");
      return;
    }

    if (type === "input.speech.stopped") {
      this.options.onStatus("Connecting");
      return;
    }

    if (type === "reply.started") {
      this.options.onStatus("Maria speaking");
      return;
    }

    if (type === "reply.audio") {
      const audio = readString(message.data || message.audio);
      if (audio) {
        this.playPcmAudio(audio);
      }
      return;
    }

    if (type === "transcript.user") {
      const text = readString(message.text);
      if (text) {
        this.options.onTranscript?.({ role: "user", text });
        this.options.onNote(`You said: ${text}`);
      }
      return;
    }

    if (type === "transcript.agent") {
      const text = readString(message.text);
      if (text) {
        this.options.onTranscript?.({ role: "assistant", text });
        this.options.onNote(text);
      }
      return;
    }

    if (type === "tool.call") {
      void this.handleToolCall(message);
      return;
    }

    if (type === "reply.done") {
      if (message.status === "interrupted") {
        this.flushPlayback();
        this.pendingToolResults = [];
        this.toolResultsCanSend = false;
        this.toolGeneration += 1;
      } else {
        this.toolResultsCanSend = true;
        this.flushPendingToolResults();
      }

      this.options.onStatus("Maria listening");
    }
  }

  private playPcmAudio(base64Audio: string) {
    if (!this.audioContext) {
      return;
    }

    const bytes = base64ToUint8Array(base64Audio);
    if (bytes.byteLength < 2) {
      return;
    }

    const sampleCount = Math.floor(bytes.byteLength / 2);
    const audioBuffer = this.audioContext.createBuffer(1, sampleCount, SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let index = 0; index < sampleCount; index++) {
      channelData[index] = view.getInt16(index * 2, true) / 0x8000;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.onended = () => {
      this.playbackSources.delete(source);
    };

    const startAt = Math.max(this.audioContext.currentTime + 0.01, this.playbackTime);
    source.start(startAt);
    this.playbackTime = startAt + audioBuffer.duration;
    this.playbackSources.add(source);
    this.options.onStatus("Maria speaking");
  }

  private flushPlayback() {
    for (const source of this.playbackSources) {
      try {
        source.stop();
      } catch {}
    }

    this.playbackSources.clear();
    this.playbackTime = this.audioContext?.currentTime || 0;
  }

  private async handleToolCall(message: VoiceAgentMessage) {
    const name = readString(message.name);
    const callId = readString(message.call_id || message.callId);
    const args = parseToolArgs(message.args || message.arguments);
    const command = readString(args.command);
    const mode = readToolMode(args.mode);
    const generation = this.toolGeneration;

    this.toolResultsCanSend = false;

    if (!callId) {
      return;
    }

    if (name !== "run_clicky_command") {
      this.pendingToolResults.push({
        callId,
        result: {
          ok: false,
          message: `Unknown tool: ${name || "unnamed tool"}`,
        },
      });
      return;
    }

    if (!command) {
      this.pendingToolResults.push({
        callId,
        result: {
          ok: false,
          message: "No command was provided.",
        },
      });
      return;
    }

    this.options.onStatus("Running Clicky action");
    this.options.onNote(`Running Clicky action: ${command}`);

    try {
      const result = await this.options.onToolCall({ callId, command, mode });
      if (generation !== this.toolGeneration) {
        return;
      }

      this.pendingToolResults.push({
        callId,
        result,
      });
      this.flushPendingToolResults();
    } catch (error) {
      if (generation !== this.toolGeneration) {
        return;
      }

      this.pendingToolResults.push({
        callId,
        result: {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        },
      });
      this.flushPendingToolResults();
    }
  }

  private flushPendingToolResults() {
    if (!this.toolResultsCanSend || this.webSocket?.readyState !== WebSocket.OPEN || this.pendingToolResults.length === 0) {
      return;
    }

    const pendingResults = this.pendingToolResults.splice(0);
    for (const tool of pendingResults) {
      this.sendJson({
        type: "tool.result",
        call_id: tool.callId,
        result: JSON.stringify(tool.result),
      });
    }
  }
}
