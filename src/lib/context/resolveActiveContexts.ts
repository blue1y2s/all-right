import { MAX_INJECT_CHARS } from "@/lib/context/constants";
import type { ContextItem, ResolvedContextBundle } from "@/types/context";

function byUpdatedAtDesc(left: ContextItem, right: ContextItem) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function dedupeByLastOccurrence(items: ContextItem[]) {
  const byId = new Map<string, ContextItem>();
  let warnedDuplicate = false;

  for (const item of items) {
    if (byId.has(item.id)) {
      byId.delete(item.id);
      if (!warnedDuplicate && process.env.NODE_ENV !== "production") {
        console.warn(`[context] duplicate ContextItem id ignored: ${item.id}`);
        warnedDuplicate = true;
      }
    }
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}

export function resolveActiveContexts(
  allItems: ContextItem[],
  activeProjectId: string,
  activeDraftId: string,
): ResolvedContextBundle {
  const globalItems = allItems
    .filter((item) => item.scope === "global" && item.enabled)
    .sort(byUpdatedAtDesc);
  const projectItems = allItems
    .filter(
      (item) => item.scope === "project" && item.projectId === activeProjectId && item.enabled,
    )
    .sort(byUpdatedAtDesc);
  const draftItems = allItems
    .filter((item) => item.scope === "draft" && item.draftId === activeDraftId && item.enabled)
    .sort(byUpdatedAtDesc);

  const merged = dedupeByLastOccurrence([...globalItems, ...projectItems, ...draftItems]);
  const result: ContextItem[] = [];
  let remaining = MAX_INJECT_CHARS;
  let truncated = false;

  for (const item of merged) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    const take = Math.min(item.content.length, remaining);
    if (take === 0) {
      truncated = true;
      break;
    }

    if (take < item.content.length) {
      result.push({
        ...item,
        content: item.content.slice(0, take),
      });
      truncated = true;
      break;
    }

    result.push(item);
    remaining -= take;
  }

  return {
    items: result,
    truncated,
    counts: {
      global: globalItems.length,
      project: projectItems.length,
      draft: draftItems.length,
    },
  };
}
