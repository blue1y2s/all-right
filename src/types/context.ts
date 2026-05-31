import type { SourceContent } from "@/types/content";

export type ContextScope = "global" | "project" | "draft";

export type ContextType = "markdown" | "plain";

export interface ContextItem {
  id: string;
  scope: ContextScope;
  projectId?: string;
  draftId?: string;
  title: string;
  type: ContextType;
  content: string;
  enabled: boolean;
  tags?: string[];
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DraftRecord {
  id: string;
  projectId: string;
  name: string;
  source: SourceContent;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedContextBundle {
  items: ContextItem[];
  truncated: boolean;
  counts: { global: number; project: number; draft: number };
}

export interface WorkspaceState {
  projects: Project[];
  drafts: DraftRecord[];
  contextItems: ContextItem[];
  activeProjectId: string;
  activeDraftId: string;
}

export interface PersistedWorkspace extends WorkspaceState {
  schemaVersion: 1;
}

export interface LoadWorkspaceMeta {
  notice?: string;
  persistFailed?: boolean;
  autoSaveDisabled?: boolean;
  loadSource:
    | "single-key"
    | "legacy-keys"
    | "default-new"
    | "newer-schema-readonly"
    | "corrupt-key-legacy-fallback";
}

export interface LoadWorkspaceResult {
  state: WorkspaceState;
  meta: LoadWorkspaceMeta;
}

export type SaveWorkspaceResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "serialize" | "unknown" | "readonly"; message: string };

export interface ContextExportFile {
  exportVersion: 1;
  exportedAt: string;
  app: "all-right";
  projects: Project[];
  drafts: DraftRecord[];
  contextItems: ContextItem[];
}

export type ContextImportMode = "merge" | "append-only";

export interface ContextImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}
