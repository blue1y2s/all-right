import type { ResolvedContextBundle } from "@/types/context";

export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export const WORKSPACE_STORAGE_KEY = "all-right:workspace:v1";
export const UNKNOWN_WORKSPACE_BACKUP_KEY = "all-right:workspace:unknown-backup";

export const LEGACY_PROJECTS_KEY = "all-right:projects:v1";
export const LEGACY_DRAFTS_KEY = "all-right:drafts:v1";
export const LEGACY_CONTEXT_ITEMS_KEY = "all-right:context-items:v1";

export const DEFAULT_PROJECT_ID = "project-default";
export const DEFAULT_DRAFT_ID = "draft-1";

export const MAX_ITEM_CHARS = 32_000;
export const MAX_INJECT_CHARS = 48_000;

export const EMPTY_CONTEXT_BUNDLE: ResolvedContextBundle = {
  items: [],
  truncated: false,
  counts: { global: 0, project: 0, draft: 0 },
};
