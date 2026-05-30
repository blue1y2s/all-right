import { NextResponse } from "next/server";
import type { SourceContent } from "@/types/content";

interface EnhanceRequest {
  source: SourceContent;
}

function extractJson(value: string) {
  const match = value.match(/\{[\s\S]*}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as Partial<SourceContent>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

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
  const isOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const endpoint = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model =
    process.env.AI_MODEL ||
    (isOpenRouter ? "openai/gpt-4.1-mini" : "gpt-4.1-mini");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isOpenRouter
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
            "你是内容运营编辑。只返回 JSON，不要 Markdown，不要解释。字段为 title, body, tags, audience, tone。保持中文，适合多平台发布。",
        },
        {
          role: "user",
          content: JSON.stringify(source),
        },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        enabled: true,
        message: "AI 服务暂时不可用，已保留本地规则模板。",
      },
      { status: 502 },
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  const enhanced = extractJson(content);

  if (!enhanced) {
    return NextResponse.json(
      {
        enabled: true,
        message: "AI 返回格式无法解析，已保留原内容。",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    enabled: true,
    source: {
      ...source,
      ...enhanced,
      tags: Array.isArray(enhanced.tags) ? enhanced.tags : source.tags,
      tone: enhanced.tone ?? source.tone,
    },
  });
}
