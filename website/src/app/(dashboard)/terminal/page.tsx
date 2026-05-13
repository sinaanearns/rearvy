"use client";

import React from "react";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";
import { Terminal } from "lucide-react";

export default function TerminalPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-6xl mx-auto w-full p-4 md:p-6 gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Terminal className="w-6 h-6 text-blue-600 dark:text-blue-500" />
          Terminal Agent
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Secure, isolated execution environment for local automation tasks. 
          Use this interface to trigger and monitor scripts running directly on your machine.
        </p>
      </div>
      
      <div className="flex-1 min-h-[400px]">
        <TerminalPanel />
      </div>
    </div>
  );
}
