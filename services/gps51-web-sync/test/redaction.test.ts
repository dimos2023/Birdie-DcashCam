import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactSecrets, sanitizeUrl } from "../src/browser/redaction.js";

describe("redaction", () => {
  it("redacts secret keys recursively", () => {
    const input = {
      deviceid: "123",
      token: "abc-secret",
      nested: { password: "pw", authorization: "Bearer x" },
      list: [{ cookie: "c" }, { lat: 1 }],
    };
    const out = redactSecrets(input);
    expect(out).toEqual({
      deviceid: "123",
      token: "[REDACTED]",
      nested: { password: "[REDACTED]", authorization: "[REDACTED]" },
      list: [{ cookie: "[REDACTED]" }, { lat: 1 }],
    });
  });

  it("redacts access_token, refresh_token, service_role, session, secret, and key", () => {
    const input = {
      access_token: "at",
      refresh_token: "rt",
      service_role: "sr",
      session: "sess",
      secret: "sec",
      key: "k",
      deviceid: "999",
    };
    const out = redactSecrets(input) as Record<string, unknown>;
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.refresh_token).toBe("[REDACTED]");
    expect(out.service_role).toBe("[REDACTED]");
    expect(out.session).toBe("[REDACTED]");
    expect(out.secret).toBe("[REDACTED]");
    expect(out.key).toBe("[REDACTED]");
    expect(out.deviceid).toBe("999");
  });

  it("redacts api_key", () => {
    const out = redactSecrets({ api_key: "secret", deviceid: "1" }) as Record<string, unknown>;
    expect(out.api_key).toBe("[REDACTED]");
  });

  it("sanitizes token query params in URLs", () => {
    const url = sanitizeUrl("https://gps51.com/webapi?action=lastposition&token=SECRET123");
    expect(decodeURIComponent(url)).toContain("[REDACTED]");
    expect(url).not.toContain("SECRET123");
  });
});
