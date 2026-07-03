import { composeAction } from "./composer";
import type {
  Action,
  CTA,
  GroundingBundle,
  ReplyResult
} from "./types";

export type ModelRefinement = {
  body: string;
  cta: CTA;
  rationale: string;
};

export interface RefinementProvider {
  refine(
    bundle: GroundingBundle,
    fallback: ModelRefinement,
    mode: "proactive" | "reply"
  ): Promise<ModelRefinement | null>;
}

const CTA_VALUES: CTA[] = [
  "binary_yes_no",
  "binary_confirm_cancel",
  "open_ended",
  "none"
];

function minimalContext(bundle: GroundingBundle) {
  const { category, merchant, trigger, customer, conversation } = bundle;
  return {
    category: {
      slug: category.slug,
      voice: category.voice,
      peer_stats: category.peer_stats,
      digest: category.digest,
      seasonal_beats: category.seasonal_beats,
      trend_signals: category.trend_signals
    },
    merchant: {
      merchant_id: merchant.merchant_id,
      category_slug: merchant.category_slug,
      identity: merchant.identity,
      subscription: merchant.subscription,
      performance: merchant.performance,
      offers: merchant.offers,
      signals: merchant.signals,
      review_themes: merchant.review_themes,
      conversation_history: (merchant.conversation_history || []).slice(-4)
    },
    trigger,
    customer: customer
      ? {
          customer_id: customer.customer_id,
          merchant_id: customer.merchant_id,
          identity: {
            name: customer.identity?.name,
            language_pref: customer.identity?.language_pref,
            age_band: customer.identity?.age_band
          },
          relationship: customer.relationship,
          state: customer.state,
          preferences: customer.preferences,
          consent: customer.consent
        }
      : undefined,
    conversation: conversation
      ? {
          phase: conversation.phase,
          lastCta: conversation.lastCta,
          intent: conversation.intent,
          language: conversation.language,
          recentTurns: conversation.turns.slice(-5)
        }
      : undefined
  };
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string") return response.output_text;
  const parts = response?.output
    ?.flatMap((item: any) => item.content || [])
    ?.map((part: any) => part.text)
    ?.filter((value: unknown) => typeof value === "string");
  return parts?.join("") || "";
}

export class OpenAIRefinementProvider implements RefinementProvider {
  async refine(
    bundle: GroundingBundle,
    fallback: ModelRefinement,
    mode: "proactive" | "reply"
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const timeoutMs = Math.max(
      1000,
      Math.min(15_000, Number(process.env.OPENAI_TIMEOUT_MS) || 8000)
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
          input: [
            {
              role: "system",
              content:
                "You refine WhatsApp messages for Vera, an Indian merchant assistant. Use only facts in the supplied JSON. Preserve one CTA. Match category voice and language. Never invent an offer, number, date, source, competitor, URL, result, or completed external action. Keep the message concise. Return only the requested JSON."
            },
            {
              role: "user",
              content: JSON.stringify({
                mode,
                context: minimalContext(bundle),
                deterministic_draft: fallback
              })
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "vera_message",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  body: { type: "string" },
                  cta: { type: "string", enum: CTA_VALUES },
                  rationale: { type: "string" }
                },
                required: ["body", "cta", "rationale"]
              }
            }
          }
        })
      });

      if (!response.ok) return null;
      const payload = await response.json();
      const text = extractOutputText(payload);
      if (!text) return null;
      return JSON.parse(text) as ModelRefinement;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function numberTokens(value: string) {
  return value.match(/₹?\d[\d,.]*(?:%|cr|k|m)?/gi) || [];
}

function urlTokens(value: string) {
  return value.match(/https?:\/\/[^\s)]+/gi) || [];
}

export function validateRefinement(
  candidate: ModelRefinement | null,
  fallback: ModelRefinement,
  bundle: GroundingBundle
) {
  if (!candidate) return null;
  if (
    typeof candidate.body !== "string" ||
    candidate.body.trim().length < 12 ||
    candidate.body.length > 1200 ||
    !CTA_VALUES.includes(candidate.cta) ||
    typeof candidate.rationale !== "string" ||
    candidate.rationale.trim().length < 8
  ) {
    return null;
  }

  const source = JSON.stringify(minimalContext(bundle)) + fallback.body;
  const sourceNormalized = normalized(source);

  for (const token of numberTokens(candidate.body)) {
    if (!sourceNormalized.includes(normalized(token))) return null;
  }
  for (const url of urlTokens(candidate.body)) {
    if (!source.includes(url)) return null;
  }

  const taboos: string[] = bundle.category.voice?.taboos || [];
  if (
    taboos.some((taboo) =>
      normalized(candidate.body).includes(normalized(String(taboo)))
    )
  ) {
    return null;
  }

  const previous = bundle.conversation?.turns
    .filter((turn) => turn.from === "vera")
    .map((turn) => normalized(turn.body));
  if (previous?.includes(normalized(candidate.body))) return null;

  // The server-selected CTA is part of the conversation contract. A model may
  // improve wording, but it cannot silently change the required action shape.
  if (candidate.cta !== fallback.cta) return null;
  return {
    body: candidate.body.replace(/\s+/g, " ").trim(),
    cta: candidate.cta,
    rationale: candidate.rationale.replace(/\s+/g, " ").trim()
  };
}

const defaultProvider = new OpenAIRefinementProvider();

async function safelyRefine(
  provider: RefinementProvider,
  bundle: GroundingBundle,
  fallback: ModelRefinement,
  mode: "proactive" | "reply"
) {
  try {
    return await provider.refine(bundle, fallback, mode);
  } catch {
    return null;
  }
}

export async function composeHybridAction(
  bundle: GroundingBundle,
  provider: RefinementProvider = defaultProvider
): Promise<Action> {
  const fallback = composeAction(
    bundle.category,
    bundle.merchant,
    bundle.trigger,
    bundle.customer
  );
  const refinement = validateRefinement(
    await safelyRefine(
      provider,
      bundle,
      {
        body: fallback.body,
        cta: fallback.cta,
        rationale: fallback.rationale
      },
      "proactive"
    ),
    {
      body: fallback.body,
      cta: fallback.cta,
      rationale: fallback.rationale
    },
    bundle
  );

  return refinement ? { ...fallback, ...refinement } : fallback;
}

export async function refineReply(
  bundle: GroundingBundle,
  fallback: ReplyResult,
  provider: RefinementProvider = defaultProvider
): Promise<ReplyResult> {
  if (fallback.action !== "send") return fallback;
  const candidate = validateRefinement(
    await safelyRefine(
      provider,
      bundle,
      {
        body: fallback.body,
        cta: fallback.cta,
        rationale: fallback.rationale
      },
      "reply"
    ),
    {
      body: fallback.body,
      cta: fallback.cta,
      rationale: fallback.rationale
    },
    bundle
  );
  return candidate ? { action: "send", ...candidate } : fallback;
}
