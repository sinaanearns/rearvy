import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not set");
  }
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encrypted: encrypted + ":" + authTag,
    iv: iv.toString("hex"),
  };
}

export function decrypt(encrypted: string, iv: string): string {
  const key = getEncryptionKey();
  const [encryptedText, authTag] = encrypted.split(":");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
