/** Escape bytes between delimiters for JT808 transmission. */
export function escapeFrame(payload: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    const b = payload[i];
    if (b === 0x7e) {
      out.push(0x7d, 0x02);
    } else if (b === 0x7d) {
      out.push(0x7d, 0x01);
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

/** Reverse JT808 escaping. */
export function unescapeFrame(payload: Buffer): Buffer {
  const out: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    const b = payload[i];
    if (b === 0x7d && i + 1 < payload.length) {
      const next = payload[i + 1];
      if (next === 0x01) {
        out.push(0x7d);
        i++;
        continue;
      }
      if (next === 0x02) {
        out.push(0x7e);
        i++;
        continue;
      }
    }
    out.push(b);
  }
  return Buffer.from(out);
}
