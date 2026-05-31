import { createPublishResult } from "@/lib/publishing";
import type { AdaptedPost, PublishResult } from "@/types/content";

export const maxPublishHistory = 16;

export function createPendingQueue(posts: AdaptedPost[], timestamp = Date.now()) {
  return posts.map((post, index) =>
    createPublishResult(post, {
      id: `${post.platformId}-${timestamp}-${index}`,
      status: "pending",
      logs: ["等待进入模拟发布器"],
    }),
  );
}

export function createRunningResult(post: AdaptedPost, id: string) {
  return createPublishResult(post, {
    id,
    status: "running",
    logs: ["任务进入模拟发布器", "正在执行平台校验"],
  });
}

export function replaceQueueItem(queue: PublishResult[], result: PublishResult) {
  return queue.map((item) => (item.id === result.id ? result : item));
}

export function upsertQueueItem(queue: PublishResult[], result: PublishResult) {
  const exists = queue.some((item) => item.id === result.id);
  return exists ? replaceQueueItem(queue, result) : [result, ...queue];
}

export function prependHistory(
  history: PublishResult[],
  result: PublishResult,
  limit = maxPublishHistory,
) {
  return [result, ...history.filter((item) => item.id !== result.id)].slice(0, limit);
}

export function canRetry(result: PublishResult) {
  return result.status === "failed";
}

export function canWithdraw(result: PublishResult) {
  return result.status === "success";
}

export function createWithdrawnResult(result: PublishResult, timestamp = new Date()) {
  return {
    ...result,
    status: "withdrawn" as const,
    error: undefined,
    updatedAt: timestamp.toISOString(),
    logs: [
      ...result.logs,
      "已提交模拟撤回请求",
      "模拟发布记录已标记为已撤回",
    ],
  };
}
