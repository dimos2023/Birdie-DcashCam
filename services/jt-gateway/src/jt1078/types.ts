import { JT1078_MAGIC } from "../jt808/constants.js";

export type Jt1078DataType = 0 | 1 | 2 | 3 | 4;
export type Jt1078Fragment = 0 | 1 | 2 | 3;

export interface Jt1078Packet {
  magic: Buffer;
  vpxcc: number;
  m: boolean;
  pt: number;
  serial: number;
  simNo: string;
  logicalChannel: number;
  dataType: Jt1078DataType;
  fragment: Jt1078Fragment;
  timestamp?: bigint;
  lastIFrameInterval?: number;
  lastFrameInterval?: number;
  bodyLength: number;
  body: Buffer;
  headerLength: number;
  raw: Buffer;
}

export function isJt1078Packet(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).equals(JT1078_MAGIC);
}
