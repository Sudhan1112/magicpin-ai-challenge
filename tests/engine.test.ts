import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { classifyIntent, detectLanguage } from "@/lib/classifier";
import { customerConsentAllows } from "@/lib/consent";
import {
  composeHybridAction,
  validateRefinement,
  type ModelRefinement
} from "@/lib/hybrid-composer";
import {
  clearState,
  getConversation,
  putContext,
  state
} from "@/lib/store";
import type { ContextEnvelope, GroundingBundle } from "@/lib/types";
import { POST as tick } from "@/app/v1/tick/route";
import { POST as reply } from "@/app/v1/reply/route";

const category = {
  slug: "dentists",
  voice: { tone: "peer_clinical", taboos: ["guaranteed cure"] },
  digest: []
};

const merchant = {
  merchant_id: "m_1",
  category_slug: "dentists",
  identity: {
    name: "Asha Dental",
    owner_first_name: "Asha",
    languages: ["en", "hi"]
  },
  subscription: { status: "active" },
  performance: {
    views: 100,
    calls: 5,
    directions: 9,
    delta_7d: { views_pct: -0.2 }
  },
  offers: [{ id: "o_1", title: "Cleaning @ ₹299", status: "active" }],
  signals: ["engaged_in_last_48h"],
  conversation_history: []
};

const trigger = {
  id: "trg_1",
  scope: "merchant",
  kind: "perf_dip",
  source: "internal",
  merchant_id: "m_1",
  customer_id: null,
  payload: { metric: "views", delta_pct: -0.2, window: "7 days" },
  urgency: 4,
  suppression_key: "perf:m_1:views",
  expires_at: "2027-01-01T00:00:00Z"
};

function envelope(
  scope: ContextEnvelope["scope"],
  context_id: string,
  payload: Record<string, any>,
  version = 1
): ContextEnvelope {
  return {
    scope,
    context_id,
    version,
    payload,
    delivered_at: "2026-07-03T09:00:00Z"
  };
}

function request(url: string, body: Record<string, any>) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function loadBase(
  customMerchant: Record<string, any> = merchant,
  customTrigger: Record<string, any> = trigger
) {
  putContext(envelope("category", "dentists", category));
  putContext(envelope("merchant", "m_1", customMerchant));
  putContext(envelope("trigger", customTrigger.id, customTrigger));
}

beforeEach(() => {
  clearState();
  delete process.env.OPENAI_API_KEY;
  process.env.VERA_MAX_ACTIONS_PER_TICK = "5";
});

describe("versioned context state", () => {
  it("accepts equal versions as idempotent no-ops and rejects lower versions", () => {
    expect(putContext(envelope("merchant", "m_1", merchant, 2))).toEqual({
      accepted: true,
      noop: false,
      currentVersion: 2
    });
    expect(putContext(envelope("merchant", "m_1", { changed: true }, 2))).toEqual({
      accepted: true,
      noop: true,
      currentVersion: 2
    });
    expect(putContext(envelope("merchant", "m_1", merchant, 1))).toEqual({
      accepted: false,
      noop: false,
      currentVersion: 2
    });
  });
});

describe("classification and consent", () => {
  it("recognizes commitment, canned replies, repetition and Hinglish", () => {
    expect(classifyIntent("haan, kar do").intent).toBe("commitment");
    expect(
      classifyIntent("Thank you for contacting us, we will respond shortly")
        .intent
    ).toBe("auto_reply");
    expect(
      classifyIntent("same response", {
        lastInboundNormalized: "same response"
      } as any)
    ).toMatchObject({ intent: "auto_reply", repeated: true });
    expect(detectLanguage("haan aap kar do", merchant)).toBe("hinglish");
  });

  it("fails customer outreach closed unless the matching consent scope exists", () => {
    const customer = {
      customer_id: "c_1",
      merchant_id: "m_1",
      consent: {
        opted_in_at: "2026-01-01",
        scope: ["recall_reminders"]
      },
      preferences: { reminder_opt_in: true }
    };
    expect(
      customerConsentAllows(
        {
          ...trigger,
          scope: "customer",
          kind: "recall_due",
          customer_id: "c_1"
        },
        customer
      )
    ).toBe(true);
    expect(
      customerConsentAllows(
        {
          ...trigger,
          scope: "customer",
          kind: "chronic_refill_due",
          customer_id: "c_1"
        },
        customer
      )
    ).toBe(false);
  });
});

