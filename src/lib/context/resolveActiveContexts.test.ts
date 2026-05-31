import { describe, expect, it, vi } from "vitest";
import { resolveActiveContexts } from "@/lib/context/resolveActiveContexts";
import type { ContextItem } from "@/types/context";

function context(overrides: Partial<ContextItem>): ContextItem {
  return {
    id: "ctx",
    scope: "global",
    title: "Context",
    type: "plain",
    content: "content",
    enabled: true,
    sizeBytes: 7,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveActiveContexts", () => {
  it("returns an empty non-truncated bundle for an empty library", () => {
    expect(resolveActiveContexts([], "project-1", "draft-1")).toEqual({
      items: [],
      truncated: false,
      counts: { global: 0, project: 0, draft: 0 },
    });
  });

  it("counts and orders enabled global items by updatedAt descending", () => {
    const result = resolveActiveContexts(
      [
        context({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
        context({ id: "off", enabled: false, updatedAt: "2026-01-03T00:00:00.000Z" }),
        context({ id: "new", updatedAt: "2026-01-02T00:00:00.000Z" }),
      ],
      "project-1",
      "draft-1",
    );

    expect(result.counts.global).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("filters project and draft scoped contexts by active pointers", () => {
    const result = resolveActiveContexts(
      [
        context({ id: "project-hit", scope: "project", projectId: "project-1" }),
        context({ id: "project-miss", scope: "project", projectId: "project-2" }),
        context({ id: "draft-hit", scope: "draft", draftId: "draft-1" }),
        context({ id: "draft-miss", scope: "draft", draftId: "draft-2" }),
      ],
      "project-1",
      "draft-1",
    );

    expect(result.items.map((item) => item.id)).toEqual(["project-hit", "draft-hit"]);
    expect(result.counts).toEqual({ global: 0, project: 1, draft: 1 });
  });

  it("truncates only the last included item at the 48k total limit", () => {
    const result = resolveActiveContexts(
      [
        context({ id: "a", content: "a".repeat(30_000), updatedAt: "2026-01-02T00:00:00.000Z" }),
        context({ id: "b", content: "b".repeat(25_000), updatedAt: "2026-01-01T00:00:00.000Z" }),
      ],
      "project-1",
      "draft-1",
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].content).toHaveLength(30_000);
    expect(result.items[1].content).toHaveLength(18_000);
    expect(result.truncated).toBe(true);
  });

  it("drops later whole items when remaining capacity reaches zero", () => {
    const result = resolveActiveContexts(
      [
        context({ id: "full", content: "a".repeat(48_000), updatedAt: "2026-01-02T00:00:00.000Z" }),
        context({ id: "later", content: "b", updatedAt: "2026-01-01T00:00:00.000Z" }),
      ],
      "project-1",
      "draft-1",
    );

    expect(result.items.map((item) => item.id)).toEqual(["full"]);
    expect(result.truncated).toBe(true);
  });

  it("keeps the later scoped occurrence for duplicate ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = resolveActiveContexts(
      [
        context({ id: "same", scope: "global", content: "global" }),
        context({ id: "same", scope: "project", projectId: "project-1", content: "project" }),
      ],
      "project-1",
      "draft-1",
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe("project");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
