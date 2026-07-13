"use client";
import { useRef, useState } from "react";
import { PhoneCall, Radio, Square } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-utils";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJsonRecord(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  return isRecord(payload) ? payload : {};
}

export default function MeetingAssistantControls({ defaultTitle }: { defaultTitle?: string }) {
  const [recording, setRecording] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  async function startMeeting() {
    setError(null);
    try {
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: defaultTitle || "Meeting" }),
      });
      const json = await readJsonRecord(res);
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Failed to start meeting."
        );
      }

      const nextMeetingId = typeof json.meetingId === "string" ? json.meetingId : "";
      if (!nextMeetingId) {
        throw new Error("Meeting service did not return a meeting id.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        const fd = new FormData();
        fd.append("meetingId", nextMeetingId);
        fd.append("audio", blob, "meeting.webm");
        try {
          const stopResponse = await fetch("/api/meetings/stop", { method: "POST", body: fd });
          if (!stopResponse.ok) {
            const stopPayload = await readJsonRecord(stopResponse);
            throw new Error(
              typeof stopPayload.error === "string"
                ? stopPayload.error
                : "Failed to upload meeting audio."
            );
          }
          toast.success("Meeting recording saved.");
        } catch (err) {
          const message = getErrorMessage(err, "Failed to upload meeting audio.");
          setError(message);
          toast.error(message);
        } finally {
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };
      mediaRecorderRef.current = mr;
      mr.start(1000);
      setMeetingId(nextMeetingId);
      setRecording(true);
    } catch (err) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      const message = getErrorMessage(err, "Failed to start meeting.");
      setError(message);
      toast.error(message);
    }
  }

  function stopMeeting() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function callContact() {
    const phone = prompt("Enter phone number (E.164):");
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) return;
    if (!meetingId) {
      toast.error("Start a meeting first.");
      return;
    }

    setError(null);
    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: normalizedPhone, meetingId }),
      });
      const json = await readJsonRecord(res);
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Failed to start outbound call."
        );
      }

      toast.success(
        typeof json.message === "string"
          ? json.message
          : "Outbound call requested."
      );
    } catch (err) {
      const message = getErrorMessage(err, "Failed to start outbound call.");
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-white/12 bg-[#0b141d]/92 p-3 text-white shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-white/58">
            <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse bg-red-300" : "bg-emerald-300"}`} />
            Meeting assistant
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            {recording ? "Listening now" : meetingId ? "Session ready" : "Not started"}
          </div>
        </div>
        <div className="rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-2 text-cyan-100">
          <Radio className="h-4 w-4" />
        </div>
      </div>

      <div className="grid gap-2">
      {!recording ? (
          <button
            onClick={startMeeting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-cyan-200 px-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-white"
          >
            <Radio className="h-4 w-4" />
            Start Meeting & Listen
          </button>
      ) : (
          <button
            onClick={stopMeeting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-red-300/25 bg-red-400/14 px-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-400/20"
          >
            <Square className="h-4 w-4" />
            Stop Meeting
          </button>
      )}
        <button
          onClick={callContact}
          disabled={!meetingId}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-white/12 bg-white/[0.06] px-3 text-sm font-semibold text-white transition-colors hover:border-cyan-200/30 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <PhoneCall className="h-4 w-4" />
          Call Contact
        </button>
      </div>

      <div className="mt-3 truncate rounded-[8px] border border-white/10 bg-black/24 px-3 py-2 text-xs text-white/62" title={meetingId ?? "Not started"}>
        Meeting: {meetingId ?? "Not started"}
      </div>
      {error ? (
        <div className="mt-2 rounded-[8px] border border-red-300/25 bg-red-400/10 px-3 py-2 text-xs text-red-100">
          {error}
        </div>
      ) : null}
    </div>
  );
}
