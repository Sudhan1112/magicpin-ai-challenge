export type Scope = "category" | "merchant" | "customer" | "trigger";

export type ContextEnvelope = {
  scope: Scope;
  context_id: string;
  version: number;
  payload: Record<string, any>;
  delivered_at: string;
};

export type CTA =
  | "binary_yes_no"
  | "binary_confirm_cancel"
  | "open_ended"
  | "none";

export type Action = {
  conversation_id: string;
  merchant_id: string;
  customer_id: string | null;
  send_as: "vera" | "merchant_on_behalf";
  trigger_id: string;
  template_name: string;
  template_params: string[];
  body: string;
  cta: CTA;
  suppression_key: string;
  rationale: string;
};

export type Turn = {
  from: "vera" | "merchant" | "customer";
  body: string;
  at: string;
};

export type ConversationPhase =
  | "initiated"
  | "waiting"
  | "executing"
  | "awaiting_approval"
  | "ended";

export type ConversationIntent =
  | "unknown"
  | "commitment"
  | "question"
  | "objection"
  | "deferral"
  | "opt_out"
  | "auto_reply"
  | "hostile"
  | "off_topic";

export type ConversationLanguage = "en" | "hi" | "hinglish";

export type ConversationRecord = {
  conversationId: string;
  merchantId: string;
  customerId: string | null;
  categorySlug: string;
  triggerId: string;
  triggerKind: string;
  suppressionKey: string;
  phase: ConversationPhase;
  lastCta: CTA;
  lastOutbound: string;
  intent: ConversationIntent;
  language: ConversationLanguage;
  autoReplyCount: number;
  lastInboundNormalized: string;
  exactRepeatCount: number;
  contextVersions: Partial<Record<Scope, number>>;
  turns: Turn[];
  createdAt: string;
  updatedAt: string;
};

export type ReplyResult =
  | { action: "send"; body: string; cta: CTA; rationale: string }
  | { action: "wait"; wait_seconds: number; rationale: string }
  | { action: "end"; rationale: string };

export type GroundingBundle = {
  category: Record<string, any>;
  merchant: Record<string, any>;
  trigger: Record<string, any>;
  customer?: Record<string, any>;
  conversation?: ConversationRecord;
};
