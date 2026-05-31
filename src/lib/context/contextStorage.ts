import {
  LEGACY_CONTEXT_ITEMS_KEY,
  LEGACY_DRAFTS_KEY,
  LEGACY_PROJECTS_KEY,
  UNKNOWN_WORKSPACE_BACKUP_KEY,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_STORAGE_KEY,
} from "@/lib/context/constants";
import {
  createDefaultWorkspace,
  normalizeWorkspace,
  repairActivePointers,
  toPersistedWorkspace,
} from "@/lib/context/migrateWorkspace";
import type {
  LoadWorkspaceResult,
  PersistedWorkspace,
  SaveWorkspaceResult,
  WorkspaceState,
} from "@/types/context";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function parseJson(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function hasLegacyData(storage: StorageLike) {
  return Boolean(
    storage.getItem(LEGACY_PROJECTS_KEY) ??
      storage.getItem(LEGACY_DRAFTS_KEY) ??
      storage.getItem(LEGACY_CONTEXT_ITEMS_KEY),
  );
}

function parseLegacyArray(value: string | null): unknown[] | null {
  if (!value) return null;
  const parsed = parseJson(value);
  return parsed.ok && Array.isArray(parsed.value) ? parsed.value : null;
}

function createLegacyCandidate(storage: StorageLike, legacyWorkspace?: unknown): WorkspaceState | null {
  if (!hasLegacyData(storage)) return null;

  const projects = parseLegacyArray(storage.getItem(LEGACY_PROJECTS_KEY));
  const drafts = parseLegacyArray(storage.getItem(LEGACY_DRAFTS_KEY));
  const contextItems = parseLegacyArray(storage.getItem(LEGACY_CONTEXT_ITEMS_KEY));
  const hasRecoverableLegacyData = Boolean(
    projects?.length || drafts?.length || contextItems?.length || isRecord(legacyWorkspace),
  );

  if (!hasRecoverableLegacyData) return null;

  const workspaceRecord = isRecord(legacyWorkspace) ? legacyWorkspace : {};
  return normalizeWorkspace({
    projects: projects ?? [],
    drafts: drafts ?? [],
    contextItems: contextItems ?? [],
    activeProjectId: workspaceRecord.activeProjectId,
    activeDraftId: workspaceRecord.activeDraftId,
  });
}

function canReadBackWorkspace(storage: StorageLike) {
  const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) return false;
  const parsed = parseJson(raw);
  return parsed.ok && isRecord(parsed.value) && parsed.value.schemaVersion === WORKSPACE_SCHEMA_VERSION;
}

function migrateFromLegacyKeys(
  storage: StorageLike,
  legacyWorkspace?: unknown,
  loadSource: LoadWorkspaceResult["meta"]["loadSource"] = "legacy-keys",
): LoadWorkspaceResult | null {
  const candidate = createLegacyCandidate(storage, legacyWorkspace);
  if (!candidate) return null;

  const saveResult = saveWorkspace(candidate, storage);
  if (saveResult.ok && canReadBackWorkspace(storage)) {
    storage.removeItem(LEGACY_PROJECTS_KEY);
    storage.removeItem(LEGACY_DRAFTS_KEY);
    storage.removeItem(LEGACY_CONTEXT_ITEMS_KEY);

    return {
      state: candidate,
      meta: { loadSource },
    };
  }

  return {
    state: candidate,
    meta: {
      loadSource,
      persistFailed: true,
      notice:
        "本地迁移保存失败，仍使用合并后的工作区；请导出备份。刷新后将继续尝试迁移。",
    },
  };
}

function handleNewerSchemaVersion(storage: StorageLike, raw: string): LoadWorkspaceResult {
  let notice = "检测到更高版本保存的数据，当前应用无法写入。原始数据已备份到 unknown-backup，请升级应用后重试。";
  try {
    storage.setItem(UNKNOWN_WORKSPACE_BACKUP_KEY, raw);
  } catch {
    notice = "检测到更高版本保存的数据，当前应用无法写入；备份 unknown-backup 失败，请升级应用后重试。";
  }

  return {
    state: repairActivePointers(createDefaultWorkspace()),
    meta: {
      loadSource: "newer-schema-readonly",
      autoSaveDisabled: true,
      notice,
    },
  };
}

export function loadWorkspace(storage = getDefaultStorage()): LoadWorkspaceResult {
  if (!storage) {
    return { state: createDefaultWorkspace(), meta: { loadSource: "default-new" } };
  }

  const raw = storage.getItem(WORKSPACE_STORAGE_KEY);
  if (!raw) {
    return migrateFromLegacyKeys(storage) ?? {
      state: createDefaultWorkspace(),
      meta: { loadSource: "default-new" },
    };
  }

  const parsed = parseJson(raw);
  if (!parsed.ok) {
    return migrateFromLegacyKeys(storage, undefined, "corrupt-key-legacy-fallback") ?? {
      state: createDefaultWorkspace(),
      meta: { loadSource: "default-new" },
    };
  }

  if (!isRecord(parsed.value)) {
    return migrateFromLegacyKeys(storage) ?? {
      state: createDefaultWorkspace(),
      meta: { loadSource: "default-new" },
    };
  }

  const schemaVersion = parsed.value.schemaVersion;
  if (typeof schemaVersion === "number" && schemaVersion > WORKSPACE_SCHEMA_VERSION) {
    return handleNewerSchemaVersion(storage, raw);
  }

  if (schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    return (
      migrateFromLegacyKeys(storage, parsed.value) ?? {
        state: normalizeWorkspace(parsed.value),
        meta: { loadSource: "single-key" },
      }
    );
  }

  return {
    state: normalizeWorkspace(parsed.value),
    meta: { loadSource: "single-key" },
  };
}

export function saveWorkspace(
  state: WorkspaceState,
  storage = getDefaultStorage(),
): SaveWorkspaceResult {
  if (!storage) return { ok: false, reason: "unknown", message: "当前环境不可写入本地存储。" };

  let serialized: string;
  try {
    serialized = JSON.stringify(toPersistedWorkspace(state satisfies WorkspaceState) satisfies PersistedWorkspace);
  } catch {
    return { ok: false, reason: "serialize", message: "工作区序列化失败，未写入本地存储。" };
  }

  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, serialized);
    return { ok: true };
  } catch (error) {
    if (isQuotaError(error)) {
      return {
        ok: false,
        reason: "quota",
        message: "本地保存失败（存储空间不足），请导出 Context 包备份。刷新后可能丢失未保存修改。",
      };
    }

    return { ok: false, reason: "unknown", message: "本地保存失败，请导出 Context 包备份。" };
  }
}

export function persistWorkspaceIfAllowed(
  state: WorkspaceState,
  meta: LoadWorkspaceResult["meta"],
  storage = getDefaultStorage(),
): SaveWorkspaceResult {
  if (meta.autoSaveDisabled) {
    return { ok: false, reason: "readonly", message: "只读模式无法写入本地工作区。" };
  }

  return saveWorkspace(state, storage);
}
