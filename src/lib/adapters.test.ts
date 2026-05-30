import { describe, expect, it } from "vitest";
import { platformAdapters } from "@/lib/adapters";
import { demoContent } from "@/lib/demoContent";

describe("platform adapters", () => {
  it("adapts one source article for every supported platform", () => {
    for (const adapter of platformAdapters) {
      const post = adapter.adapt(demoContent);

      expect(post.platformId).toBe(adapter.id);
      expect(post.platformLabel).toBe(adapter.label);
      expect(post.title.length).toBeGreaterThan(0);
      expect(post.body.length).toBeGreaterThan(0);
      expect(post.summary.length).toBeGreaterThan(0);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(Array.isArray(post.warnings)).toBe(true);
      expect(post.wordCount).toBeGreaterThan(0);
      expect(post.readingTimeMinutes).toBeGreaterThanOrEqual(1);
    }
  });

  it("reports validation warnings for empty content", () => {
    const source = {
      ...demoContent,
      title: "",
      body: "",
      tags: [],
    };

    const warnings = platformAdapters.flatMap((adapter) => {
      const post = adapter.adapt(source);
      return adapter.validate(post);
    });

    expect(warnings.some((warning) => warning.includes("标题"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("正文"))).toBe(true);
  });
});
