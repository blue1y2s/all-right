import { NextResponse } from "next/server";
import type { SourceContent } from "@/types/content";

interface EnhanceRequest {
  source: SourceContent;
}

type EnhancedPayload = Partial<SourceContent> & {
  source?: Partial<SourceContent>;
};

const providerDefaults = {
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4.1-mini",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  "openai-compatible": {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
} as const;

type Provider = keyof typeof providerDefaults;

function getProvider(): Provider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider && provider in providerDefaults) return provider as Provider;
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY) return "qwen";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "openai-compatible";
}

function getApiKey(provider: Provider) {
  return (
    process.env.AI_API_KEY ||
    (provider === "deepseek" ? process.env.DEEPSEEK_API_KEY : undefined) ||
    (provider === "qwen"
      ? process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY
      : undefined) ||
    (provider === "openrouter" ? process.env.OPENROUTER_API_KEY : undefined) ||
    (provider === "openai" ? process.env.OPENAI_API_KEY : undefined)
  );
}

function createChatCompletionsEndpoint(baseUrl: string) {
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  if (cleanBaseUrl.endsWith("/chat/completions")) return cleanBaseUrl;
  return `${cleanBaseUrl}/chat/completions`;
}

function createSafeErrorMessage(status: number, provider: Provider) {
  if (status === 401 || status === 403) {
    return `${provider} 认证失败，请检查 .env.local 中的 API Key、provider 和 base URL。`;
  }
  if (status === 404) {
    return `${provider} 接口或模型不存在，请检查 AI_BASE_URL 和 AI_MODEL。`;
  }
  if (status === 429) {
    return `${provider} 触发限流或余额不足，请稍后重试或检查账户额度。`;
  }
  return `${provider} 服务暂时不可用，HTTP ${status}。`;
}

function extractJson(value: string) {
  const match = value.match(/\{[\s\S]*}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as EnhancedPayload;
  } catch {
    return null;
  }
}

function normalizeEnhancedPayload(payload: EnhancedPayload | null) {
  if (!payload) return null;
  const candidate = payload.source && typeof payload.source === "object" ? payload.source : payload;
  const hasContent =
    typeof candidate.title === "string" ||
    typeof candidate.body === "string" ||
    Array.isArray(candidate.tags);

  return hasContent ? candidate : null;
}

export async function POST(request: Request) {
  const provider = getProvider();
  const apiKey = getApiKey(provider);

  if (!apiKey) {
    return NextResponse.json(
      {
        enabled: false,
        message: "未配置 AI Key，当前使用本地规则模板。",
      },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as EnhanceRequest;
  const source = payload.source;
  const defaults = providerDefaults[provider];
  const endpoint = createChatCompletionsEndpoint(
    process.env.AI_BASE_URL || defaults.baseUrl,
  );
  const model = process.env.AI_MODEL || defaults.model;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(provider === "openrouter"
        ? {
            "HTTP-Referer": "https://github.com/blue1y2s/all-right",
            "X-Title": "All Right",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "你是资深内容运营编辑，负责把普通草稿改成适合公众号、知乎、B站、小红书二次分发的发布稿。必须重写，不要原样返回；title 必须不同于原标题，正文要更有钩子、更清晰、更适合多平台传播。只返回 JSON，不要 Markdown 代码块，不要解释。字段为 title, body, tags, audience, tone。tone 只能是 practical、professional、friendly、story 之一。保持中文。",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "请做风格改写和发布增强",
            source,
            requirements: [
              "标题更像内容平台标题，但不要夸张标题党",
              "正文保留 Markdown，小标题重组，增加清晰行动点",
              "标签补到 4-6 个，适合内容运营/效率工具方向",
              "目标读者可以更具体",
            ],
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    await response.text();

    return NextResponse.json(
      {
        enabled: true,
        provider,
        model,
        message: `AI 服务暂时不可用，已保留本地规则模板。${createSafeErrorMessage(response.status, provider)}`,
      },
      { status: 502 },
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const enhanced = normalizeEnhancedPayload(extractJson(content));

  if (!enhanced) {
    return NextResponse.json(
      {
        enabled: true,
        provider,
        model,
        message: "AI 返回格式无法解析，已保留原内容。",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    enabled: true,
    provider,
    model,
    source: {
      ...source,
      ...enhanced,
      tags: Array.isArray(enhanced.tags) ? enhanced.tags : source.tags,
      tone: enhanced.tone ?? source.tone,
    },
  });
}
