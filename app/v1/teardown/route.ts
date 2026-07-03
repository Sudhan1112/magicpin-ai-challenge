import { NextResponse } from "next/server";
import { clearState } from "@/lib/store";

export async function POST() {
  clearState();
  return NextResponse.json({ cleared: true, at: new Date().toISOString() });
}
