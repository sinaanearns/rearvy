"use client";

import {
  Database,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  ShieldAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminUser, ViewingUserData } from "./types";

type UserDataDialogProps = {
  user: AdminUser | null;
  data: ViewingUserData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function UserDataDialog({
  user,
  data,
  loading,
  error,
  onClose,
}: UserDataDialogProps) {
  return (
    <Dialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-border/50 bg-[#0a0a0b]/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="p-6 border-b border-white/5 bg-gradient-to-r from-slate-900/50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl font-bold text-white shadow-xl">
                {getInitials(user?.displayName || user?.email || "U")}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  {user?.displayName || "User Data Explorer"}
                </DialogTitle>
                <DialogDescription className="text-slate-400 flex items-center gap-2">
                  <Mail size={12} /> {user?.email || user?.uid}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 animate-pulse">
              <ShieldAlert size={10} /> Silent Admin Mode Active
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
              <p className="text-slate-400 font-medium">
                Decrypting and fetching user payload...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 flex items-center gap-3">
              <X size={18} /> {error}
            </div>
          ) : data ? (
            <UserDataContent user={user} data={data} />
          ) : null}
        </div>
        <DialogFooter className="p-4 border-t border-white/5 bg-[#0a0a0b]">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/10 hover:bg-white/5 text-slate-400"
          >
            Close Explorer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDataContent({
  user,
  data,
}: {
  user: AdminUser | null;
  data: ViewingUserData;
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricTile label="Chats" value={data.chats.length} />
        <MetricTile label="Integrations" value={data.integrations.length} />
        <MetricTile label="Events" value={data.events.length} />
        <div className="p-4 rounded-2xl border border-white/5 bg-white/5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Account Age
          </p>
          <p className="text-sm font-bold text-white mt-2">
            {formatDate(user?.createdAt)}
          </p>
        </div>
      </div>

      <ChatsSection chats={data.chats} />
      <IntegrationsSection integrations={data.integrations} />
      <EventsSection events={data.events} />
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-2xl border border-white/5 bg-white/5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

function ChatsSection({ chats }: { chats: ViewingUserData["chats"] }) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <MessageSquare size={18} className="text-slate-400" /> Interaction History
      </h3>
      {chats.length > 0 ? (
        <div className="space-y-4">
          {chats.map((chat) => (
            <Card key={chat.id} className="border-white/5 bg-white/[0.02] overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/[0.03]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {chat.title || "Untitled Conversation"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                      {chat.id}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {formatDateTime(chat.created_at)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-y-auto p-4 space-y-4 bg-black/20">
                  {chat.messages && chat.messages.length > 0 ? (
                    chat.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                            message.role === "user"
                              ? "bg-slate-800 text-white"
                              : message.role === "assistant"
                                ? "bg-blue-600/20 text-blue-100 border border-blue-500/20"
                                : "bg-slate-900 text-slate-400"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <span className="text-[9px] text-slate-600 mt-1 px-2 uppercase tracking-tighter">
                          {message.role || "unknown"} - {formatTime(message.created_at)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-slate-600 py-4">
                      No messages recorded for this session.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 text-slate-500 text-sm">
          No AI or DM interactions found for this user.
        </div>
      )}
    </section>
  );
}

function IntegrationsSection({
  integrations,
}: {
  integrations: ViewingUserData["integrations"];
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Database size={18} className="text-slate-400" /> Linked Integrations
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {integrations.length > 0 ? (
          integrations.map((integration) => (
            <div
              key={integration.id}
              className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold uppercase">
                  {integration.provider[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-white capitalize">
                    {integration.provider}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {integration.provider_account_name || "Unknown account"}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  integration.status === "active"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {integration.status || "unknown"}
              </span>
            </div>
          ))
        ) : (
          <div className="col-span-full p-4 text-center rounded-2xl border border-dashed border-white/10 text-slate-500 text-sm">
            No integrations connected.
          </div>
        )}
      </div>
    </section>
  );
}

function EventsSection({ events }: { events: ViewingUserData["events"] }) {
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <Globe size={18} className="text-slate-400" /> Website Footprint
      </h3>
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] divide-y divide-white/5">
        {events.length > 0 ? (
          events.map((event) => (
            <div
              key={event.id}
              className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe size={14} className="text-slate-600" />
                <div>
                  <p className="text-xs font-bold text-white">
                    {event.event_name || event.event_type}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate max-w-[300px]">
                    {event.path || "Home"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-slate-600 font-mono">
                {formatDateTime(event.timestamp)}
              </span>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-500 text-sm">
            No website events tracked for this UID.
          </div>
        )}
      </div>
    </section>
  );
}

function formatDate(value: string | number | Date | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
}

function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
}

function formatTime(value: string | number | Date | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleTimeString();
}

function getInitials(value: string) {
  const parts = value.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "AR";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);
}
