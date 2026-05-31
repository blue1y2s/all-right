import { normalizeContextItem, normalizeSourceContent, repairActivePointers } from "@/lib/context/migrateWorkspace";
import type { SourceContent } from "@/types/content";
import type { ContextItem, DraftRecord, PersistedWorkspace, WorkspaceState } from "@/types/context";

export type WorkspaceAction =
  | { type: "PATCH_ACTIVE_SOURCE"; patch: Partial<SourceContent> }
  | { type: "SWITCH_DRAFT"; draftId: string }
  | { type: "SWITCH_PROJECT"; projectId: string }
  | { type: "UPSERT_CONTEXT_ITEM"; item: ContextItem }
  | { type: "DELETE_CONTEXT_ITEM"; id: string }
  | { type: "HYDRATE"; workspace: PersistedWorkspace | WorkspaceState };

function nowIso() {
  return new Date().toISOString();
}

function newestDraft(drafts: DraftRecord[]) {
  return [...drafts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

export function selectActiveDraft(state: WorkspaceState): DraftRecord {
  const repaired = repairActivePointers(state);
  return repaired.drafts.find((draft) => draft.id === repaired.activeDraftId) ?? repaired.drafts[0];
}

export function selectActiveSource(state: WorkspaceState): SourceContent {
  return selectActiveDraft(state).source;
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === "HYDRATE") return repairActivePointers(action.workspace);

  if (action.type === "PATCH_ACTIVE_SOURCE") {
    const repaired = repairActivePointers(state);
    const timestamp = nowIso();
    const drafts = repaired.drafts.map((draft) =>
      draft.id === repaired.activeDraftId
        ? {
            ...draft,
            source: normalizeSourceContent({ ...draft.source, ...action.patch }),
            updatedAt: timestamp,
          }
        : draft,
    );

    return { ...repaired, drafts };
  }

  if (action.type === "SWITCH_DRAFT") {
    if (!state.drafts.some((draft) => draft.id === action.draftId)) return state;
    return repairActivePointers({ ...state, activeDraftId: action.draftId });
  }

  if (action.type === "SWITCH_PROJECT") {
    if (!state.projects.some((project) => project.id === action.projectId)) return state;
    const timestamp = nowIso();
    const activeDraft = state.drafts.find((draft) => draft.id === state.activeDraftId);
    const projectDraft =
      activeDraft?.projectId === action.projectId
        ? activeDraft
        : newestDraft(state.drafts.filter((draft) => draft.projectId === action.projectId));

    if (projectDraft) {
      return repairActivePointers({
        ...state,
        activeProjectId: action.projectId,
        activeDraftId: projectDraft.id,
      });
    }

    const draft: DraftRecord = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `draft-${Date.now()}`,
      projectId: action.projectId,
      name: "未命名稿件",
      source: selectActiveSource(state),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return repairActivePointers({
      ...state,
      drafts: [...state.drafts, draft],
      activeProjectId: action.projectId,
      activeDraftId: draft.id,
    });
  }

  if (action.type === "UPSERT_CONTEXT_ITEM") {
    const normalized = normalizeContextItem(action.item);
    if (!normalized) return state;
    const exists = state.contextItems.some((item) => item.id === normalized.id);
    return {
      ...state,
      contextItems: exists
        ? state.contextItems.map((item) => (item.id === normalized.id ? normalized : item))
        : [...state.contextItems, normalized],
    };
  }

  if (action.type === "DELETE_CONTEXT_ITEM") {
    return {
      ...state,
      contextItems: state.contextItems.filter((item) => item.id !== action.id),
    };
  }

  return state;
}
