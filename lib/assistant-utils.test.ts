import { describe, expect, it } from "vitest";

import { sanitizeErrorMessage } from "@/lib/assistant-utils";

describe("sanitizeErrorMessage", () => {
  it("serializes plain objects instead of [object Object]", () => {
    const message = sanitizeErrorMessage({
      code: "x",
      detail: "y"
    });

    expect(message).toContain('"code":"x"');
    expect(message).toContain('"detail":"y"');
  });

  it("redacts token patterns from serialized object strings", () => {
    const message = sanitizeErrorMessage({
      token: "sk-abc123",
      auth: "Bearer secret-value"
    });

    expect(message).not.toContain("sk-abc123");
    expect(message).not.toContain("Bearer secret-value");
    expect(message).toContain("[REDACTED]");
  });

  it("handles circular objects safely", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const message = sanitizeErrorMessage(circular);
    expect(message).toBe("[object Object]");
  });
});
