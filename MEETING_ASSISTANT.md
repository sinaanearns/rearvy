# Meeting Assistant (Background) — Feature Specification

Overview
--------
This feature adds a background meeting assistant that can:
- Listen to and record meeting audio (client-side) with explicit consent.
- Store recordings and transcripts in the backend.
- Produce summaries, action items, and searchable meeting details.
- Trigger outbound calls (telephony) on voice command and record those calls for the meeting.

Important legal & privacy notes
------------------------------
- Recording requires explicit, auditable consent from every participant in most jurisdictions. Implement a consent step before starting recording and log who consented and when.
- Allow participants to opt-out and to erase recordings/transcripts on request.

High-level architecture
-----------------------
- Client: `getUserMedia` + `MediaRecorder` (simple prototype) or WebRTC for real-time streaming.
- Server: Next.js API routes to register meetings, accept uploads, and request outbound calls.
- Telephony: Twilio (recommended) to place/record outbound calls and return recording URLs.
- Transcription: NVIDIA Riva (or Whisper-compatible STT), Vercel AI, or another STT provider; can be batch (post-call) or streaming (real-time).
- Storage: Firestore for metadata, Firebase Storage / S3 for audio blobs.

Data model (example)
--------------------
- `meetings/{meetingId}`:
  - userId, title, participants[], startedAt, endedAt, status
  - recordingUrl (optional)
  - transcripts: [{start, end, text, speaker}] or a single transcript
  - summary, actionItems[]

API endpoints (prototype)
-------------------------
- `POST /api/meetings/start` — create meeting record and return `meetingId`.
- `POST /api/meetings/stop` — finalize meeting; accepts either JSON with `recordingUrl`/`transcription` or multipart upload of audio.
- `POST /api/calls/outbound` — request an outbound call to be placed (Twilio or stubbed); returns call SID or error.

Environment variables
---------------------
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_CALLER_ID` — for outbound telephony.
- `APP_BASE_URL` — used for TwiML callback URLs.

Implementation notes & next steps
--------------------------------
1. Start with client-side prototype using `MediaRecorder` and the API stubs in this repo.
2. Add server-side transcription worker (batch) that uploads to STT and saves transcripts.
3. Add Twilio integration to place and record calls; store Twilio recording URLs on stop.
4. Add LLM-based summarization and action-item extraction on transcripts.
5. Implement explicit consent UI and retention/erase flows.

Security
--------
- Ensure APIs require authentication (Firebase Auth).
- Limit access to recordings/transcripts to authorized users.

This doc is a starting point; see the repo stubs under `src/app/api/meetings` and `src/components/meeting-assistant`.
