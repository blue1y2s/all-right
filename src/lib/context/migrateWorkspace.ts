import { demoContent } from "@/lib/demoContent";
import {
  DEFAULT_DRAFT_ID,
  DEFAULT_PROJECT_ID,
  WORKSPACE_SCHEMA_VERSION,
} from "@/lib/context/constants";
import type { ContentTone, SourceContent } from "@/types/content";
import type {
  ContextItem,
  DraftRecord,
  PersistedWorkspace,
  Project,
  WorkspaceState,
} from "@/types/context";

const toneValues = new Set<ContentTone>([
  "professional",
  "friendly",
  "practical",
  "story",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asIsoString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asContentTone(value: unknown): ContentTone {
  return typeof value === "string" && toneValues.has(value as ContentTone)
    ? (value as ContentTone)
    : "practical";
}

export function normalizeSourceContent(source: unknown): SourceContent {
  const record = isRecord(source) ? source : {};

  return {
    title: asString(record.title),
    body: asString(record.body),
    tags: asStringArray(record.tags),
    coverUrl: asOptionalString(record.coverUrl),
    tone: asContentTone(record.tone),
    audience: asString(record.audience),
  };
}

export function createDefaultWorkspace(now = new Date().toISOString()): WorkspaceState {
  return {
    projects: [
      {
        id: DEFAULT_PROJECT_ID,
        name: "默认项目",
        description: "首次启动自动创建的默认项目",
        createdAt: now,
        updatedAt: now,
      },
    ],
    drafts: [
      {
        id: DEFAULT_DRAFT_ID,
        projectId: DEFAULT_PROJECT_ID,
        name: "默认稿件",
        source: demoContent,
        createdAt: now,
        updatedAt: now,
      },
    ],
    contextItems: [],
    activeProjectId: DEFAULT_PROJECT_ID,
    activeDraftId: DEFAULT_DRAFT_ID,
  };
}

export function toPersistedWorkspace(state: WorkspaceState): PersistedWorkspace {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    projects: state.projects,
    drafts: state.drafts,
    contextItems: state.contextItems,
    activeProjectId: state.activeProjectId,
    activeDraftId: state.activeDraftId,
  };
}

export function normalizeProject(value: unknown, fallback: Project): Project {
  const record = isRecord(value) ? value : {};
  const id = asString(record.id, fallback.id);
  const createdAt = asIsoString(record.createdAt, fallback.createdAt);

  return {
    id,
    name: asString(record.name, fallback.name).trim() || fallback.name,
    description: asOptionalString(record.description),
    createdAt,
    updatedAt: asIsoString(record.updatedAt, createdAt),
  };
}

export function normalizeDraft(value: unknown, fallback: DraftRecord): DraftRecord {
  const record = isRecord(value) ? value : {};
  const id = asString(record.id, fallback.id);
  const createdAt = asIsoString(record.createdAt, fallback.createdAt);

  return {
    id,
    projectId: asString(record.projectId, fallback.projectId),
    name: asString(record.name, fallback.name).trim() || fallback.name,
    source: normalizeSourceContent(record.source ?? fallback.source),
    createdAt,
    updatedAt: asIsoString(record.updatedAt, createdAt),
  };
}

export function normalizeContextItem(value: unknown): ContextItem | null {
  if (!isRecord(value)) return null;
  const id = asString(value.id);
  const title = asString(value.title).trim();
  const content = asString(value.content);
  const scope = value.scope;
  const type = value.type;
  const now = new Date().toISOString();

  if (!id || !title) return null;
  if (scope !== "global" && scope !== "project" && scope !== "draft") return null;

  return {
    id,
    scope,
    projectId: scope === "project" ? asOptionalString(value.projectId) : undefined,
    draftId: scope === "draft" ? asOptionalString(value.draftId) : undefined,
    title,
    type: type === "markdown" ? "markdown" : "plain",
    content,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    tags: asStringArray(value.tags).slice(0, 10),
    sizeBytes:
      typeof value.sizeBytes === "number" && Number.isFinite(value.sizeBytes)
        ? value.sizeBytes
        : new TextEncoder().encode(content).byteLength,
    createdAt: asIsoString(value.createdAt, now),
    updatedAt: asIsoString(value.updatedAt, asIsoString(value.createdAt, now)),
  };
}

export function normalizeWorkspace(value: unknown): WorkspaceState {
  const defaults = createDefaultWorkspace();
  const record = isRecord(value) ? value : {};
  const projectsInput = Array.isArray(record.projects) ? record.projects : [];
  const draftsInput = Array.isArray(record.drafts) ? record.drafts : [];
  const contextInput = Array.isArray(record.contextItems) ? record.contextItems : [];

  const projects = projectsInput.map((item, index) =>
    normalizeProject(item, defaults.projects[index] ?? defaults.projects[0]),
  );
  const safeProjects = projects.length > 0 ? projects : defaults.projects;

  const drafts = draftsInput.map((item, index) =>
    normalizeDraft(item, defaults.drafts[index] ?? defaults.drafts[0]),
  );
  const safeDrafts = drafts.length > 0 ? drafts : defaults.drafts;

  return repairActivePointers({
    projects: safeProjects,
    drafts: safeDrafts,
    contextItems: contextInput.flatMap((item) => {
      const normalized = normalizeContextItem(item);
      return normalized ? [normalized] : [];
    }),
    activeProjectId: asString(record.activeProjectId, safeProjects[0].id),
    activeDraftId: asString(record.activeDraftId, safeDrafts[0].id),
  });
}

export function repairActivePointers(state: WorkspaceState): WorkspaceState {
  const now = new Date().toISOString();
  let projects = state.projects.length > 0 ? state.projects : createDefaultWorkspace(now).projects;
  let activeProjectId = projects.some((project) => project.id === state.activeProjectId)
    ? state.activeProjectId
    : projects.find((project) => project.id === DEFAULT_PROJECT_ID)?.id ?? projects[0].id;

  if (projects.length === 0) {
    projects = createDefaultWorkspace(now).projects;
    activeProjectId = DEFAULT_PROJECT_ID;
  }

  let drafts = state.drafts.filter((draft) =>
    projects.some((project) => project.id === draft.projectId),
  );

  const activeDraft = drafts.find((draft) => draft.id === state.activeDraftId);
  let activeDraftId =
    activeDraft && activeDraft.projectId === activeProjectId ? activeDraft.id : undefined;

  if (!activeDraftId) {
    activeDraftId = drafts
      .filter((draft) => draft.projectId === activeProjectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.id;
  }

  if (!activeDraftId) {
    const draft: DraftRecord = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `draft-${Date.now()}`,
      projectId: activeProjectId,
      name: "未命名稿件",
      source: demoContent,
      createdAt: now,
      updatedAt: now,
    };
    drafts = [...drafts, draft];
    activeDraftId = draft.id;
  }

  return {
    projects,
    drafts,
    contextItems: state.contextItems,
    activeProjectId,
    activeDraftId,
  };
}
