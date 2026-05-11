import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminAuth } from "@/lib/firebase/admin";
import { handleApiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { new_password } = body;

    if (!new_password || new_password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await adminAuth.updateUser(data.user.id, {
      password: new_password,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return handleApiError(error, "POST /api/dashboard/profile/password");
  }
}
