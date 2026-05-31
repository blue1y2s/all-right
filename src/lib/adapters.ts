import type {
  AdaptedPost,
  PlatformAdapter,
  PlatformConstraints,
  PlatformId,
  SourceContent,
} from "@/types/content";
import {
  countWords,
  createSummary,
  estimateReadingTime,
  formatHashTags,
  mergeTags,
  normalizeWhitespace,
  sanitizeTags,
  stripMarkdown,
  titleCaseFallback,
  toBulletHighlights,
} from "@/lib/markdown";
import { simulatePublish } from "@/lib/publishing";

const baseCapabilities = {
  article: true,
  images: true,
  video: false,
  draftFirst: true,
  scheduledPublish: false,
  simulatedPublish: true,
  postActions: {
    edit: true,
    withdraw: true,
    delete: false,
  },
};

function buildWarnings(
  post: Pick<AdaptedPost, "title" | "body" | "tags">,
  constraints: PlatformConstraints,
) {
  const warnings: string[] = [];
  const wordCount = countWords(post.body);

  if (!post.title.trim()) warnings.push("标题为空，发布前必须补齐。");
  if (!post.body.trim()) warnings.push("正文为空，无法发布。");
  if (post.title.length > constraints.titleMax) {
    warnings.push(`标题超过 ${constraints.titleMax} 字，建议压缩。`);
  }
  if (wordCount > constraints.bodyMax) {
    warnings.push(`正文约 ${wordCount} 字，超过平台建议上限 ${constraints.bodyMax} 字。`);
  }
  if (post.tags.length < constraints.minTags) {
    warnings.push(`标签偏少，建议至少 ${constraints.minTags} 个。`);
  }
  if (post.tags.length > constraints.maxTags) {
    warnings.push(`标签超过 ${constraints.maxTags} 个，系统已截断。`);
  }

  return warnings;
}

function validatePost(post: AdaptedPost, constraints: PlatformConstraints) {
  return Array.from(new Set([...post.warnings, ...buildWarnings(post, constraints)]));
}

function createPost(
  platformId: PlatformId,
  platformLabel: string,
  constraints: PlatformConstraints,
  title: string,
  summary: string,
  body: string,
  tags: string[],
) {
  const cleanBody = normalizeWhitespace(body);
  const post: AdaptedPost = {
    platformId,
    platformLabel,
    title: title.slice(0, constraints.titleMax + 16),
    summary,
    body: cleanBody,
    tags: sanitizeTags(tags, constraints.maxTags),
    wordCount: countWords(cleanBody),
    readingTimeMinutes: estimateReadingTime(cleanBody),
    warnings: [],
  };

  post.warnings = buildWarnings(post, constraints);
  return post;
}

function withSourceWarnings(post: AdaptedPost, source: SourceContent) {
  const warnings = [...post.warnings];
  if (!source.title.trim()) warnings.push("源标题为空，当前标题来自平台默认模板。");
  if (!source.body.trim()) warnings.push("源正文为空，当前正文仅包含平台默认结构。");
  return {
    ...post,
    warnings: Array.from(new Set(warnings)),
  };
}

const wechatConstraints: PlatformConstraints = {
  titleMax: 64,
  bodyMax: 5000,
  minTags: 2,
  maxTags: 5,
  preferredFormat: "html-like",
};

const zhihuConstraints: PlatformConstraints = {
  titleMax: 80,
  bodyMax: 9000,
  minTags: 2,
  maxTags: 6,
  preferredFormat: "markdown",
};

const bilibiliConstraints: PlatformConstraints = {
  titleMax: 60,
  bodyMax: 2000,
  minTags: 2,
  maxTags: 8,
  preferredFormat: "column",
};

const xiaohongshuConstraints: PlatformConstraints = {
  titleMax: 32,
  bodyMax: 1000,
  minTags: 4,
  maxTags: 10,
  preferredFormat: "short-form",
};

