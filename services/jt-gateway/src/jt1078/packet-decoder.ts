import { bcdToString } from "../jt808/bcd.js";
import type { Jt1078Packet } from "./types.js";

export function decodeJt1078Packet(buf: Buffer, maxBytes: number): Jt1078Packet | null {
  if (buf.length < 16) return null;
  const magic = buf.subarray(0, 4);
  const vpxcc = buf.readUInt8(4);
  const mPt = buf.readUInt8(5);
  const m = (mPt & 0x80) !== 0;
  const pt = mPt & 0x7f;
  const serial = buf.readUInt16BE(6);
  const simNo = bcdToString(buf.subarray(8, 14));
  const logicalChannel = buf.readUInt8(14);
  const typeFrag = buf.readUInt8(15);
  const dataType = (typeFrag >> 4) & 0x0f;
  const fragment = typeFrag & 0x0f;

  let pos = 16;
  let timestamp: bigint | undefined;
  let lastIFrameInterval: number | undefined;
  let lastFrameInterval: number | undefined;

  const isVideo = dataType <= 2;
  const isAudio = dataType === 3;
  const isTransparent = dataType === 4;

  if (isVideo || isAudio) {
    if (buf.length < pos + 8) return null;
    timestamp = buf.readBigUInt64BE(pos);
    pos += 8;
  }
  if (isVideo) {
    if (buf.length < pos + 4) return null;
    lastIFrameInterval = buf.readUInt16BE(pos);
    pos += 2;
    lastFrameInterval = buf.readUInt16BE(pos);
    pos += 2;
  }

  if (buf.length < pos + 2) return null;
  const bodyLength = buf.readUInt16BE(pos);
  pos += 2;
  if (bodyLength > maxBytes) return null;
  if (buf.length < pos + bodyLength) return null;

  return {
    magic,
    vpxcc,
    m,
    pt,
    serial,
    simNo,
    logicalChannel,
    dataType: dataType as Jt1078Packet["dataType"],
    fragment: fragment as Jt1078Packet["fragment"],
    timestamp,
    lastIFrameInterval,
    lastFrameInterval,
    bodyLength,
    body: buf.subarray(pos, pos + bodyLength),
    headerLength: pos + bodyLength,
    raw: buf.subarray(0, pos + bodyLength),
  };
}
