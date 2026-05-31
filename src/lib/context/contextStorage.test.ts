import { describe, expect, it } from "vitest";
import {
  LEGACY_CONTEXT_ITEMS_KEY,
  LEGACY_DRAFTS_KEY,
  LEGACY_PROJECTS_KEY,
  UNKNOWN_WORKSPACE_BACKUP_KEY,
  WORKSPACE_SCHEMA_VERSION,
  WORKSPACE_STORAGE_KEY,
} from "@/lib/context/constants";
import {
  loadWorkspace,
  persistWorkspaceIfAllowed,
  type StorageLike,
} from "@/lib/context/contextStorage";
import { buildContextExport } from "@/lib/context/contextExport";
import { workspaceReducer } from "@/lib/context/workspaceReducer";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  failMainWrites = false;
  mainWriteCount = 0;

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (key === WORKSPACE_STORAGE_KEY) {
      this.mainWriteCount += 1;
      if (this.failMainWrites) {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      }
    }
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }
}

function seedRecoverableLegacy(storage: MemoryStorage) {
  storage.setItem(
    LEGACY_PROJECTS_KEY,
    JSON.stringify([
      {
        id: "legacy-project",
        name: "Legacy Project",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]),
  );
  storage.setItem(
    LEGACY_DRAFTS_KEY,
    JSON.stringify([
      {
        id: "legacy-draft",
        projectId: "legacy-project",
        name: "Legacy Draft",
        source: { title: "Legacy", body: "Body", tags: [], tone: "practical", audience: "读者" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]),
  );
}

describe("loadWorkspace", () => {
  describe("corrupt single key", () => {
    it("recovers from legacy keys instead of defaulting", () => {
      const storage = new MemoryStorage();
      storage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
      seedRecoverableLegacy(storage);

      const result = loadWorkspace(storage);

      expect(result.meta.loadSource).toBe("corrupt-key-legacy-fallback");
      expect(result.state.projects.map((project) => project.name)).toContain("Legacy Project");
      expect(result.state.projects[0].name).not.toBe("默认项目");
    });

    it("uses a default workspace when no legacy data is recoverable", () => {
      const storage = new MemoryStorage();
      storage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
      storage.setItem(LEGACY_PROJECTS_KEY, "{also-broken");
      storage.setItem(LEGACY_DRAFTS_KEY, "{also-broken");
      storage.setItem(LEGACY_CONTEXT_ITEMS_KEY, "{also-broken");

      const result = loadWorkspace(storage);

      expect(result.meta.loadSource).toBe("default-new");
      expect(result.state.projects[0].id).toBe("project-default");
    });

    it("keeps legacy keys and returns candidate state when migration save fails", () => {
      const storage = new MemoryStorage();
      storage.setItem(WORKSPACE_STORAGE_KEY, "{broken");
      seedRecoverableLegacy(storage);
      storage.failMainWrites = true;

      const result = loadWorkspace(storage);

      expect(result.meta.loadSource).toBe("corrupt-key-legacy-fallback");
      expect(result.meta.persistFailed).toBe(true);
      expect(result.state.projects.map((project) => project.name)).toContain("Legacy Project");
      expect(storage.getItem(LEGACY_PROJECTS_KEY)).not.toBeNull();
      expect(storage.getItem(LEGACY_DRAFTS_KEY)).not.toBeNull();
    });
  });

  describe("newer schemaVersion", () => {
    it("backs up raw bytes and disables autosave without touching the main key", () => {
      const storage = new MemoryStorage();
      const raw = JSON.stringify({
        schemaVersion: WORKSPACE_SCHEMA_VERSION + 1,
        projects: [{ id: "future", name: "Future" }],
      });
      storage.setItem(WORKSPACE_STORAGE_KEY, raw);
      storage.mainWriteCount = 0;

      const result = loadWorkspace(storage);

      expect(result.meta.loadSource).toBe("newer-schema-readonly");
      expect(result.meta.autoSaveDisabled).toBe(true);
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
      expect(storage.getItem(UNKNOWN_WORKSPACE_BACKUP_KEY)).toBe(raw);
      expect(storage.mainWriteCount).toBe(0);
    });

    it("blocks persistWorkspaceIfAllowed after reducer edits in readonly mode", () => {
      const storage = new MemoryStorage();
      const raw = JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION + 1, projects: [] });
      storage.setItem(WORKSPACE_STORAGE_KEY, raw);
      const result = loadWorkspace(storage);
      storage.mainWriteCount = 0;

      const edited = workspaceReducer(result.state, {
        type: "PATCH_ACTIVE_SOURCE",
        patch: { title: "Only in memory" },
      });
      const saveResult = persistWorkspaceIfAllowed(edited, result.meta, storage);

      expect(saveResult).toMatchObject({ ok: false, reason: "readonly" });
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
      expect(storage.mainWriteCount).toBe(0);
    });

    it("allows context export from readonly in-memory state without writing storage", () => {
      const storage = new MemoryStorage();
      const raw = JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION + 1, projects: [] });
      storage.setItem(WORKSPACE_STORAGE_KEY, raw);
      const result = loadWorkspace(storage);
      storage.mainWriteCount = 0;

      const exported = buildContextExport("full-snapshot", result.state);

      expect(exported.app).toBe("all-right");
      expect(exported.exportVersion).toBe(1);
      expect(exported.projects.length).toBeGreaterThan(0);
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
      expect(storage.mainWriteCount).toBe(0);
    });
  });
});
