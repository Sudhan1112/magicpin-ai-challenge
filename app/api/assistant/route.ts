import { NextRequest, NextResponse } from "next/server";
import { getDemoData } from "@/lib/demo-data";
import { isCommitment, isOffTopic } from "@/lib/classifier";

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input.message !== "string" || !input.message.trim()) {
    return NextResponse.json(
      { reason: "non-empty message is required" },
      { status: 400 }
    );
  }

  const data = getDemoData();
  const merchant = input.merchant_id
    ? data.merchants.find(
        (item: Record<string, any>) => item.merchant_id === input.merchant_id
      )
    : undefined;
  const trigger = merchant
    ? data.triggers.find(
        (item: Record<string, any>) =>
          item.merchant_id === merchant.merchant_id
      )
    : undefined;

  if (isOffTopic(input.message)) {
    return NextResponse.json({
      action: "send",
      body: "That needs a qualified tax or legal adviser. In this demo I can help with merchant profiles, campaigns, customer engagement, and growth signals.",
      cta: "open_ended",
      rationale: "Workspace assistant stayed within the merchant-growth scope."
    });
  }

  if (merchant) {
    const offer = merchant.offers?.find(
      (item: Record<string, any>) => item.status === "active"
    )?.title;
    return NextResponse.json({
      action: "send",
      body: isCommitment(input.message)
        ? `I will prepare a demo draft for ${merchant.identity.name} using ${
            offer || "its latest profile context"
          } and the ${String(trigger?.kind || "growth").replaceAll("_", " ")} signal. Nothing will be published without approval.`
        : `For ${merchant.identity.name}, the seed data shows ${
            merchant.performance.views
          } views and ${merchant.performance.calls} calls. I can turn the ${String(
            trigger?.kind || "growth"
          ).replaceAll("_", " ")} signal into one draft for approval.`,
      cta: "binary_yes_no",
      rationale: "Dashboard response grounded in the selected seed merchant."
    });
  }

  return NextResponse.json({
    action: "send",
    body: `This workspace contains ${data.merchants.length} synthetic merchants, ${data.customers.length} customers, and ${data.triggers.length} triggers. Name a merchant or open Conversations for a grounded merchant-specific workflow.`,
    cta: "open_ended",
    rationale: "Workspace response grounded in bundled seed counts."
  });
}
