export type PlatformId = "wechat" | "zhihu" | "bilibili" | "xiaohongshu";

export type PublishStatus = "pending" | "running" | "success" | "failed";

export type ContentTone =
  | "professional"
  | "friendly"
  | "practical"
  | "story";

export interface SourceContent {
  title: string;
  body: string;
  tags: string[];
  coverUrl?: string;
  tone: ContentTone;
  audience: string;
}

export interface PlatformConstraints {
  titleMax: number;
  bodyMax: number;
  minTags: number;
  maxTags: number;
  preferredFormat: "html-like" | "markdown" | "short-form" | "column";
}

export interface PlatformCapabilities {
  article: boolean;
  images: boolean;
  video: boolean;
  draftFirst: boolean;
  scheduledPublish: boolean;
  simulatedPublish: boolean;
}

export interface AdaptedPost {
  platformId: PlatformId;
  platformLabel: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  wordCount: number;
  readingTimeMinutes: number;
  warnings: string[];
}

export interface PublishResult {
  id: string;
  platformId: PlatformId;
  platformLabel: string;
  title: string;
  status: PublishStatus;
  simulatedUrl?: string;
  durationMs?: number;
  error?: string;
  logs: string[];
  createdAt: string;
}

export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  shortLabel: string;
  description: string;
  capabilities: PlatformCapabilities;
  constraints: PlatformConstraints;
  adapt: (source: SourceContent) => AdaptedPost;
  validate: (post: AdaptedPost) => string[];
  publish: (post: AdaptedPost) => Promise<PublishResult>;
}