export const platformAdapters: PlatformAdapter[] = [
  {
    id: "wechat",
    label: "微信公众号",
    shortLabel: "公众号",
    description: "保留文章层级，增强导语、摘要和图文阅读感。",
    capabilities: baseCapabilities,
    constraints: wechatConstraints,
    adapt(source) {
      const title = titleCaseFallback(source.title, "一篇待发布的图文内容");
      const summary = createSummary(source.body, 86);
      const tags = mergeTags(source, ["内容运营", "多平台发布"], 5);
      const body = [
        `> 导语：${summary}`,
        "",
        normalizeWhitespace(source.body),
        "",
        "---",
        `适合读者：${source.audience || "内容创作者与运营同学"}`,
        `推荐标签：${formatHashTags(tags)}`,
      ].join("\n");

      return withSourceWarnings(
        createPost("wechat", "微信公众号", wechatConstraints, title, summary, body, tags),
        source,
      );
    },
    validate(post) {
      return validatePost(post, wechatConstraints);
    },
    publish: simulatePublish,
  },
  {
    id: "zhihu",
    label: "知乎",
    shortLabel: "知乎",
    description: "强化问题意识、结论先行和论证结构。",
    capabilities: baseCapabilities,
    constraints: zhihuConstraints,
    adapt(source) {
      const baseTitle = titleCaseFallback(source.title, "这个工具如何提升内容发布效率？");
      const title = baseTitle.endsWith("？") || baseTitle.endsWith("?") ? baseTitle : `${baseTitle}，值得做吗？`;
      const summary = createSummary(source.body, 110);
      const highlights = toBulletHighlights(source.body, 4);
      const tags = mergeTags(source, ["效率工具", "内容创作", "产品设计"], 6);
      const body = [
        `先给结论：${summary}`,
        "",
        "## 核心观点",
        ...highlights.map((item) => `- ${item}`),
        "",
        "## 具体分析",
        normalizeWhitespace(source.body),
        "",
        "## 适用人群",
        source.audience || "需要在多个平台长期发布内容的创作者、运营和技术博主。",
      ].join("\n");

      return withSourceWarnings(
        createPost("zhihu", "知乎", zhihuConstraints, title, summary, body, tags),
        source,
      );
    },
    validate(post) {
      return validatePost(post, zhihuConstraints);
    },
    publish: simulatePublish,
  },
  {
    id: "bilibili",
    label: "B站",
    shortLabel: "B站",
    description: "压缩为动态/专栏说明，突出看点、关键词和互动引导。",
    capabilities: { ...baseCapabilities, video: true },
    constraints: bilibiliConstraints,
    adapt(source) {
      const title = titleCaseFallback(source.title, "多平台内容发布工具实战");
      const summary = createSummary(source.body, 72);
      const highlights = toBulletHighlights(source.body, 3);
      const tags = mergeTags(source, ["创作工具", "效率", "项目实战", "AI"], 8);
      const body = [
        `简介：${summary}`,
        "",
        "本期看点：",
        ...highlights.map((item, index) => `${index + 1}. ${item}`),
        "",
        stripMarkdown(source.body).slice(0, 780),
        "",
        `互动问题：你最希望先适配哪个平台？`,
        formatHashTags(tags),
      ].join("\n");

      return withSourceWarnings(
        createPost("bilibili", "B站", bilibiliConstraints, title, summary, body, tags),
        source,
      );
    },
    validate(post) {
      return validatePost(post, bilibiliConstraints);
    },
    publish: simulatePublish,
  },
  {
    id: "xiaohongshu",
    label: "小红书",
    shortLabel: "小红书",
    description: "转成短句、强钩子、行动清单和高密度话题标签。",
    capabilities: baseCapabilities,
    constraints: xiaohongshuConstraints,
    adapt(source) {
      const rawTitle = titleCaseFallback(source.title, "创作者必备发布工作流");
      const title = rawTitle.length > 28 ? `${rawTitle.slice(0, 27)}…` : rawTitle;
      const summary = createSummary(source.body, 62);
      const highlights = toBulletHighlights(source.body, 4);
      const tags = mergeTags(source, ["创作者工具", "自媒体运营", "效率提升", "内容发布"], 10);
      const body = [
        `${summary}`,
        "",
        "适合你，如果你经常遇到：",
        "1. 同一篇内容要反复复制粘贴",
        "2. 每个平台标题、标签和语气都要重改",
        "3. 发布后不知道哪一步失败",
        "",
        "这套工作流可以这样拆：",
        ...highlights.map((item) => `- ${item}`),
        "",
        "先统一输入，再按平台生成草稿，最后批量模拟发布。",
        "",
        formatHashTags(tags),
      ].join("\n");

      return withSourceWarnings(
        createPost("xiaohongshu", "小红书", xiaohongshuConstraints, title, summary, body, tags),
        source,
      );
    },
    validate(post) {
      return validatePost(post, xiaohongshuConstraints);
    },
    publish: simulatePublish,
  },
];

export const adapterRegistry = Object.fromEntries(
  platformAdapters.map((adapter) => [adapter.id, adapter]),
) as Record<PlatformId, PlatformAdapter>;

export function adaptForPlatform(platformId: PlatformId, source: SourceContent) {
  return adapterRegistry[platformId].adapt(source);
}

export function adaptForPlatforms(platformIds: PlatformId[], source: SourceContent) {
  return platformIds.map((platformId) => adaptForPlatform(platformId, source));
}
