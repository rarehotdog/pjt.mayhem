import { describe, expect, it } from "vitest";

import {
  createInMemoryAssistantUpdateRepository,
  markAssistantUpdateStatus,
  reserveAssistantUpdate
} from "@/lib/assistant-store";

describe("assistant update idempotency", () => {
  it("ignores duplicate update_id", async () => {
    const repo = createInMemoryAssistantUpdateRepository();

    const first = await reserveAssistantUpdate(
      {
        updateId: 1001,
        source: "webhook",
        userId: 1,
        chatId: 2
      },
      repo
    );
    expect(first.reserved).toBe(true);

    const second = await reserveAssistantUpdate(
      {
        updateId: 1001,
        source: "webhook",
        userId: 1,
        chatId: 2
      },
      repo
    );
    expect(second.reserved).toBe(false);
  });

  it("treats same update_id from different bot_id as different records", async () => {
    const repo = createInMemoryAssistantUpdateRepository();

    const cos = await reserveAssistantUpdate(
      {
        botId: "tyler_durden",
        updateId: 3003,
        source: "webhook",
        userId: 1,
        chatId: 2
      },
      repo
    );
    const lens = await reserveAssistantUpdate(
      {
        botId: "zhuge_liang",
        updateId: 3003,
        source: "webhook",
        userId: 1,
        chatId: 2
      },
      repo
    );

    expect(cos.reserved).toBe(true);
    expect(lens.reserved).toBe(true);
  });

  it("marks processed status after handling", async () => {
    const repo = createInMemoryAssistantUpdateRepository();

    await reserveAssistantUpdate(
      {
        updateId: 2002,
        source: "webhook",
        userId: 1,
        chatId: 2
      },
      repo
    );

    await markAssistantUpdateStatus(2002, "processed", undefined, "tyler_durden", repo);
    const stored = await repo.findById(2002, "tyler_durden");

    expect(stored?.status).toBe("processed");
    expect(stored?.processedAt).toBeDefined();
  });
});
