"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Square, Zap, Plus, Image as ImageIcon, Folder, X, FileText } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/plans";
import {
  isChatModelTier,
  type ChatModelOption,
  type ChatModelTier,
} from "@/lib/ai/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (text: string) => void;
  isLoading: boolean;
  onStop: () => void;
  aiModel?: ChatModelTier;
  availableModels: ChatModelOption[];
  currentPlan: SubscriptionPlan;
  onModelChange?: (model: ChatModelTier) => void;
}

type DirectoryInputAttributes = React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};

const directoryInputAttributes: DirectoryInputAttributes = {
  webkitdirectory: "",
  directory: "",
};

export function ChatInput({
  input,
  setInput,
  onSend,
  isLoading,
  onStop,
  aiModel = "free",
  availableModels,
  currentPlan,
  onModelChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; id: string; preview: string }[]>([]);

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

  const activeModel =
    availableModels.find((model) => model.id === aiModel) ?? availableModels[0];

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSend(input);
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input value to allow selecting same file again
    e.target.value = '';
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(file => ({
        file,
        id: Math.random().toString(36).substring(7),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input value
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      // Clean up object URLs
      const removed = prev.find(f => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  return (
    <form
      onSubmit={handleFormSubmit}
      className="relative mx-auto flex w-full max-w-4xl flex-col gap-2"
    >
      {/* File Previews */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          {selectedFiles.map((file) => (
            <div key={file.id} className="relative group animate-in fade-in zoom-in duration-200">
              {file.preview ? (
                <div className="h-16 w-16 rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={file.preview} alt="preview" className="h-full w-full object-cover" />
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

      {/* Model Selector */}
      <div className="flex items-center gap-2 px-1">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">AI Model:</span>
        {availableModels.length > 1 ? (
            <Select
              value={activeModel.id}
              onValueChange={(value: string) => {
                if (isChatModelTier(value)) {
                  onModelChange?.(value);
                }
              }}
            >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label} ({model.description.replace("Included in ", "")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm">
            <span className="font-medium text-foreground">{activeModel.label}</span>
            <span className="text-muted-foreground">
              {currentPlan === "pro" ? "Included in Pro" : "Included in Free"}
            </span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex items-end gap-2 rounded-[2rem] border border-border/70 bg-card/75 p-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl">
        {/* Custom overlay-free file picker dropdown */}
        <div ref={dropdownRef} className="relative shrink-0">
          {/* Dropdown menu - absolutely positioned, no blocking overlay */}
          {isMenuOpen && (
            <div className="absolute bottom-full mb-2 left-0 z-50 w-52 p-2 rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden">
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
              "h-[44px] w-[44px] rounded-2xl text-muted-foreground transition-all hover:bg-muted/80",
              isMenuOpen && "bg-muted text-primary scale-105"
            )}
            disabled={isLoading}
          >
            <Plus className={cn("h-5 w-5 transition-transform", isMenuOpen && "rotate-45")} />
          </Button>
        </div>

        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your business..."
            className="min-h-[44px] max-h-[200px] resize-none rounded-[1.5rem] border-0 bg-transparent px-3 py-2 pr-12 text-[15px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
            disabled={isLoading}
          />
        </div>

        {isLoading ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onStop}
            className="h-[44px] w-[44px] shrink-0 rounded-2xl border-border/70 bg-background/70"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            className="h-[44px] w-[44px] shrink-0 rounded-2xl"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
