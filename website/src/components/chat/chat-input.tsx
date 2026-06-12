"use client";

import Image from "next/image";
import { useCallback, useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp,
  Square,
  X,
  Mic,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { selectChatAttachmentFiles } from "@/lib/chat/attachment-intake";
import {
  MAX_CHAT_ATTACHMENTS_PER_MESSAGE,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
  formatChatAttachmentSize,
} from "@/lib/chat/attachments";
import { isSafeGeneratedMediaMimeType } from "@/lib/chat/generated-media-url";
import type { DesktopWorkspaceScope } from "@/lib/chat/permissions";
import {
  LOCAL_VOICE_MAX_RECORDING_MS,
  LOCAL_VOICE_MIN_AUDIO_BYTES,
  createAudioRecorder,
  createVoiceRequestId,
  getLocalVoiceFailureMessage,
  hasLocalVoiceCapturePrimitives,
  probeLocalMariaVoiceService,
  shouldUseLocalVoiceCapture,
  transcribeWithLocalMaria,
  type LocalVoiceDebugMetadata,
} from "@/lib/maria/local-transcription";
import { createClientLogger } from "@/lib/client-diagnostics";
import { toast } from "sonner";

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  onSend: (text: string, files?: File[]) => void;
  isLoading: boolean;
  queuedMessageCount: number;
  onStop: () => void;
  workspaceScope?: DesktopWorkspaceScope;
  onPickWorkspaceFolder?: () => void;
  placeholder?: string | null;
}

type PendingFile = {
  file: File;
  id: string;
  preview: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
  message?: string;
  type?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type BrowserFileSystemEntry = BrowserFileSystemFileEntry | BrowserFileSystemDirectoryEntry;

type BrowserFileSystemFileEntry = {
  isFile: true;
  isDirectory: false;
  name: string;
  file: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
};

type BrowserFileSystemDirectoryEntry = {
  isFile: false;
  isDirectory: true;
  name: string;
  createReader: () => BrowserFileSystemDirectoryReader;
};

function ignoreExpectedChatInputBrowserError(error: unknown) {
  void error;
}

type BrowserFileSystemDirectoryReader = {
  readEntries: (
    success: (entries: BrowserFileSystemEntry[]) => void,
    failure?: (error: DOMException) => void
  ) => void;
};

const log = createClientLogger("ChatInput");

type DataTransferItemWithEntry = {
  webkitGetAsEntry?: () => unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isBrowserFileSystemEntry(value: unknown): value is BrowserFileSystemEntry {
  if (!isRecord(value) || typeof value.name !== "string") {
    return false;
  }

  if (value.isFile === true) {
    return value.isDirectory === false && typeof value.file === "function";
  }

  if (value.isDirectory === true) {
    return value.isFile === false && typeof value.createReader === "function";
  }

  return false;
}

function getDataTransferItemEntry(item: DataTransferItem): BrowserFileSystemEntry | null {
  const entryGetter = (item as DataTransferItemWithEntry).webkitGetAsEntry;
  if (typeof entryGetter !== "function") {
    return null;
  }

  const entry = entryGetter.call(item);
  return isBrowserFileSystemEntry(entry) ? entry : null;
}

function createPendingFile(file: File): PendingFile {
  const hasImagePreview = isSafeGeneratedMediaMimeType(file.type, "image");

  return {
    file,
    id: Math.random().toString(36).substring(7),
    preview: hasImagePreview ? URL.createObjectURL(file) : "",
  };
}

function normalizePastedImage(file: File, index: number) {
  if (file.name) {
    return file;
  }

  const extension = file.type.split("/")[1] || "png";

  return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
    type: file.type || "image/png",
    lastModified: Date.now(),
  });
}

function revokePendingFilePreview(file: PendingFile) {
  if (file.preview) {
    URL.revokeObjectURL(file.preview);
  }
}

