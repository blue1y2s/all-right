import { describe, expect, it } from "vitest";
import { platformAdapters } from "@/lib/adapters";
import { demoContent } from "@/lib/demoContent";
import {
  canRetry,
  canWithdraw,
  createPendingQueue,
  createRunningResult,
  createWithdrawnResult,
  prependHistory,
  replaceQueueItem,
  upsertQueueItem,
} from "@/lib/publishQueue";

const posts = platformAdapters.map((adapter) => adapter.adapt(demoContent));

describe("publish queue helpers", () => {
  it("creates one pending task per adapted platform", () => {
    const queue = createPendingQueue(posts, 1000);

    expect(queue).toHaveLength(4);
    expect(queue.every((item) => item.status === "pending")).toBe(true);
    expect(queue.map((item) => item.platformId)).toEqual([
      "wechat",
      "zhihu",
      "bilibili",
      "xiaohongshu",
    ]);
  });

  it("replaces and upserts queue results by task id", () => {
    const queue = createPendingQueue(posts, 1000);
    const running = createRunningResult(posts[0], queue[0].id);

    const replaced = replaceQueueItem(queue, running);
    expect(replaced[0].status).toBe("running");
    expect(replaced).toHaveLength(queue.length);

    const newRunning = createRunningResult(posts[1], "manual-task");
    const upserted = upsertQueueItem(replaced, newRunning);
    expect(upserted[0].id).toBe("manual-task");
    expect(upserted).toHaveLength(queue.length + 1);
  });

  it("keeps publish history unique and bounded", () => {
    const queue = createPendingQueue(posts, 1000);
    const first = { ...queue[0], status: "success" as const };
    const updated = { ...first, status: "withdrawn" as const };
    const filler = Array.from({ length: 20 }, (_, index) => ({
      ...queue[index % queue.length],
      id: `old-${index}`,
    }));

    const history = prependHistory(prependHistory(filler, first), updated);

    expect(history).toHaveLength(16);
    expect(history[0].status).toBe("withdrawn");
    expect(history.filter((item) => item.id === first.id)).toHaveLength(1);
  });

  it("marks successful publish results as withdrawn", () => {
    const result = {
      ...createRunningResult(posts[0], "wechat-task"),
      status: "success" as const,
      simulatedUrl: "https://demo.all-right.local/wechat/test",
    };
    const withdrawn = createWithdrawnResult(result, new Date("2026-05-31T04:00:00.000Z"));

    expect(canWithdraw(result)).toBe(true);
    expect(canRetry(result)).toBe(false);
    expect(withdrawn.status).toBe("withdrawn");
    expect(withdrawn.updatedAt).toBe("2026-05-31T04:00:00.000Z");
    expect(withdrawn.logs.at(-1)).toContain("已撤回");
  });
});
