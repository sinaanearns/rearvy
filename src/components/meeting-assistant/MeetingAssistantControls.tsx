"use client";
import React, { useRef, useState } from "react";

export default function MeetingAssistantControls({ defaultTitle }: { defaultTitle?: string }) {
  const [recording, setRecording] = useState(false);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  async function startMeeting() {
    try {
      const res = await fetch("/api/meetings/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: defaultTitle || "Meeting" }),
      });
      const json = await res.json();
      if (json.meetingId) setMeetingId(json.meetingId);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        const fd = new FormData();
        fd.append("meetingId", meetingId || "");
        fd.append("audio", blob, "meeting.webm");
        await fetch("/api/meetings/stop", { method: "POST", body: fd });
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
    <div className="fixed bottom-6 right-6 p-3 space-y-2 bg-white rounded shadow">
      {!recording ? (
        <button onClick={startMeeting} className="px-3 py-2 bg-blue-600 text-white rounded">Start Meeting & Listen</button>
      ) : (
        <button onClick={stopMeeting} className="px-3 py-2 bg-red-600 text-white rounded">Stop Meeting</button>
      )}
      <button onClick={callContact} className="px-3 py-2 bg-gray-200 rounded">Call Contact</button>
      <div className="text-xs text-gray-600 mt-2">Meeting: {meetingId ?? "Not started"}</div>
    </div>
  );
}
