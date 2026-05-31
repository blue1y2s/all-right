import type { AdaptedPost, PublishResult } from "@/types/content";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createPublishResult(
  post: AdaptedPost,
  overrides: Partial<PublishResult> = {},
): PublishResult {
  return {
    id: `${post.platformId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    platformId: post.platformId,
    platformLabel: post.platformLabel,
    title: post.title,
    status: "pending",
    logs: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export async function simulatePublish(post: AdaptedPost): Promise<PublishResult> {
  const startedAt = performance.now();
  await wait(420 + post.platformId.length * 90);

  if (!post.title.trim() || !post.body.trim()) {
    return createPublishResult(post, {
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error: "标题或正文为空，无法生成草稿。",
      logs: [
        "已创建模拟发布任务",
        "校验失败：缺少标题或正文",
        "任务终止，可修改内容后重试",
      ],
    });
  }

  return createPublishResult(post, {
    status: "success",
    externalPostId: `sim-${post.platformId}-${Date.now()}`,
    simulatedUrl: `https://demo.all-right.local/${post.platformId}/${encodeURIComponent(post.title.slice(0, 24))}`,
    durationMs: Math.round(performance.now() - startedAt),
    logs: [
      "已创建模拟发布任务",
      "已完成平台格式校验",
      "已写入草稿箱队列",
      "模拟发布完成",
    ],
  });
}
