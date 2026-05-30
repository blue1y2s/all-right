import { describe, expect, it } from "vitest";
import { platformAdapters } from "@/lib/adapters";
import { demoContent } from "@/lib/demoContent";
import {
  createDraftFilename,
  createPlainDraft,
  serializeDraftPackage,
} from "@/lib/draftPackage";

describe("draft package", () => {
  const post = platformAdapters[0].adapt(demoContent);

  it("creates a portable JSON draft package", () => {
    const parsed = JSON.parse(serializeDraftPackage(post));

    expect(parsed.version).toBe(1);
    expect(parsed.platform.id).toBe(post.platformId);
    expect(parsed.draft.title).toBe(post.title);
    expect(parsed.draft.tags.length).toBeGreaterThan(0);
  });

  it("creates copyable plain text and a stable filename", () => {
    expect(createPlainDraft(post)).toContain(post.platformLabel);
    expect(createPlainDraft(post)).toContain(post.title);
    expect(createDraftFilename(post)).toMatch(/^wechat-.+\.json$/);
  });
});
