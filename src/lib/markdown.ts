import type { SourceContent } from "@/types/content";

const punctuationPattern = /[，。！？；：、,.!?;:]/g;

export function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripMarkdown(value: string) {
  return normalizeWhitespace(value)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_`>~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(value: string) {
  const plain = stripMarkdown(value);
  const chineseChars = plain.match(/[\u4e00-\u9fa5]/g)?.length ?? 0;
  const latinWords = plain.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  return chineseChars + latinWords;
}

export function estimateReadingTime(value: string) {
  return Math.max(1, Math.ceil(countWords(value) / 420));
}

export function extractHeadings(value: string) {
  return Array.from(value.matchAll(/^#{1,3}\s+(.+)$/gm)).map((match) =>
    match[1].trim(),
  );
}

export function splitParagraphs(value: string) {
  return normalizeWhitespace(value)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function firstMeaningfulParagraph(value: string) {
  return (
    splitParagraphs(value)
      .map(stripMarkdown)
      .find((paragraph) => paragraph.length > 24) ?? stripMarkdown(value)
  );
}

export function createSummary(value: string, maxLength = 96) {
  const plain = firstMeaningfulParagraph(value).replace(punctuationPattern, " ");
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trim()}…`;
}

export function sanitizeTags(tags: string[], max = 8) {
  const normalized = tags
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, ""));

  return Array.from(new Set(normalized)).slice(0, max);
}

export function mergeTags(source: SourceContent, extras: string[], max = 8) {
  return sanitizeTags([...source.tags, ...extras], max);
}

export function formatHashTags(tags: string[]) {
  return tags.map((tag) => `#${tag}`).join(" ");
}

export function toBulletHighlights(value: string, limit = 4) {
  const headings = extractHeadings(value);
  if (headings.length > 0) return headings.slice(0, limit);

  return splitParagraphs(value)
    .map(stripMarkdown)
    .filter((paragraph) => paragraph.length > 18)
    .slice(0, limit)
    .map((paragraph) => {
      const sentence = paragraph.split(/[。！？.!?]/)[0];
      return sentence.length > 34 ? `${sentence.slice(0, 33)}…` : sentence;
    });
}

export function titleCaseFallback(title: string, fallback: string) {
  const clean = stripMarkdown(title);
  return clean.length > 0 ? clean : fallback;
}
