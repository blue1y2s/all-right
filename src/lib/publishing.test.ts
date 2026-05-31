import { describe, expect, it } from "vitest";
import { platformAdapters } from "@/lib/adapters";
import { demoContent } from "@/lib/demoContent";
import { simulatePublish } from "@/lib/publishing";

describe("simulatePublish", () => {
  it("returns a success result for valid adapted content", async () => {
    const post = platformAdapters[0].adapt(demoContent);
    const result = await simulatePublish(post);

    expect(result.status).toBe("success");
    expect(result.externalPostId).toContain(post.platformId);
    expect(result.simulatedUrl).toContain(post.platformId);
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it("returns a failed result when required content is missing", async () => {
    const post = {
      ...platformAdapters[0].adapt(demoContent),
      title: "",
      body: "",
    };
    const result = await simulatePublish(post);

    expect(result.status).toBe("failed");
    expect(result.error).toBeTruthy();
  });
});
