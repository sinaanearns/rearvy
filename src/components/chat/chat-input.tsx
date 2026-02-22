"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Square } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: (text: string) => void;
  isLoading: boolean;
  onStop: () => void;
}

export function ChatInput({
  input,
  setInput,
  onSend,
  isLoading,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <form
      onSubmit={handleFormSubmit}
      className="mx-auto flex max-w-3xl items-end gap-2"
    >
      <div className="relative flex-1">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your business..."
          className="min-h-[44px] max-h-[200px] resize-none pr-12 rounded-xl"
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
          className="h-[44px] w-[44px] shrink-0 rounded-xl"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim()}
          className="h-[44px] w-[44px] shrink-0 rounded-xl"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
