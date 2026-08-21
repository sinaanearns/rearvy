import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { ensureValidToken } from "../gmail/client"; // Reuses existing token validation
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GoogleCalendar:Client");

export interface GoogleCalendarEventInput {
  summary: string;
  description?: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  location?: string;
}

/**
 * Loads valid OAuth token for Google APIs.
 * Checks for google_calendar integration first, falls back to gmail.
 */
export async function getValidGoogleToken(userId: string): Promise<string | null> {
  const db = adminDb;
  
  // 1. Check for google_calendar integration first
  let snapshot = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "google_calendar")
    .limit(1)
    .get();

  // 2. Fallback to gmail integration
  if (snapshot.empty) {
    snapshot = await db
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .where("provider", "==", "gmail")
      .limit(1)
      .get();
  }

  if (snapshot.empty) {
    log.warn(`No Google integrations found for user ${userId}`);
    return null;
  }

  const doc = snapshot.docs[0];
  const integration = doc.data();
  const refreshIv = integration.sync_cursor?.refresh_iv;

  if (
    !integration.access_token_enc ||
    !integration.token_iv ||
    !integration.refresh_token_enc ||
    !refreshIv
  ) {
    log.warn(`Google auth credentials incomplete for integration ${doc.id}`);
    return null;
  }

  try {
    const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
    const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

    const validAccessToken = await ensureValidToken(db, doc.id, {
      accessToken,
      refreshToken,
      tokenExpiresAt,
    });

    return validAccessToken;
  } catch (error) {
    log.error("Failed to ensure valid Google token", error);
    return null;
  }
}

/** Lists events from Google Calendar. */
export async function listCalendarEvents(params: {
  userId: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}) {
  const { userId, timeMin, timeMax, maxResults = 10 } = params;
  const token = await getValidGoogleToken(userId);
  if (!token) {
    throw new Error("Google Calendar is not connected or authenticated.");
  }

  const query = new URLSearchParams({
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
    ...(timeMin ? { timeMin } : {}),
    ...(timeMax ? { timeMax } : {}),
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar list failed: ${response.status} ${text}`);
  }

  return response.json();
}

/** Creates an event in Google Calendar. */
export async function createCalendarEvent(params: {
  userId: string;
  event: GoogleCalendarEventInput;
}) {
  const { userId, event } = params;
  const token = await getValidGoogleToken(userId);
  if (!token) {
    throw new Error("Google Calendar is not connected or authenticated.");
  }

  const body = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startTime,
    },
    end: {
      dateTime: event.endTime,
    },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar create failed: ${response.status} ${text}`);
  }

  return response.json();
}

/** Updates an existing event in Google Calendar. */
export async function updateCalendarEvent(params: {
  userId: string;
  eventId: string;
  event: Partial<GoogleCalendarEventInput>;
}) {
  const { userId, eventId, event } = params;
  const token = await getValidGoogleToken(userId);
  if (!token) {
    throw new Error("Google Calendar is not connected or authenticated.");
  }

  const body: Record<string, any> = {};
  if (event.summary) body.summary = event.summary;
  if (event.description) body.description = event.description;
  if (event.location) body.location = event.location;
  if (event.startTime) body.start = { dateTime: event.startTime };
  if (event.endTime) body.end = { dateTime: event.endTime };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Calendar update failed: ${response.status} ${text}`);
  }

  return response.json();
}
