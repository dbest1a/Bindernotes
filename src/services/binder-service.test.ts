import { describe, expect, it } from "vitest";
import { upsertBinder } from "@/services/binder-service";

describe("binder-service", () => {
  it("does not persist an untitled binder when the title is empty", async () => {
    await expect(
      upsertBinder({
        ownerId: "user-1",
        title: "   ",
      }),
    ).rejects.toThrow(/title is required/i);
  });
});
