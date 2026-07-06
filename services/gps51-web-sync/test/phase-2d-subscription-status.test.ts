import { describe, expect, it } from "vitest";
import {
  buildSubscriptionPayload,
  loadSubscriptionFrameTemplate,
} from "../src/browser/monitor-subscription.js";

describe("subscription payload builder", () => {
  it("builds batched websocket subscription frame", () => {
    const payload = buildSubscriptionPayload(
      {
        payload: { action: "subscribe", deviceids: [] },
        deviceIdField: "deviceids",
        supportsBatch: true,
      },
      ["a", "b"],
    );
    expect(payload.deviceids).toEqual(["a", "b"]);

    const single = buildSubscriptionPayload(
      {
        payload: { action: "subscribe", deviceids: [] },
        deviceIdField: "deviceids",
        supportsBatch: true,
      },
      ["a"],
    );
    expect(single.deviceid).toBe("a");
  });

  it("returns null when capture file is missing", () => {
    expect(loadSubscriptionFrameTemplate("/nonexistent/path")).toBeNull();
  });
});
