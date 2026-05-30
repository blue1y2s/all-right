import type { SourceContent } from "@/types/content";

export const demoContent: SourceContent = {
  title: "多平台内容发布工具：从一篇稿子到四个平台草稿",
  audience: "需要同步运营公众号、知乎、B站和小红书的内容创作者",
  tone: "practical",
  tags: ["多平台发布", "AI工具", "内容运营"],
  coverUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=1200&auto=format&fit=crop",
  body: `## 为什么需要这个工具

很多创作者会先写一篇完整稿件，然后再分别搬到公众号、知乎、B站、小红书。问题是每个平台的内容风格、标题长度、标签数量和正文结构都不一样，重复排版会消耗大量时间。

## 我们的解决思路

工具把内容发布拆成三个环节：统一输入、平台适配、发布队列。用户只需要维护一份源内容，系统会根据平台规则生成草稿版本，并在发布前展示风险提示。

## 首版能力

- 支持 Markdown 正文输入和封面链接
- 支持公众号、知乎、B站、小红书四个平台预览
- 支持模拟一键发布、发布日志和失败重试
- 预留平台适配器接口，后续可以接浏览器自动化或平台 API

## 可扩展方向

后续可以增加热点选题、AI 改写、多账号模板、真实草稿发布和数据回收，把工具从 Demo 演进为完整内容运营工作台。`,
};

export function generateHotIdeas(topic: string) {
  const cleanTopic = topic.trim() || "AI 内容创作";

  return [
    {
      title: `${cleanTopic} 为什么值得创作者马上尝试？`,
      outline: `## 选题背景\n\n${cleanTopic} 正在影响内容生产效率，创作者最关心的是它能不能真的省时间。\n\n## 核心角度\n\n- 解决重复排版\n- 降低多平台发布成本\n- 保留人工审核与草稿确认\n\n## 行动建议\n\n先从一个平台组合开始验证，再逐步增加账号和发布频率。`,
    },
    {
      title: `用 ${cleanTopic} 做一次 3 天 MVP 实战`,
      outline: `## Day 1\n\n确定用户输入、平台规则和预览界面。\n\n## Day 2\n\n补齐发布队列、状态流转和历史记录。\n\n## Day 3\n\n整理 README、演示脚本和扩展架构。`,
    },
    {
      title: `${cleanTopic} 工具选型：别一开始就做重架构`,
      outline: `## 判断标准\n\n首版应该优先证明工作流，而不是追求全自动真实发布。\n\n## 推荐方案\n\n用规则模板保证稳定交付，用 AI 能力作为增强项，用 adapter 接口预留真实平台接入。`,
    },
  ];
}
