import { timingSafeEqual, createHash } from "node:crypto";

export interface AuthenticationBody {
  authCode: string;
  imei?: string;
  softwareVersion?: string;
}

export function parseAuthenticationBody(body: Buffer, is2019: boolean): AuthenticationBody {
  let pos = 0;
  const authLen = body.readUInt8(pos);
  pos += 1;
  const authCode = body.subarray(pos, pos + authLen).toString("ascii");
  pos += authLen;
  if (!is2019) return { authCode };
  const imei = body.subarray(pos, pos + 15).toString("ascii").replace(/\0/g, "");
  pos += 15;
  const swLen = body.readUInt8(pos);
  pos += 1;
  const softwareVersion = body.subarray(pos, pos + swLen).toString("ascii");
  return { authCode, imei, softwareVersion };
}

export function verifyAuthCode(supplied: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const suppliedHash = createHash("sha256").update(supplied, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(suppliedHash, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
