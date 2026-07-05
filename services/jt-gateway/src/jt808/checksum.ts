/** XOR checksum over all bytes from message header through body end. */
export function computeChecksum(data: Buffer): number {
  let cs = 0;
  for (let i = 0; i < data.length; i++) {
    cs ^= data[i];
  }
  return cs & 0xff;
}

export function verifyChecksum(headerAndBody: Buffer, checksum: number): boolean {
  return computeChecksum(headerAndBody) === (checksum & 0xff);
}
