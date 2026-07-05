import { randomBytes, createHash } from "node:crypto";
import { decodeGbk } from "../gbk.js";
import { normalizeTerminalNo } from "../bcd.js";

export interface RegistrationBody {
  provinceId: number;
  cityId: number;
  manufacturerId: string;
  terminalModel: string;
  terminalIdCode: string;
  plateColor: number;
  plateNumber: string;
  terminalNo: string;
}

export function parseRegistrationBody(body: Buffer, is2019: boolean): RegistrationBody {
  let pos = 0;
  const provinceId = body.readUInt16BE(pos);
  pos += 2;
  const cityId = body.readUInt16BE(pos);
  pos += 2;
  const manufacturerId = body.subarray(pos, pos + 5).toString("ascii").replace(/\0/g, "");
  pos += 5;
  const modelLen = is2019 ? 30 : 20;
  const terminalModel = body.subarray(pos, pos + modelLen).toString("ascii").replace(/\0/g, "");
  pos += modelLen;
  const terminalIdCode = body.subarray(pos, pos + 7).toString("ascii").replace(/\0/g, "");
  pos += 7;
  const plateColor = body.readUInt8(pos);
  pos += 1;
  const plateNumber = decodeGbk(body.subarray(pos));
  return {
    provinceId,
    cityId,
    manufacturerId,
    terminalModel,
    terminalIdCode,
    plateColor,
    plateNumber,
    terminalNo: "",
  };
}

export function buildRegistrationResponseBody(
  serial: number,
  result: number,
  authCode?: string,
): Buffer {
  const auth = authCode ?? "";
  const authBuf = Buffer.from(auth, "ascii");
  const buf = Buffer.alloc(3 + authBuf.length);
  buf.writeUInt16BE(serial, 0);
  buf.writeUInt8(result, 2);
  authBuf.copy(buf, 3);
  return buf;
}

export function generateAuthCode(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function hashAuthCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function normalizeRegistrationTerminalNo(headerTerminalNo: string): string {
  return normalizeTerminalNo(headerTerminalNo);
}
