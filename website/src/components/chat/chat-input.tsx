"use client";

import Image from "next/image";
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp,
  Square,
  Plus,
  Image as ImageIcon,
  Folder,
  X,
  FileText,
  Mic,
  ShieldCheck,
  ShieldAlert,
  Check,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandSuggestions, COMMANDS } from "./command-suggestions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ChatPermissionMode,
  DesktopWorkspaceScope,
} from "@/lib/chat/permissions";

interface ChatInputProps {
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  onSend: (text: string, files?: File[]) => void;
  isLoading: boolean;
  queuedMessageCount: number;
  onStop: () => void;
  permissionMode: ChatPermissionMode;
  onPermissionModeChange: (mode: ChatPermissionMode) => void;
  workspaceScope?: DesktopWorkspaceScope;
  onPickWorkspaceFolder?: () => void;
  isDesktopWorkspaceAvailable?: boolean;
  placeholder?: string | null;
}

type DirectoryInputAttributes = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

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

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const directoryInputAttributes: DirectoryInputAttributes = {
  webkitdirectory: "",
  directory: "",
};

function createPendingFile(file: File): PendingFile {
  return {
    file,
    id: Math.random().toString(36).substring(7),
    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
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

export function ChatInput({
  input,
  setInput,
  onSend,
  isLoading,
  queuedMessageCount,
  onStop,
  permissionMode,
  onPermissionModeChange,
  workspaceScope,
  onPickWorkspaceFolder,
  isDesktopWorkspaceAvailable = false,
  placeholder,
}: ChatInputProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedFilesRef = useRef<PendingFile[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<PendingFile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Voice to text state
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const speechRecognitionWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    return Boolean(
      speechRecognitionWindow.SpeechRecognition || speechRecognitionWindow.webkitSpeechRecognition
    );
  });
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Setup SpeechRecognition
  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechRecognitionWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition =
      speechRecognitionWindow.SpeechRecognition || speechRecognitionWindow.webkitSpeechRecognition;

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
      setIsRecording(false);
    };
    recognitionRef.current.onerror = () => {
      setVoiceError("Could not capture audio. Check microphone permissions and try again.");
      setIsRecording(false);
    };
    recognitionRef.current.onend = () => {
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

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setVoiceError(null);
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch {
        setIsRecording(false);
        setVoiceError("Microphone is already in use. Please wait and try again.");
      }
    }
  };

  const appendFiles = (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files.map(createPendingFile)]);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMenuOpen]);

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
    const value = e.target.value;
    setInput(value);

    // Command suggestions trigger: starts with / and no spaces before it
    if (value === "/") {
      setShowSuggestions(true);
      setFocusedIndex(0);
    } else if (value.includes("/") && !value.includes(" ") && value.startsWith("/")) {
      setShowSuggestions(true);
    } else if (value.startsWith("/sku ") && value.length >= 5) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleCommandSelect = (command: string) => {
    setInput(command);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const submitCurrentMessage = () => {
    if (input.trim() || selectedFiles.length > 0) {
      onSend(input, selectedFiles.map((f) => f.file));
      setSelectedFiles([]);
      setInput("");
      setShowSuggestions(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitCurrentMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const filteredCommands = COMMANDS.filter(
      (command) =>
        command.name.startsWith(input) ||
        command.id.includes(input.replace("/", ""))
    );

    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          setFocusedIndex((prev) => (prev + 1) % filteredCommands.length);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          setFocusedIndex(
            (prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length
          );
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[focusedIndex]) {
          handleCommandSelect(filteredCommands[focusedIndex].name + " ");
        } else {
          submitCurrentMessage();
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCurrentMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      appendFiles(Array.from(files));
    }
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      appendFiles(Array.from(files));
    }
    // Reset input value
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFilesFromItems = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .map(normalizePastedImage);

    const imageFiles =
      imageFilesFromItems.length > 0
        ? imageFilesFromItems
        : Array.from(e.clipboardData.files)
            .filter((file) => file.type.startsWith("image/"))
            .map(normalizePastedImage);

    if (imageFiles.length === 0) {
      return;
    }

    e.preventDefault();
    appendFiles(imageFiles);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      // Clean up object URLs
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const hasDraft = input.trim().length > 0 || selectedFiles.length > 0;
  const PermissionIcon =
    permissionMode === "full-access" ? ShieldAlert : ShieldCheck;
  const permissionLabel =
    permissionMode === "full-access" ? "Full Access" : "Default Permission";
  const workspaceLabel =
    permissionMode === "full-access"
      ? "Switch to Folder Scope"
      : getWorkspaceScopeLabel(workspaceScope);

  return (
    <>
      <form
        onSubmit={handleFormSubmit}
        className="relative mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-2"
      >

        {/* File Previews */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {selectedFiles.map((file) => (
              <div key={file.id} className="relative group animate-in fade-in zoom-in duration-200">
                {file.preview ? (
                  <div className="h-16 w-16 rounded-lg overflow-hidden border border-border bg-muted">
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
                  <div className="h-16 w-16 rounded-lg border border-border bg-muted flex items-center justify-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground truncate px-1">
                      {file.file.name.split('.').pop()}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="flex min-w-0 items-end gap-1.5 rounded-[2rem] border border-border/70 bg-card/75 p-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:gap-2 sm:p-2">
          {/* Custom overlay-free file picker dropdown */}
          <div ref={dropdownRef} className="relative shrink-0">
            {/* Dropdown menu - absolutely positioned, no blocking overlay */}
            {isMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 text-sm transition-colors cursor-pointer w-full">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => { handleFileChange(e); setIsMenuOpen(false); }}
                      className="sr-only"
                    />
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">Images</span>
                      <span className="text-[10px] text-muted-foreground">Photos & visuals</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 text-sm transition-colors cursor-pointer w-full">
                    <input
                      type="file"
                      multiple
                      onChange={(e) => { handleFileChange(e); setIsMenuOpen(false); }}
                      className="sr-only"
                    />
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">Files</span>
                      <span className="text-[10px] text-muted-foreground">Documents & data</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 text-sm transition-colors cursor-pointer w-full">
                    <input
                      type="file"
                      {...directoryInputAttributes}
                      onChange={(e) => { handleFolderChange(e); setIsMenuOpen(false); }}
                      className="sr-only"
                    />
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">Folder</span>
                      <span className="text-[10px] text-muted-foreground">Upload directory</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setIsMenuOpen((v) => !v)}
              className={cn(
                "h-10 w-10 rounded-2xl text-muted-foreground transition-all hover:bg-muted/80 sm:h-[44px] sm:w-[44px]",
                isMenuOpen && "bg-muted text-primary scale-105"
              )}
            >
              <Plus className={cn("h-5 w-5 transition-transform", isMenuOpen && "rotate-45")} />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-10 max-w-[11rem] rounded-2xl px-2.5 text-muted-foreground transition-all hover:bg-muted/80 sm:h-[44px] sm:max-w-[13rem] sm:px-3",
                  permissionMode === "full-access" &&
                    "bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                )}
                aria-label={`Chat permission: ${permissionLabel}`}
                title={`Chat permission: ${permissionLabel}`}
              >
                <PermissionIcon className="h-4 w-4" />
                <span className="hidden min-w-0 truncate text-sm sm:inline">
                  {permissionLabel}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={10}
              className="w-[20rem] rounded-2xl border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-xl"
            >
              <DropdownMenuItem
                onSelect={() => onPermissionModeChange("default")}
                className="cursor-pointer items-start gap-3 rounded-xl p-3"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Default Permission</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Runs with sandboxed and approval-gated tools.
                  </div>
                </div>
                {permissionMode === "default" ? (
                  <Check className="mt-0.5 h-4 w-4" />
                ) : null}
              </DropdownMenuItem>

              <DropdownMenuItem
                disabled={!isDesktopWorkspaceAvailable}
                onSelect={() => onPermissionModeChange("full-access")}
                className="cursor-pointer items-start gap-3 rounded-xl p-3 data-[disabled]:cursor-not-allowed"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-300" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Full Access</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {isDesktopWorkspaceAvailable
                      ? "Allows desktop workflows outside the selected folder. High risk."
                      : "Requires the Rearvy desktop app. High risk."}
                  </div>
                </div>
                {permissionMode === "full-access" ? (
                  <Check className="mt-0.5 h-4 w-4" />
                ) : null}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Voice to text button */}
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "secondary" : "ghost"}
            onClick={handleMicClick}
            className={cn(
              "h-10 w-10 rounded-2xl text-muted-foreground transition-all hover:bg-muted/80 sm:h-[44px] sm:w-[44px]",
              isRecording && "bg-green-100 text-green-700 scale-105"
            )}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
            title={
              isSpeechSupported
                ? isRecording
                  ? "Stop voice input"
                  : "Start voice input"
                : "Voice input is not supported in this browser"
            }
            disabled={!isSpeechSupported}
          >
            <Mic className={cn("h-5 w-5", isRecording && "animate-pulse")}/>
          </Button>

          <div className="relative min-w-0 flex-1">
            {showSuggestions && (
              <CommandSuggestions 
                query={input} 
                onSelect={handleCommandSelect}
                focusedIndex={focusedIndex}
              />
            )}
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                placeholder ||
                "Type a message, use + for files, or / for commands"
              }
              className="min-h-[44px] max-h-[200px] resize-none rounded-[1.5rem] border-0 bg-transparent px-2.5 py-2 pr-11 text-[14px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:px-3 sm:pr-12 sm:text-[15px]"
              rows={1}
            />
          </div>

          {isLoading && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onStop}
              className="h-10 w-10 shrink-0 rounded-2xl border-border/70 bg-background/70 sm:h-[44px] sm:w-[44px]"
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
              className="h-10 w-10 shrink-0 rounded-2xl sm:h-[44px] sm:w-[44px]"
              aria-label={isLoading ? "Queue message" : "Send message"}
              title={isLoading ? "Queue message" : "Send message"}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>

        {onPickWorkspaceFolder && (
          <button
            type="button"
            onClick={onPickWorkspaceFolder}
            className="mx-2 flex min-w-0 items-center gap-2 self-start rounded-xl px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
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

        {voiceError && (
          <p className="px-3 text-xs text-red-500" role="status" aria-live="polite">
            {voiceError}
          </p>
        )}
      </form>
    </>
  );
}
