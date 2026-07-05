import iconv from "iconv-lite";
import { computeChecksum, verifyChecksum } from "./checksum.js";
import { escapeFrame, unescapeFrame } from "./escape.js";
import { buildHeaderFields, parseHeader } from "./header.js";
import type { Jt808Frame, ProtocolVersion } from "./types.js";
import { FRAME_DELIMITER } from "./constants.js";

export interface DecodeResult {
  frame?: Jt808Frame;
  error?: string;
  checksumValid?: boolean;
}

export function decodeFrame(rawBetweenDelimiters: Buffer): DecodeResult {
  if (rawBetweenDelimiters.length < 13) {
    return { error: "frame_too_short" };
  }
  const unescaped = unescapeFrame(rawBetweenDelimiters);
  if (unescaped.length < 2) return { error: "unescaped_too_short" };
  const checksum = unescaped[unescaped.length - 1];
  const headerAndBody = unescaped.subarray(0, unescaped.length - 1);
  const checksumValid = verifyChecksum(headerAndBody, checksum);
  if (!checksumValid) {
    return { error: "checksum_invalid", checksumValid: false };
  }
  const { header, headerLength } = parseHeader(headerAndBody, 0);
  const body = headerAndBody.subarray(headerLength, headerLength + header.bodyLength);
  if (body.length !== header.bodyLength) {
    return { error: "body_length_mismatch", checksumValid: true };
  }
  return {
    frame: { header, body, checksum, rawUnescaped: unescaped },
    checksumValid: true,
  };
}

export function encodeFrame(
  messageId: number,
  terminalNo: string,
  messageSerial: number,
  body: Buffer,
  protocolVersion: ProtocolVersion,
): Buffer {
  const header = buildHeaderFields(messageId, body.length, terminalNo, messageSerial, protocolVersion);
  const headerAndBody = Buffer.concat([header, body]);
  const checksum = computeChecksum(headerAndBody);
  const withChecksum = Buffer.concat([headerAndBody, Buffer.from([checksum])]);
  const escaped = escapeFrame(withChecksum);
  return Buffer.concat([Buffer.from([FRAME_DELIMITER]), escaped, Buffer.from([FRAME_DELIMITER])]);
}

export function decodeGbkString(buf: Buffer): string {
  return iconv.decode(buf, "gbk").replace(/\0/g, "").trim();
}
