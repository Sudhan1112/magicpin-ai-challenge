import { NextRequest, NextResponse } from "next/server";
import { putContext } from "@/lib/store";
import type { ContextEnvelope, Scope } from "@/lib/types";

const scopes = new Set<Scope>(["category", "merchant", "customer", "trigger"]);

export async function POST(request: NextRequest) {
  let input: ContextEnvelope;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ accepted: false, reason: "malformed_json" }, { status: 400 });
  }

  if (!input || !scopes.has(input.scope) || !input.context_id || !Number.isInteger(input.version) || !input.payload) {
    return NextResponse.json(
      { accepted: false, reason: "invalid_scope_or_payload", details: "scope, context_id, integer version and payload are required" },
      { status: 400 }
    );
  }

  const result = putContext(input);
  if (!result.accepted) {
    return NextResponse.json(
      { accepted: false, reason: "stale_version", current_version: result.currentVersion },
      { status: 409 }
    );
  }

  return NextResponse.json({
    accepted: true,
    noop: result.noop,
    ack_id: `ack_${input.context_id}_v${input.version}`,
    stored_at: new Date().toISOString()
  });
}
