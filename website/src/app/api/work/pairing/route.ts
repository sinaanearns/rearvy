import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  claimPairingToken,
  createPairingToken,
  heartbeatPairedDevice,
  listPairedDevices,
  revokePairedDevice,
} from "@/lib/work/pairing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const isDesktop =
      request.headers.get("x-rearvy-desktop") === "1" ||
      (request.headers.get("user-agent") || "").toLowerCase().includes("electron");
    const [devices, tokensSnapshot] = await Promise.all([
      listPairedDevices(adminDb, auth.user.uid),
      adminDb
      .collection(COLLECTIONS.WORK_PAIRING_TOKENS)
      .where("user_id", "==", auth.user.uid)
      .get(),
    ]);
    const tokens = tokensSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          label: data.label || "Desktop pairing",
          status: data.status || "pending",
          claimed_device_id: data.claimed_device_id || null,
          expires_at: data.expires_at || null,
          created_at: data.created_at || null,
        };
      })
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .slice(0, 10);

    return NextResponse.json({
      localRuntime: isDesktop,
      devices,
      tokens,
      currentDevice: {
        type: isDesktop ? "desktop" : "browser",
        status: isDesktop ? "local runtime available" : "web session",
      },
    });
  } catch (error) {
    console.error("Failed to read pairing status:", error);
    return NextResponse.json(
      { error: "Failed to read pairing status." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "create-token";

    if (action === "create-token") {
      const result = await createPairingToken(adminDb, auth.user.uid, {
        label: typeof body.label === "string" ? body.label : null,
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }

    if (action === "claim") {
      const code = typeof body.code === "string" ? body.code : "";
      if (!code.trim()) {
        return NextResponse.json({ error: "Pairing code is required." }, { status: 400 });
      }
      const device = await claimPairingToken(adminDb, auth.user.uid, {
        code,
        deviceName: typeof body.deviceName === "string" ? body.deviceName : null,
        deviceType: typeof body.deviceType === "string" ? body.deviceType : "desktop",
        capabilities: body.capabilities,
      });
      if (!device) {
        return NextResponse.json({ error: "Pairing code is invalid or expired." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, device }, { status: 201 });
    }

    if (action === "heartbeat") {
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
      const device = await heartbeatPairedDevice(adminDb, auth.user.uid, deviceId, body.capabilities);
      if (!device) {
        return NextResponse.json({ error: "Paired device not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, device });
    }

    if (action === "revoke") {
      const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
      const device = await revokePairedDevice(adminDb, auth.user.uid, deviceId);
      if (!device) {
        return NextResponse.json({ error: "Paired device not found." }, { status: 404 });
      }
      return NextResponse.json({ ok: true, device });
    }

    return NextResponse.json({ error: "Unsupported pairing action." }, { status: 400 });
  } catch (error) {
    console.error("Failed to update pairing state:", error);
    return NextResponse.json(
      { error: "Failed to update pairing state." },
      { status: 500 }
    );
  }
}
