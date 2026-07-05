import { MSG } from "../constants.js";
import { encodeFrame } from "../encoder.js";
import type { ProtocolVersion } from "../types.js";

export function buildPlatformCommonResponse(
  terminalNo: string,
  replySerial: number,
  replyMessageId: number,
  result: number,
  outboundSerial: number,
  protocolVersion: ProtocolVersion,
): Buffer {
  const body = Buffer.alloc(5);
  body.writeUInt16BE(replySerial, 0);
  body.writeUInt16BE(replyMessageId, 2);
  body.writeUInt8(result, 4);
  return encodeFrame(MSG.PLATFORM_COMMON_RESPONSE, terminalNo, outboundSerial, body, protocolVersion);
}
