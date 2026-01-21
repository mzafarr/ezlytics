import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@my-better-t-app/env/server";

const stripTags = (value: string) => value.replace(/<[^>]*>/g, "");
const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const algorithm = "aes-256-gcm";
const ivLength = 12;
const encryptedPrefix = "enc:";
const sensitiveMetadataKeys = new Set(["email", "name", "user_id", "customer_id"]);

const getEncryptionKey = () => createHash("sha256").update(env.REVENUE_PROVIDER_KEY_SECRET).digest();

const encryptValue = (plainText: string) => {
  if (plainText.startsWith(encryptedPrefix)) {
    return plainText;
  }
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptedPrefix}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

const sanitizeString = (value: string, maxLength = 255) => {
  const sanitized = collapseWhitespace(stripTags(value));
  if (!sanitized) {
    return "";
  }
  return sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;
};

export const sanitizeMetadataRecord = (
  record: Record<string, unknown> | null | undefined,
  maxLength = 255,
) => {
  if (!record) {
    return null;
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.trim().toLowerCase();
    if (typeof value === "string") {
      const cleaned = sanitizeString(value, maxLength);
      if (cleaned) {
        sanitized[key] = sensitiveMetadataKeys.has(normalizedKey) ? encryptValue(cleaned) : cleaned;
      }
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = sanitizeMetadataRecord(value as Record<string, unknown>, maxLength);
      if (nested && Object.keys(nested).length > 0) {
        sanitized[key] = nested;
      }
      continue;
    }
    if (sensitiveMetadataKeys.has(normalizedKey) && (typeof value === "number" || typeof value === "boolean")) {
      sanitized[key] = encryptValue(String(value));
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};
