import iconv from "iconv-lite";

export function decodeGbk(buf: Buffer): string {
  return iconv.decode(buf, "gbk").replace(/\0/g, "").trim();
}

export function encodeGbk(text: string): Buffer {
  return iconv.encode(text, "gbk");
}
