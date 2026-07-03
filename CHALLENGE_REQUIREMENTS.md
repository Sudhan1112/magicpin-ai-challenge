# Magicpin AI Challenge — Consolidated Requirements

This document consolidates `challenge-brief.md` and `challenge-testing-brief.md`. The original briefs remain the source of truth if any wording differs.

## 1. Challenge objective

Build a merchant AI assistant called Vera that communicates over WhatsApp. Vera must use structured business context to proactively engage merchants, help them improve their Google Business Profile, recommend or run relevant campaigns, and communicate with opted-in customers on a merchant’s behalf.

The main objective is not merely to generate fluent copy. The assistant must:

- Ground every message in supplied context.
- Explain why the message is relevant now.
- Match the business category and merchant.
- Produce a response that a real merchant is likely to answer.
- Maintain state across context updates and conversation turns.
- Avoid fabricated facts, offers, citations, competitors, or performance claims.

## 2. Product problems the solution should improve

The challenge specifically highlights these weaknesses in the existing Vera experience:

1. WhatsApp Business auto-replies are often mistaken for genuine merchant replies.
2. Explicit commitment such as “yes,” “go ahead,” or “I want to join” is sometimes followed by more qualification instead of action.
3. Generic discount copy performs poorly compared with category-specific service-and-price offers.
4. Functional reminders alone do not create enough engagement; Vera also needs curiosity, knowledge, social proof, and merchant questions.
5. The assistant must know when to stop after opt-outs, repeated auto-replies, hostility, or lack of interest.

## 3. Required four-context framework

Every outbound action is based on three mandatory context layers and one optional layer.

### 3.1 Category context

Slow-changing knowledge shared by a vertical such as dentists, salons, restaurants, gyms, or pharmacies.

Expected information includes:

- Category slug and display identity.
- Canonical service-and-price offer patterns.
- Voice and tone rules.
- Allowed vocabulary and prohibited claims.
- Peer benchmarks.
- Research, regulation, or news digest items with sources.
- Customer education content.
- Seasonal patterns.
- Search or market trends.

### 3.2 Merchant context

The current state of a specific business.

Expected information includes:

- Merchant ID.
- Name, owner, location, city, verification, languages, and place ID.
- Subscription plan and renewal state.
- Views, calls, CTR, leads, directions, and recent deltas.
- Active, paused, and expired offers.
- Conversation history and engagement tags.
- Customer aggregates.
- Derived signals such as stale posts, low CTR, dormancy, or recent engagement.
- Review themes where supplied.

### 3.3 Trigger context

The event that creates the “why now” for a message.

Required fields include:

- Trigger ID.
- Merchant or customer scope.
- Trigger kind.
- Internal or external source.
- Merchant ID and optional customer ID.
- Trigger-specific payload.
- Urgency from 1 to 5.
- Suppression key for deduplication.
- Expiration timestamp.

Examples include:

- Research digest or regulation update.
- Festival, weather, local news, or category trend.
- Performance spike or dip.
- Review milestone or review theme.
- Competitor opening.
- Subscription renewal.
- Dormancy.
- Customer recall, refill, lapse, appointment, or trial follow-up.

### 3.4 Customer context

Used only for customer-facing communication sent on behalf of a merchant.

Expected information includes:

- Customer and merchant IDs.
- Name, redacted contact information, and preferred language.
- Visit history and services received.
- Relationship state and lifetime value where available.
- Preferred channel or appointment slot.
- Explicit consent timestamp and consent scope.

The bot must not send customer outreach without sufficient consent.

## 4. Composition contract

The conceptual composition function is:

```text
compose(category, merchant, trigger, optional customer) -> composed message
```

The output must contain:

- `body`: WhatsApp-ready message.
- `cta`: one primary CTA such as binary yes/no, confirm/cancel, open-ended, or none.
- `send_as`: `vera` for merchant messages or `merchant_on_behalf` for customer messages.
- `suppression_key`: stable deduplication key.
- `rationale`: concise explanation of the grounding and intended outcome.

The HTTP action contract additionally requires:

- `conversation_id`
- `merchant_id`
- `customer_id`
- `trigger_id`
- `template_name`
- `template_params`

## 5. Messaging constraints

1. The first outbound outside an active 24-hour WhatsApp session must use a sensible pre-approved template structure.
2. Keep messages concise and readable.
3. Use one primary CTA.
4. Use specific, verifiable context such as a number, date, source, offer, locality, or performance signal.
5. Match the vertical’s vocabulary and tone.
6. Match the merchant’s language; Hindi-English mixing is encouraged when appropriate.
7. Never invent facts absent from context.
8. Avoid promotional hype for professional or clinical categories.
9. Do not repeat the same message within a conversation.
10. Customer messages must respect consent and attribution.
11. Restraint is allowed: `/v1/tick` may return no actions.

## 6. Engagement principles

Useful engagement levers include:

- Verifiable specificity.
- Loss aversion.
- Context-supported social proof.
- Effort externalization: Vera prepares the work and asks only for approval.
- Curiosity.
- Reciprocity.
- Asking the merchant a useful operational question.
- A single low-friction commitment.

The judge penalizes generic discounts, multiple CTAs, buried asks, long preambles, repeated introductions, language mismatch, hallucinations, and repeated copy.

## 7. Required HTTP API

The testing brief requires a stateful HTTP service under `/v1/*`.

### 7.1 `POST /v1/context`

Purpose: accept category, merchant, customer, and trigger contexts.

Required behavior:

