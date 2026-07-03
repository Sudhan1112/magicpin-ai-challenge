import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  classifyIntent,
  detectLanguage
} from "@/lib/classifier";
import {
  composeContextualReply,
  composeExecutionReply
} from "@/lib/composer";
import { refineReply } from "@/lib/hybrid-composer";
import {
  appendTurn,
  getConversation,
  getStoredContext,
  state
} from "@/lib/store";
import type {
  ConversationRecord,
  GroundingBundle,
  ReplyResult,
  Turn
} from "@/lib/types";

const bodyHash = (body: string) =>
  createHash("sha256").update(body.toLowerCase().trim()).digest("hex");

function latestBundle(conversation: ConversationRecord): GroundingBundle | null {
  const category = getStoredContext(
    "category",
    conversation.categorySlug
  );
  const merchant = getStoredContext("merchant", conversation.merchantId);
  const trigger = getStoredContext("trigger", conversation.triggerId);
  const customer = conversation.customerId
    ? getStoredContext("customer", conversation.customerId)
    : undefined;

  if (!category || !merchant || !trigger) return null;
  conversation.contextVersions = {
    category: category.version,
    merchant: merchant.version,
    trigger: trigger.version,
    ...(customer ? { customer: customer.version } : {})
  };
  return {
    category: category.payload,
    merchant: merchant.payload,
    trigger: trigger.payload,
    customer: customer?.payload,
    conversation
  };
}

function addOutbound(
  conversation: ConversationRecord,
  result: ReplyResult,
  at: string
) {
  if (result.action === "send") {
    const turn: Turn = { from: "vera", body: result.body, at };
    appendTurn(conversation, turn);
    conversation.lastOutbound = result.body;
    conversation.lastCta = result.cta;
    state.outboundFingerprints.add(bodyHash(result.body));
  }
  state.conversations.set(conversation.conversationId, conversation);
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => null);
  if (
    !input?.conversation_id ||
    typeof input.message !== "string" ||
    !input.message.trim()
  ) {
    return NextResponse.json(
      { reason: "conversation_id and non-empty message are required" },
      { status: 400 }
    );
  }

  const conversation = getConversation(input.conversation_id);
  if (!conversation) {
    return NextResponse.json(
      { reason: "unknown_conversation", details: "Start conversations through /v1/tick." },
      { status: 404 }
    );
  }
  if (conversation.phase === "ended") {
    return NextResponse.json(
      { action: "end", rationale: "Conversation is already closed." }
    );
  }
  if (
    input.merchant_id &&
    input.merchant_id !== conversation.merchantId
  ) {
    return NextResponse.json(
      { reason: "merchant_id does not match conversation" },
      { status: 409 }
    );
  }
  if (
    input.customer_id &&
    input.customer_id !== conversation.customerId
  ) {
    return NextResponse.json(
      { reason: "customer_id does not match conversation" },
      { status: 409 }
    );
  }

  const bundle = latestBundle(conversation);
  if (!bundle) {
    return NextResponse.json(
      { reason: "conversation_context_unavailable" },
      { status: 409 }
    );
  }

  const receivedAt = input.received_at || new Date().toISOString();
  const role = input.from_role === "customer" ? "customer" : "merchant";
  appendTurn(conversation, {
    from: role,
    body: input.message.trim(),
    at: receivedAt
  });

  const classification = classifyIntent(input.message, conversation);
  conversation.intent = classification.intent;
  conversation.language = detectLanguage(
    input.message,
    bundle.merchant,
    bundle.customer
  );
  if (classification.repeated) {
    conversation.exactRepeatCount += 1;
  } else {
    conversation.exactRepeatCount = 0;
  }
  conversation.lastInboundNormalized = classification.normalized;

  if (classification.intent === "opt_out") {
    conversation.phase = "ended";
    if (role === "customer" && conversation.customerId) {
      state.optedOutCustomers.add(conversation.customerId);
    } else {
      state.optedOutMerchants.add(conversation.merchantId);
    }
    state.conversations.set(conversation.conversationId, conversation);
    return NextResponse.json({
      action: "end",
      rationale:
        "Explicit opt-out detected; outreach suppressed and conversation closed."
    });
  }

  if (classification.intent === "auto_reply") {
    conversation.autoReplyCount += 1;
    if (conversation.autoReplyCount >= 2 || conversation.exactRepeatCount >= 2) {
      conversation.phase = "ended";
      state.conversations.set(conversation.conversationId, conversation);
      return NextResponse.json({
        action: "end",
        rationale:
          "Repeated canned or identical reply detected; closing without wasting another turn."
      });
    }
    conversation.phase = "waiting";
    state.conversations.set(conversation.conversationId, conversation);
    return NextResponse.json({
      action: "wait",
      wait_seconds: 14_400,
      rationale:
        "Likely WhatsApp Business auto-reply detected; waiting once for the owner."
    });
  }

  if (classification.intent === "hostile") {
    conversation.phase = "ended";
    state.conversations.set(conversation.conversationId, conversation);
    return NextResponse.json({
      action: "end",
      rationale:
        "Hostility detected; ending politely without escalating or continuing outreach."
    });
  }

  if (classification.intent === "off_topic") {
    const result: ReplyResult = {
      action: "send",
      body:
        conversation.language === "en"
          ? "That needs a qualified tax or legal adviser, so I will not guess. I can still help with your merchant profile, campaigns, customer engagement, or growth performance."
          : "Iske liye qualified tax ya legal adviser chahiye, isliye main guess nahi karungi. Main merchant profile, campaigns, customer engagement ya growth performance mein help kar sakti hoon.",
      cta: "open_ended",
      rationale:
        "Out-of-scope request declined while preserving the merchant-growth mission."
    };
    addOutbound(conversation, result, new Date().toISOString());
    return NextResponse.json(result);
  }

  if (classification.intent === "deferral") {
    conversation.phase = "waiting";
    state.conversations.set(conversation.conversationId, conversation);
    return NextResponse.json({
      action: "wait",
      wait_seconds: /\b(tomorrow|kal)\b/i.test(input.message)
        ? 86_400
        : 14_400,
      rationale: "Merchant requested time; backing off without another nudge."
    });
  }

  let fallback: ReplyResult;
  if (classification.intent === "commitment") {
    if (conversation.phase === "awaiting_approval") {
      fallback = {
        action: "send",
        body:
          conversation.language === "en"
            ? "Approval recorded. The draft is ready for the merchant workflow; no external publishing is claimed or performed by this challenge bot."
            : "Approval record ho gaya. Draft merchant workflow ke liye ready hai; challenge bot ne koi external publishing claim ya perform nahi kiya.",
        cta: "none",
        rationale:
          "Second confirmation recorded without pretending an external platform action occurred."
      };
      conversation.phase = "executing";
    } else {
      fallback = composeExecutionReply(bundle, conversation.language);
      conversation.phase = "awaiting_approval";
    }
  } else {
    fallback = composeContextualReply(
      bundle,
      conversation.language,
      classification.intent
    );
    conversation.phase = "initiated";
  }

  const result = await refineReply(bundle, fallback);
  addOutbound(conversation, result, new Date().toISOString());
  return NextResponse.json(result);
}