function getWorkspaceScopeLabel(scope?: DesktopWorkspaceScope) {
  const path = scope?.path?.trim();
  if (!path) {
    return "Work in a Folder";
  }

  const basename = path
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop();

  return basename ? `Working in ${basename}` : "Work in a Folder";
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechRecognitionWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechRecognitionWindow.SpeechRecognition || speechRecognitionWindow.webkitSpeechRecognition || null;
}

function getSpeechRecognitionErrorCode(error: unknown) {
  if (isRecord(error)) {
    const errorCode = typeof error.error === "string" ? error.error : "";
    const message = typeof error.message === "string" ? error.message : "";
    const type = typeof error.type === "string" ? error.type : "";

    return errorCode || message || type || "unknown";
  }

  return "unknown";
}

export function ChatInput({
  input,
  setInput,
  onSend,
  isLoading,
  queuedMessageCount,
  onStop,
  workspaceScope,
  onPickWorkspaceFolder,
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedFilesRef = useRef<PendingFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<PendingFile[]>([]);

  // Voice to text state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [localApiPort, setLocalApiPort] = useState<number | null>(null);
  const [isLocalVoiceServiceReachable, setIsLocalVoiceServiceReachable] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceRecordingRequestIdRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined" || !hasLocalVoiceCapturePrimitives()) {
      return;
    }

    let isActive = true;

    const normalizePort = (port: unknown) =>
      typeof port === "number" && Number.isFinite(port) && port > 0 ? port : null;

    const refreshLocalApi = async () => {
      const bridgePort = normalizePort(await window.electron?.localApiPort?.().catch(() => null));
      if (isActive && bridgePort) {
        setLocalApiPort(bridgePort);
      }

      const probe = await probeLocalMariaVoiceService({ localApiPort: bridgePort });
      if (!isActive) {
        return;
      }

      setIsLocalVoiceServiceReachable(probe.ok);
      if (probe.ok && probe.port) {
        setLocalApiPort(probe.port);
      }
    };

    // If we're on a secure (HTTPS) hosted page with no desktop bridge,
    // indicate clearly that local voice features require the desktop app.
    try {
      const isSecure = Boolean(window.location && window.location.protocol === "https:");
      const hasBridge = Boolean(window.electron && typeof window.electron.localApiPort === "function");
      if (isSecure && !hasBridge) {
        setVoiceStatus("Voice features require the Rearvy desktop app when using the hosted site.");
        setIsLocalVoiceServiceReachable(false);
        setLocalApiPort(null);
        // skip attempting to probe since that will be blocked by browser
        return;
      }
    } catch {
      // ignore and proceed with normal probe
    }

    const unsubscribePort =
      window.electron?.onLocalApiPort?.((port) => {
        const normalizedPort = normalizePort(port);
        if (normalizedPort) {
          setLocalApiPort(normalizedPort);
          setIsLocalVoiceServiceReachable(true);
        }
      }) ?? (() => {});

    const handleElectronReady = () => {
      void refreshLocalApi();
    };

    window.addEventListener("rearvy-electron-ready", handleElectronReady);
    void refreshLocalApi();

    return () => {
      isActive = false;
      unsubscribePort();
      window.removeEventListener("rearvy-electron-ready", handleElectronReady);
    };
  }, []);

  // Setup SpeechRecognition for hosted-web fallback only.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = getSpeechRecognitionConstructor();
    setIsSpeechSupported(Boolean(SpeechRecognition));

    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) {
          transcript += result[0].transcript;
        }
      }

      const normalized = transcript.trim();
      if (!normalized) {
        return;
      }

      setInput((prev) => (prev ? `${prev} ${normalized}` : normalized));
      setVoiceError(null);
      setVoiceStatus(null);
      setIsRecording(false);
    };
    recognitionRef.current.onerror = (event) => {
      const errorCode = getSpeechRecognitionErrorCode(event);
      setVoiceStatus(null);
      setVoiceError(
        errorCode === "no-speech"
          ? "I did not catch that."
          : "Browser voice input failed. Check microphone permissions and try again."
      );
      setIsRecording(false);
    };
    recognitionRef.current.onend = () => {
      setVoiceStatus(null);
      setIsRecording(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [setInput]);

  const clearRecordingTimeout = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const stopRecordingTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const finishLocalVoiceRecording = async (blob: Blob, metadata: LocalVoiceDebugMetadata) => {
    if (!blob.size || blob.size < LOCAL_VOICE_MIN_AUDIO_BYTES) {
      setVoiceStatus(null);
      setVoiceError("I did not catch that.");
      return;
    }

    setIsTranscribing(true);
    setVoiceStatus("Transcribing...");
    setVoiceError(null);

    try {
      const transcript = await transcribeWithLocalMaria(
        blob,
        {
          ...metadata,
          audioBytes: blob.size,
          mimeType: blob.type || metadata.mimeType,
        },
        {
          localApiPort,
        }
      );

      if (!transcript) {
        setVoiceError("I did not catch that.");
        return;
      }

      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setVoiceStatus(null);
      setVoiceError(null);
      textareaRef.current?.focus();
    } catch (error) {
      log.warn("Chat voice transcription failed:", error);
      setVoiceStatus(null);
      setVoiceError(getLocalVoiceFailureMessage(error));
    } finally {
      setIsTranscribing(false);
    }
  };

  const stopLocalVoiceRecording = () => {
    clearRecordingTimeout();
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setIsRecording(false);
      stopRecordingTracks();
      return;
    }

    if (recorder.state !== "inactive") {
      try {
        recorder.requestData();
      } catch (error) {
        ignoreExpectedChatInputBrowserError(error);
      }
      recorder.stop();
    }
  };

  const startLocalVoiceRecording = async () => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function" || typeof MediaRecorder === "undefined") {
      setVoiceStatus(null);
      setVoiceError("Microphone recording is not available.");
      return;
    }

    try {
      setVoiceStatus(null);
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createAudioRecorder(stream);
      const requestId = createVoiceRequestId();
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = performance.now();
      voiceRecordingRequestIdRef.current = requestId;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimeout();
        const durationMs =
          recordingStartedAtRef.current === null
            ? 0
            : Math.max(0, Math.round(performance.now() - recordingStartedAtRef.current));
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const metadata: LocalVoiceDebugMetadata = {
          requestId: voiceRecordingRequestIdRef.current || createVoiceRequestId(),
          audioBytes: blob.size,
          mimeType: blob.type || recorder.mimeType || "unknown",
          durationMs,
        };

        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = null;
        voiceRecordingRequestIdRef.current = "";
        setIsRecording(false);
        stopRecordingTracks();
        void finishLocalVoiceRecording(blob, metadata);
      };

      recorder.start();
      setIsRecording(true);
      setVoiceStatus("Listening...");
      recordingTimeoutRef.current = window.setTimeout(
        stopLocalVoiceRecording,
        LOCAL_VOICE_MAX_RECORDING_MS
      );
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      setIsRecording(false);
      setVoiceStatus(null);
      recordingStartedAtRef.current = null;
      voiceRecordingRequestIdRef.current = "";
      stopRecordingTracks();
      setVoiceError(
        errorName === "NotAllowedError" || errorName === "PermissionDeniedError"
          ? "Microphone permission needed."
          : "Could not start microphone recording."
      );
    }
  };

  useEffect(() => {
    return () => {
      clearRecordingTimeout();
      try {
        const recorder = mediaRecorderRef.current;
        if (recorder) {
          recorder.ondataavailable = null;
          recorder.onstop = null;
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        }
      } catch (error) {
        ignoreExpectedChatInputBrowserError(error);
      }
      stopRecordingTracks();
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      recordingStartedAtRef.current = null;
      voiceRecordingRequestIdRef.current = "";
    };
  }, [clearRecordingTimeout, stopRecordingTracks]);

  const shouldUseLocalVoice = shouldUseLocalVoiceCapture({
    localApiPort,
    localApiReachable: isLocalVoiceServiceReachable,
  });

  const handleMicClick = () => {
    if (isTranscribing) {
      return;
    }

    if (shouldUseLocalVoice) {
      if (isRecording) {
        stopLocalVoiceRecording();
      } else {
        void startLocalVoiceRecording();
      }
      return;
    }

    if (!recognitionRef.current) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setVoiceStatus(null);
    } else {
      setVoiceError(null);
      setVoiceStatus(null);
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setVoiceStatus("Listening...");
      } catch {
        setIsRecording(false);
        setVoiceStatus(null);
        setVoiceError("Microphone is already in use. Please wait and try again.");
      }
    }
  };

  const appendFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const { accepted, rejected } = selectChatAttachmentFiles(
      files,
      selectedFilesRef.current.length
    );

    const oversized = rejected.find((item) => item.reason === "size");
    if (oversized) {
      toast.error(
        `${oversized.file.name || "Attachment"} is larger than ${formatChatAttachmentSize(MAX_CHAT_ATTACHMENT_SIZE_BYTES)}.`
      );
    }

    if (rejected.some((item) => item.reason === "limit")) {
      toast.error(`Attach up to ${MAX_CHAT_ATTACHMENTS_PER_MESSAGE} files.`);
    }

    if (accepted.length > 0) {
      setSelectedFiles((prev) => [...prev, ...accepted.map(createPendingFile)]);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      for (const file of selectedFilesRef.current) {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const submitCurrentMessage = () => {
    if (input.trim() || selectedFiles.length > 0) {
      onSend(input, selectedFiles.map((f) => f.file));
      selectedFiles.forEach(revokePendingFilePreview);
      selectedFilesRef.current = [];
      setSelectedFiles([]);
      setInput("");
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitCurrentMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCurrentMessage();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFilesFromItems = Array.from(e.clipboardData.items)
      .filter(
        (item) =>
          item.kind === "file" &&
          isSafeGeneratedMediaMimeType(item.type, "image")
      )
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .map(normalizePastedImage);

    const imageFiles =
      imageFilesFromItems.length > 0
        ? imageFilesFromItems
        : Array.from(e.clipboardData.files)
            .filter((file) => isSafeGeneratedMediaMimeType(file.type, "image"))
            .map(normalizePastedImage);

    if (imageFiles.length === 0) {
      return;
    }

    e.preventDefault();
    appendFiles(imageFiles);
  };

  // Traverse dropped folders and files (supports directory entries in Chromium-based browsers)
  const traverseFileTree = (entry: BrowserFileSystemEntry | null, path = "", collected: File[] = []): Promise<void> =>
    new Promise((resolve) => {
      if (!entry) return resolve();

      if (entry.isFile) {
        entry.file((file: File) => {
          collected.push(file);
          resolve();
        }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readEntries = () => {
          reader.readEntries(async (entries) => {
            if (!entries || entries.length === 0) return resolve();
            await Promise.all(entries.map((e) => traverseFileTree(e, `${path}${entry.name}/`, collected)));
            // continue reading until no more entries
            readEntries();
          }, () => resolve());
        };
        readEntries();
      } else {
        resolve();
      }
    });

  const getFilesFromDataTransfer = async (dt: DataTransfer) => {
    const files: File[] = [];

    // Prefer items (allows directories via webkitGetAsEntry)
    if (dt.items && dt.items.length > 0) {
      const items = Array.from(dt.items);
      for (const item of items) {
        try {
          const entry = getDataTransferItemEntry(item);
          if (entry) {
            // traverse folder/file entries
            // traverseFileTree will push files into `files`
            await traverseFileTree(entry, "", files);
          } else {
            const f = item.getAsFile?.();
            if (f) files.push(f);
          }
        } catch {
          const f = item.getAsFile?.();
          if (f) files.push(f);
        }
      }
    } else if (dt.files && dt.files.length > 0) {
      files.push(...Array.from(dt.files));
    }

    return files;
  };

  const handleDrop = async (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const dt = e.dataTransfer;
    if (!dt) return;

    const droppedFiles = await getFilesFromDataTransfer(dt);
    if (droppedFiles.length > 0) {
      appendFiles(droppedFiles);
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      const removed = prev.find((f) => f.id === id);
      if (removed) {
        revokePendingFilePreview(removed);
      }
      return filtered;
    });
  };

  const hasDraft = input.trim().length > 0 || selectedFiles.length > 0;
  const workspaceLabel = getWorkspaceScopeLabel(workspaceScope);
  const hasWorkspaceScope = Boolean(workspaceScope?.path?.trim());

  return (
    <>
      <form
        onSubmit={handleFormSubmit}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDrop}
        className="relative mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-2"
      >

        {/* File Previews */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {selectedFiles.map((file) => (
              <div key={file.id} className="relative group animate-in fade-in zoom-in duration-200">
                {file.preview ? (
                  <div className="h-16 w-16 overflow-hidden rounded-[8px] border border-border bg-muted">
                    <Image
                      src={file.preview}
                      alt="preview"
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-[8px] border border-border bg-muted">
                    <span className="truncate px-1 text-[11px] font-medium text-muted-foreground">
                      {file.file.name.split('.').pop()}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-[8px] border border-background bg-red-500 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="flex min-w-0 items-end gap-1.5 rounded-[8px] border border-border/70 bg-card/85 p-1.5 shadow-sm shadow-slate-950/[0.04] backdrop-blur-xl sm:gap-2 sm:p-2">
          {/* Voice to text button */}
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "secondary" : "ghost"}
            onClick={handleMicClick}
            className={cn(
              "h-10 w-10 rounded-[8px] text-muted-foreground transition-all hover:bg-muted/80 sm:h-[44px] sm:w-[44px]",
              isRecording && "bg-green-100 text-green-700 scale-105"
            )}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
            title={
              shouldUseLocalVoice
                ? isRecording
                  ? "Stop and transcribe voice"
                  : "Start voice input"
                : isSpeechSupported
                  ? isRecording
                    ? "Stop voice input"
                    : "Start voice input"
                  : "Voice input is not supported in this browser"
            }
            disabled={(!isSpeechSupported && !shouldUseLocalVoice) || isTranscribing}
          >
            <Mic className={cn("h-5 w-5", isRecording && "animate-pulse")}/>
          </Button>

          <div className="relative min-w-0 flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                placeholder ||
                "Ask Rearvy to do anything allowed. It will execute, ask for missing details, or stop safely."
              }
              className="min-h-[44px] max-h-[200px] resize-none rounded-[8px] border-0 bg-transparent px-2.5 py-2 pr-11 text-[14px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-3 sm:pr-12 sm:text-[15px]"
              rows={1}
            />
          </div>

          {isLoading && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onStop}
              className="h-10 w-10 shrink-0 rounded-[8px] border-border/70 bg-background/70 sm:h-[44px] sm:w-[44px]"
              aria-label="Stop response"
              title="Stop response"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}

          {(!isLoading || hasDraft) && (
            <Button
              type="submit"
              size="icon"
              disabled={!hasDraft}
              className="h-10 w-10 shrink-0 rounded-[8px] sm:h-[44px] sm:w-[44px]"
              aria-label={isLoading ? "Queue message" : "Send message"}
              title={isLoading ? "Queue message" : "Send message"}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>

        {onPickWorkspaceFolder && hasWorkspaceScope && (
          <button
            type="button"
            onClick={onPickWorkspaceFolder}
            className="mx-2 flex min-w-0 items-center gap-2 self-start rounded-[8px] px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            title={workspaceScope?.path || workspaceLabel}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate">{workspaceLabel}</span>
          </button>
        )}

        {queuedMessageCount > 0 && (
          <p className="px-3 text-xs text-muted-foreground" role="status" aria-live="polite">
            {queuedMessageCount === 1
              ? "1 message queued. It will send automatically when the current reply finishes."
              : `${queuedMessageCount} messages queued. They will send automatically in order.`}
          </p>
        )}

        {voiceStatus && (
          <p className="px-3 text-xs text-muted-foreground" role="status" aria-live="polite">
            {voiceStatus}
          </p>
        )}

        {voiceError && (
          <p className="px-3 text-xs text-red-500" role="status" aria-live="polite">
            {voiceError}
          </p>
        )}
      </form>
    </>
  );
}
