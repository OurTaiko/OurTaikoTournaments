import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key(secret: string) {
  if (!secret) throw new Error("Session encryption is not configured");
  return Buffer.from(hkdfSync("sha256", secret, "ourtaiko-tournaments", "refresh-token-v1", 32));
}

export function sealRefreshToken(token: string, secret: string, subject: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(subject));
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function openRefreshToken(value: string, secret: string, subject: string) {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra !== undefined) throw new Error("Invalid encrypted session");
  const cipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  cipher.setAAD(Buffer.from(subject));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([cipher.update(Buffer.from(encrypted, "base64url")), cipher.final()]).toString("utf8");
}