- Validate scope, context ID, integer version, and payload.
- Store by `(scope, context_id)`.
- A higher version atomically replaces a lower version.
- A duplicate or lower version must not overwrite newer context.
- Return an acknowledgement for accepted context.
- Return a stale-version conflict response when appropriate.
- Retain context for the test duration.

### 7.2 `POST /v1/tick`

Purpose: periodically inspect active triggers and optionally initiate conversations.

Input:

- Simulated current time.
- List of currently available trigger IDs.

Required behavior:

- Load trigger, merchant, category, and optional customer context.
- Check expiration.
- Check consent for customer outreach.
- Check suppression and duplicate-send state.
- Return no more than 20 actions.
- Generate unique conversation IDs for new conversations.
- Return within 30 seconds.
- Returning `{"actions":[]}` is valid.

### 7.3 `POST /v1/reply`

Purpose: process a merchant or customer reply in an existing conversation.

Valid responses:

- `send`: include a non-empty body, CTA, and rationale.
- `wait`: include `wait_seconds` and rationale.
- `end`: include rationale.

Important replay behavior:

- Detect canned and repeated auto-replies.
- Move immediately to execution after explicit commitment.
- End gracefully after opt-out or clear lack of interest.
- Remain polite and on-mission for hostile or off-topic requests.
- Avoid repeated reply bodies.
- Return within 30 seconds.

### 7.4 `GET /v1/healthz`

Must return:

- `status: "ok"`
- Uptime in seconds.
- Counts for category, merchant, customer, and trigger contexts.

Three consecutive health failures can disqualify the bot from a test slot.

### 7.5 `GET /v1/metadata`

Must identify:

- Team name.
- Team members.
- Model.
- Approach.
- Contact email.
- Version.
- Submission timestamp.

### 7.6 `POST /v1/teardown`

The testing brief describes teardown as optional but privacy-relevant. It should clear all stored contexts and conversation state after a test.

## 8. Judge lifecycle

### Warmup

- Check health and metadata.
- Push base category, merchant, and customer contexts.
- Verify context counts.

### Simulated test window

- Advance time in five-minute ticks.
- Push incremental context updates.
- Push active triggers.
- Call `/v1/tick`.
- Simulate merchant or customer responses.
- Call `/v1/reply` for up to five turns.

### Adaptive context injection

The judge may inject:

- New category digest items.
- New performance snapshots.
- New triggers.
- New customer contexts and recall triggers.

The bot must use the latest versions instead of stale data.

### Replay tests

Top systems may be tested on:

- Repeated WhatsApp auto-replies.
- Explicit intent transition to action.
- Abuse followed by an unrelated request.

## 9. Evaluation rubric

Each primary dimension is scored from 0 to 10:

1. **Specificity** — concrete and verifiable grounding.
2. **Category fit** — correct tone, vocabulary, and offer structure.
3. **Merchant fit** — personalization to the merchant’s actual state and language.
4. **Trigger relevance** — clear reason for sending now.
5. **Engagement compulsion** — likelihood of receiving a useful reply.

Additional scoring can include adaptation to new context, replay quality, and operational penalties.

## 10. Operational requirements

- Maximum judge traffic: 10 requests per second.
- Per-call timeout: 30 seconds.
- Context payload cap: 500 KB.
- Tick action cap: 20.
- Test duration: 60 simulated minutes.
- Persist state across calls during the test.
- Do not persist test context after teardown.
- Return valid JSON for every response.
- A `send` action may not have an empty body.
- The public deployment must expose `/v1/*`.

## 11. Privacy and ethics

- Challenge data is synthetic, not live merchant data.
- Do not scrape real magicpin or Google data.
- Do not contact or impersonate magicpin to real merchants.
- Do not send merchant or customer payloads to unrelated external APIs.
- Commercial LLM APIs are allowed for composition.
- Clear data at the end of testing.

## 12. Submission expectations and brief discrepancy

The main brief describes a legacy/static submission:

- `bot.py`
- `submission.jsonl` with 30 test outputs
- One-page `README.md`
- Optional `conversation_handlers.py`

The companion testing brief describes a deployed HTTP bot with five endpoints and optional teardown.

Before final submission, confirm with the challenge organizer whether both artifact sets are required. The current repository implements the HTTP contract, not the legacy Python/JSONL artifact format.

## 13. Dataset discrepancy in this repository

The briefs describe a full base dataset of:

- 5 categories
- 50 merchants
- 200 customers
- approximately 100 triggers

The repository currently contains a smaller consolidated seed:

- 5 categories
- 10 merchants
- 15 customers
- 25 triggers

The implementation must remain capable of accepting the larger judge-pushed dataset through `/v1/context`.

## 14. Pre-submission checklist

- [ ] Confirm required submission format with organizers.
- [ ] Replace placeholder metadata with final contact and model information.
- [ ] Deploy to a stable public URL.
- [ ] Verify all API schemas against the testing brief.
- [ ] Verify version conflict semantics.
- [ ] Verify fresh context injection changes subsequent output.
- [ ] Verify consent checks.
- [ ] Verify trigger expiration and deduplication.
- [ ] Verify repeated auto-reply handling.
- [ ] Verify opt-out behavior.
- [ ] Verify commitment-to-action behavior.
- [ ] Verify off-topic handling.
- [ ] Verify teardown clears all state.
- [ ] Run `judge_simulator.py` with a configured judge LLM key.
- [ ] Ensure all endpoints return within 30 seconds.
- [ ] Confirm no real or fabricated data is presented as factual.
