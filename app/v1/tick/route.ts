import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { customerConsentAllows } from "@/lib/consent";
import { composeHybridAction } from "@/lib/hybrid-composer";
import { scoreTrigger } from "@/lib/ranking";
import {
  createConversation,
  getStoredContext,
  recordOutbound,
  state
} from "@/lib/store";
import type { Action, ConversationRecord } from "@/lib/types";

type Candidate = {
  triggerId: string;
  trigger: Record<string, any>;
  merchant: Record<string, any>;
  category: Record<string, any>;
  customer?: Record<string, any>;
  triggerVersion: number;
  merchantVersion: number;
  categoryVersion: number;
  customerVersion?: number;
  score: number;
};

const hashBody = (body: string) =>
  createHash("sha256").update(body.toLowerCase().trim()).digest("hex");

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => null);
  if (
    !input ||
    !Array.isArray(input.available_triggers) ||
    !Number.isFinite(Date.parse(input.now))
  ) {
    return NextResponse.json(
      { reason: "valid now and available_triggers array are required" },
      { status: 400 }
    );
  }

  const candidates: Candidate[] = [];
  const seenMerchants = new Set<string>();

  for (const triggerId of input.available_triggers.slice(0, 500)) {
    if (typeof triggerId !== "string" || state.sentTriggers.has(triggerId)) {
      continue;
    }

    const storedTrigger = getStoredContext("trigger", triggerId);
    const trigger = storedTrigger?.payload;
    if (!trigger?.merchant_id || !trigger?.id || trigger.id !== triggerId) {
      continue;
    }
    if (
      state.suppressionKeys.has(trigger.suppression_key) ||
      state.optedOutMerchants.has(trigger.merchant_id) ||
      (trigger.customer_id &&
        state.optedOutCustomers.has(trigger.customer_id))
    ) {
      continue;
    }

    const storedMerchant = getStoredContext("merchant", trigger.merchant_id);
    const merchant = storedMerchant?.payload;
    const storedCategory = getStoredContext(
      "category",
      merchant?.category_slug
    );
    const category = storedCategory?.payload;
    if (!merchant || !category) continue;

    const storedCustomer = trigger.customer_id
      ? getStoredContext("customer", trigger.customer_id)
      : undefined;
    const customer = storedCustomer?.payload;
    if (!customerConsentAllows(trigger, customer)) continue;

    if (trigger.expires_at) {
      const expiresAt = Date.parse(trigger.expires_at);
      if (!Number.isFinite(expiresAt) || expiresAt < Date.parse(input.now)) {
        continue;
      }
    }

    candidates.push({
      triggerId,
      trigger,
      merchant,
      category,
      customer,
      triggerVersion: storedTrigger!.version,
      merchantVersion: storedMerchant!.version,
      categoryVersion: storedCategory!.version,
      customerVersion: storedCustomer?.version,
      score: scoreTrigger(
        trigger,
        merchant,
        storedTrigger!.deliveredAt,
        input.now
      )
    });
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.triggerId.localeCompare(right.triggerId)
  );

  const maxActions = Math.max(
    1,
    Math.min(20, Number(process.env.VERA_MAX_ACTIONS_PER_TICK) || 5)
  );
  const selected = candidates.filter((candidate) => {
    if (seenMerchants.has(candidate.trigger.merchant_id)) return false;
    seenMerchants.add(candidate.trigger.merchant_id);
    return true;
  }).slice(0, maxActions);

  const composed = await Promise.all(
    selected.map(async (candidate) => ({
      candidate,
      action: await composeHybridAction({
        category: candidate.category,
        merchant: candidate.merchant,
        trigger: candidate.trigger,
        customer: candidate.customer
      })
    }))
  );

  const actions: Action[] = [];
  for (const { candidate, action } of composed) {
    const fingerprint = `${action.merchant_id}:${action.trigger_id}:${action.cta}`;
    const bodyFingerprint = hashBody(action.body);
    if (
      state.outboundFingerprints.has(fingerprint) ||
      state.outboundFingerprints.has(bodyFingerprint)
    ) {
      continue;
    }

    const now = input.now;
    const conversation: ConversationRecord = {
      conversationId: action.conversation_id,
      merchantId: action.merchant_id,
      customerId: action.customer_id,
      categorySlug: candidate.merchant.category_slug,
      triggerId: action.trigger_id,
      triggerKind: candidate.trigger.kind,
      suppressionKey: action.suppression_key,
      phase: "initiated",
      lastCta: action.cta,
      lastOutbound: action.body,
      intent: "unknown",
      language: candidate.customer?.identity?.language_pref?.includes("mix")
        ? "hinglish"
        : candidate.customer?.identity?.language_pref === "hi"
          ? "hi"
          : "en",
      autoReplyCount: 0,
      lastInboundNormalized: "",
      exactRepeatCount: 0,
      contextVersions: {
        category: candidate.categoryVersion,
        merchant: candidate.merchantVersion,
        trigger: candidate.triggerVersion,
        ...(candidate.customerVersion
          ? { customer: candidate.customerVersion }
          : {})
      },
      turns: [
        {
          from: action.send_as === "vera" ? "vera" : "merchant",
          body: action.body,
          at: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    createConversation(conversation);
    state.sentTriggers.add(candidate.triggerId);
    state.suppressionKeys.add(action.suppression_key);
    state.outboundFingerprints.add(fingerprint);
    state.outboundFingerprints.add(bodyFingerprint);
    recordOutbound(action.merchant_id, now);
    actions.push(action);
  }

  return NextResponse.json({ actions });
}