describe("grounding validation", () => {
  const bundle: GroundingBundle = { category, merchant, trigger };
  const fallback: ModelRefinement = {
    body: "Dr. Asha, views are down 20% over 7 days. Want a recovery draft?",
    cta: "binary_yes_no",
    rationale: "Uses the supplied performance trigger."
  };

  it("accepts grounded refinements and rejects invented numbers or CTA changes", () => {
    expect(
      validateRefinement(
        {
          body: "Dr. Asha, views are down 20% over 7 days. Want the recovery draft?",
          cta: "binary_yes_no",
          rationale: "Uses the supplied performance trigger."
        },
        fallback,
        bundle
      )
    ).not.toBeNull();
    expect(
      validateRefinement(
        {
          body: "Dr. Asha, views are down 73%. Want the recovery draft?",
          cta: "binary_yes_no",
          rationale: "Invented unsupported performance."
        },
        fallback,
        bundle
      )
    ).toBeNull();
    expect(
      validateRefinement(
        { ...fallback, cta: "open_ended" },
        fallback,
        bundle
      )
    ).toBeNull();
  });

  it("falls back deterministically when a model provider fails", async () => {
    const action = await composeHybridAction(bundle, {
      async refine() {
        throw new Error("provider unavailable");
      }
    });
    expect(action.body).toContain("20%");
    expect(action.cta).toBe("binary_yes_no");
  });
});

describe("tick and multi-turn reply lifecycle", () => {
  it("ranks triggers, sends only one per merchant, and suppresses duplicates", async () => {
    loadBase();
    const second = {
      ...trigger,
      id: "trg_2",
      kind: "curious_ask_due",
      urgency: 1,
      suppression_key: "curious:m_1"
    };
    putContext(envelope("trigger", "trg_2", second));

    const firstResponse = await tick(
      request("/v1/tick", {
        now: "2026-07-03T10:00:00Z",
        available_triggers: ["trg_2", "trg_1"]
      })
    );
    const first = await firstResponse.json();
    expect(first.actions).toHaveLength(1);
    expect(first.actions[0].trigger_id).toBe("trg_1");

    const repeatedResponse = await tick(
      request("/v1/tick", {
        now: "2026-07-03T10:05:00Z",
        available_triggers: ["trg_1"]
      })
    );
    expect((await repeatedResponse.json()).actions).toHaveLength(0);
  });

  it("uses the latest merchant version when commitment arrives", async () => {
    loadBase();
    const tickResponse = await tick(
      request("/v1/tick", {
        now: "2026-07-03T10:00:00Z",
        available_triggers: ["trg_1"]
      })
    );
    const action = (await tickResponse.json()).actions[0];

    putContext(
      envelope(
        "merchant",
        "m_1",
        {
          ...merchant,
          offers: [
            {
              id: "o_2",
              title: "Updated Cleaning @ ₹499",
              status: "active"
            }
          ]
        },
        2
      )
    );

    const response = await reply(
      request("/v1/reply", {
        conversation_id: action.conversation_id,
        merchant_id: "m_1",
        from_role: "merchant",
        message: "yes, go ahead",
        received_at: "2026-07-03T10:01:00Z"
      })
    );
    const result = await response.json();
    expect(result.action).toBe("send");
    expect(result.body).toContain("Updated Cleaning @ ₹499");
    expect(getConversation(action.conversation_id)?.contextVersions.merchant).toBe(
      2
    );
  });

  it("waits once for a canned reply and ends on the second", async () => {
    loadBase();
    const tickResponse = await tick(
      request("/v1/tick", {
        now: "2026-07-03T10:00:00Z",
        available_triggers: ["trg_1"]
      })
    );
    const action = (await tickResponse.json()).actions[0];
    const payload = {
      conversation_id: action.conversation_id,
      merchant_id: "m_1",
      from_role: "merchant",
      message: "Thank you for contacting us. We will respond shortly.",
      received_at: "2026-07-03T10:01:00Z"
    };

    const first = await reply(request("/v1/reply", payload));
    expect((await first.json()).action).toBe("wait");
    const second = await reply(
      request("/v1/reply", {
        ...payload,
        received_at: "2026-07-03T10:02:00Z"
      })
    );
    expect((await second.json()).action).toBe("end");
  });

  it("rejects unknown conversations", async () => {
    const response = await reply(
      request("/v1/reply", {
        conversation_id: "missing",
        message: "hello"
      })
    );
    expect(response.status).toBe(404);
  });

  it("skips expired and non-consented customer triggers", async () => {
    const expired = { ...trigger, expires_at: "2026-01-01T00:00:00Z" };
    loadBase(merchant, expired);
    const expiredResponse = await tick(
      request("/v1/tick", {
        now: "2026-07-03T10:00:00Z",
        available_triggers: ["trg_1"]
      })
    );
    expect((await expiredResponse.json()).actions).toHaveLength(0);

    clearState();
    const customerTrigger = {
      ...trigger,
      scope: "customer",
      kind: "recall_due",
      customer_id: "c_1"
    };
    loadBase(merchant, customerTrigger);
    putContext(
      envelope("customer", "c_1", {
        customer_id: "c_1",
        merchant_id: "m_1",
        consent: { opted_in_at: "2026-01-01", scope: ["promotional_offers"] },
        preferences: { reminder_opt_in: true }
      })
    );
    const consentResponse = await tick(
      request("/v1/tick", {
        now: "2026-07-03T10:00:00Z",
        available_triggers: ["trg_1"]
      })
    );
    expect((await consentResponse.json()).actions).toHaveLength(0);
  });
});
