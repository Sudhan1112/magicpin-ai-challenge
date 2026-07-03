import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    team_name: process.env.VERA_TEAM_NAME || "Vera Merchant OS",
    team_members: (process.env.VERA_TEAM_MEMBERS || "Sudhanshu Kumar")
      .split(",")
      .map((member) => member.trim())
      .filter(Boolean),
    model: process.env.OPENAI_API_KEY
      ? `Hybrid ${process.env.OPENAI_MODEL || "gpt-5.4-mini"} with deterministic fallback`
      : "Deterministic grounded composer (OpenAI fallback not configured)",
    approach:
      "Versioned four-context router with trigger ranking, consent validation, grounded hybrid composition, multi-turn state and deterministic safety fallback",
    contact_email: process.env.VERA_CONTACT_EMAIL || "",
    version: process.env.VERA_VERSION || "2.0.0",
    submitted_at:
      process.env.VERA_SUBMITTED_AT || "2026-07-03T00:00:00.000Z"
  });
}
