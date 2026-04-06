import "server-only";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { adminStorage } from "@/lib/firebase/admin";
import {
  type ChatAttachment,
  MAX_CHAT_ATTACHMENT_SIZE_BYTES,
  isImageContentType,
  sanitizeChatAttachmentName,
} from "@/lib/chat/attachments";
import { resolveFirebaseStorageBucketName } from "@/lib/firebase/storage-bucket";

type UploadChatAttachmentParams = {
  chatId: string;
  uploaderId: string;
  fileName: string;
  contentType: string;
  size: number;
  buffer: Buffer;
};

function buildFirebaseDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    storagePath
  )}?alt=media&token=${token}`;
}

function buildLocalAttachmentUrl(storagePath: string) {
  return `/${storagePath.replace(/\\/g, "/")}`;
}

async function writeLocalChatAttachment(params: {
  id: string;
  chatId: string;
  fileName: string;
  contentType: string;
  size: number;
  buffer: Buffer;
  kind: "image" | "file";
}) {
  const relativeDirectory = path.join("chat-attachments", params.chatId);
  const relativePath = path.join(
    relativeDirectory,
    `${Date.now()}-${params.id}-${params.fileName}`
  );
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, params.buffer);

  return {
    id: params.id,
    name: params.fileName,
    contentType: params.contentType,
    size: params.size,
    storagePath: relativePath,
    url: buildLocalAttachmentUrl(relativePath),
    kind: params.kind,
  } satisfies ChatAttachment;
}

let bucketAvailabilityPromise: Promise<string | null> | null = null;

async function resolveWritableFirebaseBucketName() {
  if (bucketAvailabilityPromise) {
    return bucketAvailabilityPromise;
  }

  bucketAvailabilityPromise = (async () => {
    const bucketName = resolveFirebaseStorageBucketName();
    if (!bucketName) {
      return null;
    }

    try {
      const bucket = adminStorage.bucket(bucketName);
      const [exists] = await bucket.exists();
      return exists ? bucketName : null;
    } catch {
      return null;
    }
  })();

  return bucketAvailabilityPromise;
}

export async function uploadChatAttachment(
  params: UploadChatAttachmentParams
): Promise<ChatAttachment> {
  if (!params.chatId.trim()) {
    throw new Error("Missing chat ID for attachment upload");
  }

  if (!params.uploaderId.trim()) {
    throw new Error("Missing uploader ID for attachment upload");
  }

  if (!Number.isFinite(params.size) || params.size <= 0) {
    throw new Error("Attachment is empty");
  }

  if (params.size > MAX_CHAT_ATTACHMENT_SIZE_BYTES) {
    throw new Error("Attachment exceeds the 15MB size limit");
  }

  const id = randomUUID();
  const fileName = sanitizeChatAttachmentName(params.fileName);
  const contentType = params.contentType || "application/octet-stream";
  const kind = isImageContentType(contentType) ? "image" : "file";
  const writableBucketName = await resolveWritableFirebaseBucketName();

  if (!writableBucketName) {
    return writeLocalChatAttachment({
      id,
      chatId: params.chatId,
      fileName,
      contentType,
      size: params.size,
      buffer: params.buffer,
      kind,
    });
  }

  const bucket = adminStorage.bucket(writableBucketName);
  const storagePath = `chat-attachments/${params.chatId}/${Date.now()}-${id}-${fileName}`;
  const downloadToken = randomUUID();

  try {
    await bucket.file(storagePath).save(params.buffer, {
      resumable: false,
      contentType,
      metadata: {
        cacheControl: "public,max-age=31536000,immutable",
        contentDisposition: `${kind === "image" ? "inline" : "attachment"}; filename="${fileName}"`,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          chatId: params.chatId,
          uploaderId: params.uploaderId,
        },
      },
    });

    return {
      id,
      name: fileName,
      contentType,
      size: params.size,
      storagePath,
      url: buildFirebaseDownloadUrl(writableBucketName, storagePath, downloadToken),
      kind,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      /bucket/i.test(message) ||
      /storage/i.test(message) ||
      /no such bucket/i.test(message)
    ) {
      bucketAvailabilityPromise = Promise.resolve(null);
      return writeLocalChatAttachment({
        id,
        chatId: params.chatId,
        fileName,
        contentType,
        size: params.size,
        buffer: params.buffer,
        kind,
      });
    }

    throw error;
  }
}
