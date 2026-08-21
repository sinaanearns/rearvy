import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  isBusinessPublisherProfile,
  isEligibleBusinessRegistration,
  normalizePublisherEmail,
} from "./publisher-access";

export type ConnectorPublisherAccessSource = "profile" | "registration";

export async function requireConnectorPublisher(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const profile = await adminDb.collection(COLLECTIONS.PROFILES).doc(auth.user.uid).get();
  if (profile.exists && isBusinessPublisherProfile(profile.data())) {
    return {
      ...auth,
      publisher: { accessSource: "profile" as const },
    };
  }

  const email = normalizePublisherEmail(auth.user.email);
  if (email) {
    const registrations = await adminDb
      .collection(COLLECTIONS.BUSINESS_REGISTRATIONS)
      .where("gmail", "==", email)
      .limit(10)
      .get();
    const eligibleRegistration = registrations.docs.find((registration) =>
      isEligibleBusinessRegistration(registration.data())
    );

    if (eligibleRegistration) {
      return {
        ...auth,
        publisher: { accessSource: "registration" as const },
      };
    }
  }

  return {
    user: null,
    error: NextResponse.json(
      { error: "A registered platform or business account is required." },
      { status: 403 }
    ),
  } as const;
}
