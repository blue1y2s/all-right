import { NextResponse } from "next/server";

function getProvider() {
  if (process.env.AI_PROVIDER) return process.env.AI_PROVIDER;
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY) return "qwen";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.AI_API_KEY) return "openai-compatible";
  return "rules";
}

function getApiKey() {
  return (
    process.env.AI_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.QWEN_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}

export function GET() {
  const provider = getProvider();

  return NextResponse.json({
    enabled: Boolean(getApiKey()),
    provider,
    model: process.env.AI_MODEL ?? null,
  });
}
