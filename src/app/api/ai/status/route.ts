import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    enabled: Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
    provider: process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.OPENAI_API_KEY ? "openai" : "rules",
  });
}
