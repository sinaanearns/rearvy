"use client";
import React, { useRef, useState } from "react";
import { PhoneCall, Radio, Square } from "lucide-react";

export default function MeetingAssistantControls({ defaultTitle }: { defaultTitle?: string }) {
  const [recording, setRecording] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  async function startMeeting() {
    try {
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: defaultTitle || "Meeting" }),
      });
      const json = await res.json();
      const nextMeetingId = typeof json.meetingId === "string" ? json.meetingId : "";
      if (!nextMeetingId) {
        throw new Error("Meeting service did not return a meeting id.");
      }
      setMeetingId(nextMeetingId);

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
        await fetch("/api/meetings/stop", { method: "POST", body: fd });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };
      mediaRecorderRef.current = mr;
      mr.start(1000);
      setRecording(true);
    } catch (err) {
      console.error(err);
      alert("Failed to start meeting: " + (err as Error).message);
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
    if (!phone) return;
    if (!meetingId) return alert("Start a meeting first.");
    const res = await fetch("/api/calls/outbound", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: phone, meetingId }),
    });
    const json = await res.json();
    alert(JSON.stringify(json));
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[8px] border border-white/12 bg-[#0b141d]/92 p-3 text-white shadow-sm shadow-black/25 backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-white/48">
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

      <div className="mt-3 truncate rounded-[8px] border border-white/10 bg-black/24 px-3 py-2 text-xs text-white/54" title={meetingId ?? "Not started"}>
        Meeting: {meetingId ?? "Not started"}
      </div>
    </div>
  );
}
