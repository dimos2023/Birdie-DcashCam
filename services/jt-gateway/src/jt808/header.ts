import { bcdToString, stringToBcd } from "./bcd.js";
import type { Jt808Header, ProtocolVersion } from "./types.js";

export function parseBodyAttributes(word: number) {
  return {
    bodyLength: word & 0x03ff,
    encrypted: ((word >> 10) & 1) === 1,
    subpackaged: ((word >> 12) & 1) === 1,
    versionFlag: ((word >> 14) & 1) === 1,
  };
}

export function parseHeader(buf: Buffer, offset = 0): { header: Jt808Header; headerLength: number } {
  let pos = offset;
  const messageId = buf.readUInt16BE(pos);
  pos += 2;
  const bodyAttributes = buf.readUInt16BE(pos);
  pos += 2;
  const attrs = parseBodyAttributes(bodyAttributes);
  const protocolVersion: ProtocolVersion = attrs.versionFlag ? "2019" : "2011";
  let protocolVersionByte: number | undefined;
  let terminalBytes: number;
  if (attrs.versionFlag) {
    protocolVersionByte = buf.readUInt8(pos);
    pos += 1;
    terminalBytes = 10;
  } else {
    terminalBytes = 6;
  }
  const terminalBuf = buf.subarray(pos, pos + terminalBytes);
  pos += terminalBytes;
  const terminalNo = bcdToString(terminalBuf);
  const messageSerial = buf.readUInt16BE(pos);
  pos += 2;
  let totalPackages: number | undefined;
  let packageNumber: number | undefined;
  if (attrs.subpackaged) {
    totalPackages = buf.readUInt16BE(pos);
    pos += 2;
    packageNumber = buf.readUInt16BE(pos);
    pos += 2;
  }
  return {
    header: {
      messageId,
      bodyAttributes,
      bodyLength: attrs.bodyLength,
      encrypted: attrs.encrypted,
      subpackaged: attrs.subpackaged,
      versionFlag: attrs.versionFlag,
      protocolVersion,
      protocolVersionByte,
      terminalNo,
      messageSerial,
      totalPackages,
      packageNumber,
    },
    headerLength: pos - offset,
  };
}

export function buildHeaderFields(
  messageId: number,
  bodyLength: number,
  terminalNo: string,
  messageSerial: number,
  protocolVersion: ProtocolVersion,
): Buffer {
  let bodyAttributes = bodyLength & 0x03ff;
  if (protocolVersion === "2019") bodyAttributes |= 1 << 14;

  const parts: Buffer[] = [];
  parts.push(Buffer.from([(messageId >> 8) & 0xff, messageId & 0xff]));
  parts.push(Buffer.from([(bodyAttributes >> 8) & 0xff, bodyAttributes & 0xff]));
  if (protocolVersion === "2019") {
    parts.push(Buffer.from([1]));
    parts.push(stringToBcd(terminalNo, 10));
  } else {
    parts.push(stringToBcd(terminalNo, 6));
  }
  parts.push(Buffer.from([(messageSerial >> 8) & 0xff, messageSerial & 0xff]));
  return Buffer.concat(parts);
}
