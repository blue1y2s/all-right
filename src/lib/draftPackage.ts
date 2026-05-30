import type { AdaptedPost } from "@/types/content";

export function createDraftFilename(post: AdaptedPost) {
  const slug = post.title
    .trim()
    .toLowerCase()
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${post.platformId}-${slug || "draft"}.json`;
}

export function createPlainDraft(post: AdaptedPost) {
  return [
    `平台：${post.platformLabel}`,
    `标题：${post.title}`,
    `摘要：${post.summary}`,
    `标签：${post.tags.map((tag) => `#${tag}`).join(" ")}`,
    "",
    post.body,
  ].join("\n");
}

export function serializeDraftPackage(post: AdaptedPost) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      platform: {
        id: post.platformId,
        label: post.platformLabel,
      },
      draft: {
        title: post.title,
        summary: post.summary,
        body: post.body,
        tags: post.tags,
        wordCount: post.wordCount,
        readingTimeMinutes: post.readingTimeMinutes,
        warnings: post.warnings,
      },
    },
    null,
    2,
  );
}
