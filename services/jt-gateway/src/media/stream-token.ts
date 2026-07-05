import { createHash, randomBytes } from "node:crypto";

export function hashStreamToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateStreamToken(): string {
  return randomBytes(24).toString("base64url");
}
