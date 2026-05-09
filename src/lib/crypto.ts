import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const DEFAULT_TOKEN_KEY = "dev-token-key-change-me-32-bytes";
const DEFAULT_AUTH_SECRET = "dev-change-me-before-production";

function keyFromEnv() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || DEFAULT_TOKEN_KEY;
  if (process.env.NODE_ENV === "production" && raw === DEFAULT_TOKEN_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be configured before encrypting Google tokens.");
  }
  return createHash("sha256")
    .update(raw)
    .digest();
}

export function getRuntimeSecretStatus() {
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY || "";
  const authSecret = process.env.AUTH_SECRET || "";
  return {
    tokenEncryptionConfigured: Boolean(tokenKey && tokenKey !== DEFAULT_TOKEN_KEY && tokenKey.length >= 32),
    authSecretConfigured: Boolean(authSecret && authSecret !== DEFAULT_AUTH_SECRET && authSecret.length >= 32),
  };
}

export function encryptText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromEnv(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(value?: string | null) {
  if (!value) return null;
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) return null;

  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFromEnv(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
