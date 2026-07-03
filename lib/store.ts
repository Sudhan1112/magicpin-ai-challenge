import type {
  ContextEnvelope,
  ConversationRecord,
  Scope,
  Turn
} from "./types";

export type StoredContext = {
  version: number;
  deliveredAt: string;
  payload: Record<string, any>;
};

type VeraState = {
  startedAt: number;
  contexts: Map<string, StoredContext>;
  conversations: Map<string, ConversationRecord>;
  suppressionKeys: Set<string>;
  sentTriggers: Set<string>;
  outboundFingerprints: Set<string>;
  optedOutMerchants: Set<string>;
  optedOutCustomers: Set<string>;
  merchantOutboundAt: Map<string, number[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __veraStateV2: VeraState | undefined;
}

export const state: VeraState =
  globalThis.__veraStateV2 ??
  (globalThis.__veraStateV2 = {
    startedAt: Date.now(),
    contexts: new Map(),
    conversations: new Map(),
    suppressionKeys: new Set(),
    sentTriggers: new Set(),
    outboundFingerprints: new Set(),
    optedOutMerchants: new Set(),
    optedOutCustomers: new Set(),
    merchantOutboundAt: new Map()
  });

const key = (scope: Scope, id: string) => `${scope}:${id}`;

export type PutContextResult =
  | { accepted: true; noop: boolean; currentVersion: number }
  | { accepted: false; noop: false; currentVersion: number };

export function putContext(input: ContextEnvelope): PutContextResult {
  const contextKey = key(input.scope, input.context_id);
  const current = state.contexts.get(contextKey);

  if (current?.version === input.version) {
    return { accepted: true, noop: true, currentVersion: current.version };
  }
  if (current && current.version > input.version) {
    return { accepted: false, noop: false, currentVersion: current.version };
  }

  state.contexts.set(contextKey, {
    version: input.version,
    deliveredAt: input.delivered_at,
    payload: input.payload
  });
  return { accepted: true, noop: false, currentVersion: input.version };
}

export function getStoredContext(scope: Scope, id?: string | null) {
  if (!id) return undefined;
  return state.contexts.get(key(scope, id));
}

export function getContext(scope: Scope, id?: string | null) {
  return getStoredContext(scope, id)?.payload;
}

export function contextCounts() {
  const counts: Record<Scope, number> = {
    category: 0,
    merchant: 0,
    customer: 0,
    trigger: 0
  };
  for (const contextKey of state.contexts.keys()) {
    const scope = contextKey.split(":")[0] as Scope;
    counts[scope] += 1;
  }
  return counts;
}

export function createConversation(record: ConversationRecord) {
  state.conversations.set(record.conversationId, record);
  return record;
}

export function getConversation(conversationId: string) {
  return state.conversations.get(conversationId);
}

export function appendTurn(conversation: ConversationRecord, turn: Turn) {
  conversation.turns.push(turn);
  conversation.updatedAt = turn.at;
  state.conversations.set(conversation.conversationId, conversation);
}

export function recordOutbound(merchantId: string, at: string) {
  const timestamp = Date.parse(at);
  if (!Number.isFinite(timestamp)) return;
  const history = state.merchantOutboundAt.get(merchantId) || [];
  history.push(timestamp);
  state.merchantOutboundAt.set(
    merchantId,
    history.filter((value) => value >= timestamp - 7 * 86_400_000)
  );
}

export function recentOutboundCount(
  merchantId: string,
  now: string,
  windowMs = 86_400_000
) {
  const timestamp = Date.parse(now);
  if (!Number.isFinite(timestamp)) return 0;
  return (state.merchantOutboundAt.get(merchantId) || []).filter(
    (value) => value >= timestamp - windowMs && value <= timestamp
  ).length;
}

export function clearState() {
  state.contexts.clear();
  state.conversations.clear();
  state.suppressionKeys.clear();
  state.sentTriggers.clear();
  state.outboundFingerprints.clear();
  state.optedOutMerchants.clear();
  state.optedOutCustomers.clear();
  state.merchantOutboundAt.clear();
}
