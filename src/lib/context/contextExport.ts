import type { ContextExportFile, PersistedWorkspace, Project } from "@/types/context";

export type ExportScope = "global-only" | "current-project" | "full-snapshot";

export function buildContextExport(
  scope: ExportScope,
  state: Pick<PersistedWorkspace, "projects" | "drafts" | "contextItems" | "activeProjectId">,
): ContextExportFile {
  const activeProjectIds = new Set([state.activeProjectId]);
  const activeDraftIds = new Set(
    state.drafts.filter((draft) => draft.projectId === state.activeProjectId).map((draft) => draft.id),
  );

  const projects: Project[] =
    scope === "full-snapshot"
      ? state.projects
      : scope === "current-project"
        ? state.projects.filter((project) => project.id === state.activeProjectId)
        : [];
  const drafts =
    scope === "full-snapshot"
      ? state.drafts
      : scope === "current-project"
        ? state.drafts.filter((draft) => draft.projectId === state.activeProjectId)
        : [];
  const contextItems = state.contextItems.filter((item) => {
    if (scope === "full-snapshot") return true;
    if (scope === "global-only") return item.scope === "global";
    if (item.scope === "global") return true;
    if (item.scope === "project") return item.projectId ? activeProjectIds.has(item.projectId) : false;
    return item.draftId ? activeDraftIds.has(item.draftId) : false;
  });

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "all-right",
    projects,
    drafts,
    contextItems,
  };
}

export function serializeContextExport(file: ContextExportFile) {
  return JSON.stringify(file, null, 2);
}
