import { NextResponse } from "next/server";
import { contextCounts, state } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptime_seconds: Math.floor((Date.now() - state.startedAt) / 1000),
    contexts_loaded: contextCounts()
  });
}
