import { describe, expect, it } from "vitest";
import { createDefaultWorkspace } from "@/lib/context/migrateWorkspace";
import { selectActiveSource, workspaceReducer } from "@/lib/context/workspaceReducer";
import type { WorkspaceState } from "@/types/context";

function stateWithTwoProjects(): WorkspaceState {
  const source = createDefaultWorkspace("2026-01-01T00:00:00.000Z");
  return {
    ...source,
    projects: [
      ...source.projects,
      { id: "project-2", name: "Project 2", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    drafts: [
      {
        ...source.drafts[0],
        id: "draft-old",
        name: "Old",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        ...source.drafts[0],
        id: "draft-new",
        name: "New",
        source: { ...source.drafts[0].source, title: "new draft" },
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
      {
        ...source.drafts[0],
        id: "draft-project-2",
        projectId: "project-2",
        name: "Project 2 Draft",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    activeDraftId: "draft-old",
  };
}

describe("workspaceReducer", () => {
  it("patches the active source and updates only that draft timestamp", () => {
    const state = stateWithTwoProjects();
    const before = state.drafts.find((draft) => draft.id === "draft-old")?.updatedAt;

    const next = workspaceReducer(state, {
      type: "PATCH_ACTIVE_SOURCE",
      patch: { title: "Updated title" },
    });

    const active = next.drafts.find((draft) => draft.id === "draft-old");
    const untouched = next.drafts.find((draft) => draft.id === "draft-new");
    expect(active?.source.title).toBe("Updated title");
    expect(active?.updatedAt).not.toBe(before);
    expect(untouched?.updatedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("switches drafts atomically without a separate source field", () => {
    const state = stateWithTwoProjects();

    const next = workspaceReducer(state, { type: "SWITCH_DRAFT", draftId: "draft-new" });

    expect(next.activeDraftId).toBe("draft-new");
    expect(selectActiveSource(next).title).toBe("new draft");
  });

  it("switches project to the newest draft in that project", () => {
    const state = stateWithTwoProjects();

    const next = workspaceReducer(state, { type: "SWITCH_PROJECT", projectId: "project-2" });

    expect(next.activeProjectId).toBe("project-2");
    expect(next.activeDraftId).toBe("draft-project-2");
  });
});
