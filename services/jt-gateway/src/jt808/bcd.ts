/** Decode BCD bytes to digit string (drops leading padding zeros except keep one). */
export function bcdToString(buf: Buffer): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) {
    const hi = (buf[i] >> 4) & 0x0f;
    const lo = buf[i] & 0x0f;
    if (hi <= 9) s += String(hi);
    if (lo <= 9) s += String(lo);
  }
  return s.replace(/^0+/, "") || "0";
}

/** Encode digit string into BCD with fixed byte length (left-padded with zeros). */
export function stringToBcd(digits: string, byteLength: number): Buffer {
  const padded = digits.replace(/\D/g, "").padStart(byteLength * 2, "0");
  const buf = Buffer.alloc(byteLength, 0);
  for (let i = 0; i < byteLength; i++) {
    const hi = parseInt(padded[i * 2] ?? "0", 10);
    const lo = parseInt(padded[i * 2 + 1] ?? "0", 10);
    buf[i] = ((hi & 0x0f) << 4) | (lo & 0x0f);
  }
  return buf;
}

/** Parse BCD[6] device time YY-MM-DD-hh-mm-ss (GMT+8). */
export function parseBcdDeviceTime(buf: Buffer): string {
  if (buf.length < 6) return "";
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const hi = (buf[i] >> 4) & 0x0f;
    const lo = buf[i] & 0x0f;
    parts.push(`${hi}${lo}`);
  }
  return `20${parts[0]}-${parts[1]}-${parts[2]} ${parts[3]}:${parts[4]}:${parts[5]}`;
}

export function normalizeTerminalNo(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+/, "") || "0";
}
