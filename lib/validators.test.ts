import { describe, expect, it } from "vitest";

import {
  assistantActionReviewSchema,
  assistantLocalJobCompleteSchema,
  telegramOpsRunSchema
} from "@/lib/validators";

describe("assistant validator schemas", () => {
  it("validates telegram ops run mode", () => {
    expect(telegramOpsRunSchema.safeParse({ mode: "cloud" }).success).toBe(true);
    expect(telegramOpsRunSchema.safeParse({ mode: "local_queue" }).success).toBe(true);
    expect(telegramOpsRunSchema.safeParse({ mode: "invalid" }).success).toBe(false);
  });

  it("requires outputText for done local job completion in route-level logic", () => {
    const parsed = assistantLocalJobCompleteSchema.safeParse({
      jobId: "job-1",
      status: "done",
      outputText: "ok"
    });
    expect(parsed.success).toBe(true);
  });

  it("validates action review payload", () => {
    expect(
      assistantActionReviewSchema.safeParse({
        actionId: "ACT-1",
        approvedBy: 123
      }).success
    ).toBe(true);
  });
});
