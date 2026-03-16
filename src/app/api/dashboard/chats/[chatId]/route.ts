import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

type ChatRecord = {
  user_id?: string;
  participant_ids?: string[];
  project_id?: string | null;
  title?: string | null;
};

async function getAuthorizedChat(request: NextRequest, chatId: string) {
  const { data, error } = await getUserFromRequest(request);
  if (error || !data.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const chatDoc = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();

  if (!chatDoc.exists) {
    return {
      error: NextResponse.json({ error: "Chat not found" }, { status: 404 }),
    };
  }

  const chat = chatDoc.data() as ChatRecord | undefined;
  const isOwner = chat?.user_id === data.user.id;
  const isParticipant = Array.isArray(chat?.participant_ids) && chat.participant_ids.includes(data.user.id);

  if (!isOwner && !isParticipant) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }),
    };
  }

  return {
    userId: data.user.id,
    chatDoc,
    chat,
    isOwner,
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chatId } = await params;
    const authorization = await getAuthorizedChat(request, chatId);
    if (authorization.error) {
      return authorization.error;
    }

    const { chat } = authorization;

    // Fetch messages for this chat
    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .orderBy("created_at", "asc")
      .get();

    const messages = messagesSnapshot.docs.map((doc) => {
      const msgData = doc.data();
      return {
        id: doc.id,
        role: msgData.role,
        content: msgData.content,
        parts: Array.isArray(msgData.parts) ? msgData.parts : null,
        tool_invocations: Array.isArray(msgData.tool_invocations)
          ? msgData.tool_invocations
          : null,
        created_at: msgData.created_at,
      };
    });

    return NextResponse.json({
      chat: { id: chatId, ...chat },
      messages,
    });
  } catch (error) {
    console.error("Error fetching chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chatId } = await params;
    const authorization = await getAuthorizedChat(request, chatId);
    if (authorization.error) {
      return authorization.error;
    }

    const { chatDoc, chat, isOwner, userId } = authorization;
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : null;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the chat owner can manage this chat" },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (action === "rename") {
      const title = typeof body?.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }

      updates.title = title;
    } else if (action === "pin") {
      updates.is_pinned = Boolean(body?.value);
    } else if (action === "archive") {
      updates.is_archived = Boolean(body?.value);
    } else if (action === "move") {
      const projectId =
        typeof body?.projectId === "string" && body.projectId.trim()
          ? body.projectId.trim()
          : null;

      if (projectId) {
        const projectDoc = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
        if (!projectDoc.exists) {
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const project = projectDoc.data() as { user_id?: string; participant_ids?: string[] } | undefined;
        const canAccessProject =
          project?.user_id === userId ||
          (Array.isArray(project?.participant_ids) && project.participant_ids.includes(userId));

        if (!canAccessProject) {
          return NextResponse.json({ error: "Unauthorized project" }, { status: 403 });
        }
      }

      updates.project_id = projectId;
    } else {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    await chatDoc.ref.update(updates);

    return NextResponse.json({
      chat: {
        id: chatDoc.id,
        ...chat,
        ...updates,
      },
    });
  } catch (error) {
    console.error("Error updating chat:", error);
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chatId } = await params;
    const authorization = await getAuthorizedChat(request, chatId);
    if (authorization.error) {
      return authorization.error;
    }

    const { chatDoc, isOwner } = authorization;
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the chat owner can delete this chat" },
        { status: 403 }
      );
    }

    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .get();

    const batch = adminDb.batch();
    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    batch.delete(chatDoc.ref);

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
