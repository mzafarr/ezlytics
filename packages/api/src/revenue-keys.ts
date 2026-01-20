import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { env } from "@my-better-t-app/env/server";

const algorithm = "aes-256-gcm";
const ivLength = 12;
const getKey = () => createHash("sha256").update(env.REVENUE_PROVIDER_KEY_SECRET).digest();

type EncryptedPayload = {
  iv: string;
  tag: string;
  value: string;
};

const serialize = (payload: EncryptedPayload) =>
  `${payload.iv}.${payload.tag}.${payload.value}`;

const parsePayload = (payload: string): EncryptedPayload | null => {
  const [iv, tag, value] = payload.split(".");
  if (!iv || !tag || !value) {
    return null;
  }
  return { iv, tag, value };
};

export const encryptRevenueKey = (plainText: string) => {
  const iv = randomBytes(ivLength);
  const key = getKey();
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return serialize({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    value: encrypted.toString("base64"),
  });
};

export const decryptRevenueKey = (payload: string) => {
  const parsed = parsePayload(payload);
  if (!parsed) {
    throw new Error("Invalid encrypted key format");
  }
  const key = getKey();
  const iv = Buffer.from(parsed.iv, "base64");
  const tag = Buffer.from(parsed.tag, "base64");
  const encrypted = Buffer.from(parsed.value, "base64");
  const decipher = createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};
