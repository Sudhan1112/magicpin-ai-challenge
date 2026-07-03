import { NextResponse } from "next/server";
import { getDemoData } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getDemoData());
}
