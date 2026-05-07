function sanitizeBucketValue(value: string) {
  let sanitized = value.trim();

  sanitized = sanitized.replace(/^['"]+|['"]+$/g, "");
  sanitized = sanitized.replace(/,+$/, "");
  sanitized = sanitized.replace(/^gs:\/\//i, "");
  sanitized = sanitized.replace(/^https?:\/\/storage.googleapis.com\/+/i, "");
  sanitized = sanitized.replace(/^https?:\/\/firebasestorage.googleapis.com\/v0\/b\//i, "");
  sanitized = sanitized.replace(/\/o.*$/i, "");
  sanitized = sanitized.replace(/\/+$/g, "");

  return sanitized.trim();
}

export function resolveFirebaseStorageBucketName() {
  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      continue;
    }

    const sanitized = sanitizeBucketValue(candidate);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.GCLOUD_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (projectId) {
    return `${projectId}.firebasestorage.app`;
  }

  return null;
}
