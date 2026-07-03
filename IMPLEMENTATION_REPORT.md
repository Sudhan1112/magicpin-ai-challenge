# Vera Judge-Score Upgrade — Detailed Implementation Report

## 1. Executive summary

The repository has been upgraded from a UI-led deterministic demo into a substantially more judge-ready submission with:

- Typed, version-aware conversation state.
- Latest-context adaptive replies.
- Deterministic trigger ranking.
- Consent-scope enforcement.
- Multi-layer suppression and fatigue tracking.
- Expanded intent, language, auto-reply, opt-out, deferral, hostility, and off-topic classification.
- Trigger-specific execution responses after explicit commitment.
- Optional OpenAI Responses API refinement with deterministic fallback.
- Grounding and anti-hallucination validation.
- Strict separation between the challenge reply API and the dashboard assistant.
- Automated Vitest coverage.
- Full expanded challenge dataset generation.
- Legacy Python composer and validated 30-line JSONL submission.
- Render deployment configuration.
- Environment-driven metadata and judge configuration.

The deterministic path is fully operational without an API key. The OpenAI path is implemented but was not exercised because `OPENAI_API_KEY` was not present in the environment.

The official LLM judge simulator is environment-ready but was not executed because `LLM_API_KEY` was not present.

Render deployment configuration is complete, but no remote deployment was created because this environment has no Render account authorization or public deployment URL.

## 2. Initial state

Before this upgrade:

- `/v1/context` rejected equal versions instead of treating them as idempotent no-ops.
- Conversations were stored only as arrays of turns.
- Conversation state did not remember trigger, category, suppression key, CTA, phase, language, or context versions.
- `/v1/reply` accepted unknown conversation IDs and returned generic text.
- Replies did not reload latest context.
- Exact repeated auto-replies were not detected unless they matched a small phrase list.
- Commitment replies promised action but did not produce a trigger-specific artifact.
- Language matching was minimal.
- `/v1/tick` processed triggers in input order.
- Suppression concerns were mixed in one set.
- There was no deterministic ranking or fatigue penalty.
- Customer consent was checked only for a non-empty scope, not trigger-compatible scope.
- No automated test framework existed.
- Judge simulator configuration required editing the Python source.
- Metadata contained a placeholder local email.
- The repository had no deployment blueprint.
- The legacy `bot.py` and `submission.jsonl` artifacts were absent.

## 3. Public API behavior

### 3.1 `POST /v1/context`

Current semantics:

- Invalid JSON returns HTTP 400.
- Missing or invalid scope, context ID, version, or payload returns HTTP 400.
- New context version is accepted.
- Equal context version returns HTTP 200 with:

```json
{
  "accepted": true,
  "noop": true
}
```

- A higher version atomically replaces the previous payload.
- A lower version returns HTTP 409 with `stale_version`.
- Stored metadata includes `deliveredAt` as well as version and payload.

This resolves the idempotency ambiguity in favor of the main brief’s explicit “same version is a no-op” requirement.

### 3.2 `POST /v1/tick`

The route now:

1. Validates `now`.
2. Validates `available_triggers`.
3. Resolves the latest trigger context.
4. Rejects missing or structurally inconsistent trigger records.
5. Checks sent-trigger state.
6. Checks suppression key.
7. Checks merchant and customer opt-out.
8. Resolves latest merchant and category contexts.
9. Resolves optional customer context.
10. Checks merchant/customer ownership.
11. Checks explicit opt-in and reminder preference.
12. Checks trigger-compatible consent scope.
13. Rejects invalid or expired expiry timestamps.
14. Scores eligible triggers.
15. Sorts deterministically by score and trigger ID.
16. Enforces one proactive action per merchant per tick.
17. Applies the configurable action cap.
18. Composes selected actions concurrently.
19. Rejects duplicate action and body fingerprints.
20. Creates complete conversation state.
21. Records trigger, suppression, fingerprint, and fatigue state.

Default action cap:

```text
VERA_MAX_ACTIONS_PER_TICK=5
```

Hard maximum remains 20.

### 3.3 `POST /v1/reply`

The route now requires a conversation created through `/v1/tick`.

Unknown conversations return:

```json
{
  "reason": "unknown_conversation",
  "details": "Start conversations through /v1/tick."
}
```

with HTTP 404.

Before composing a response, the route reloads:

- Latest category context.
- Latest merchant context.
- Latest trigger context.
- Latest optional customer context.

It updates the conversation’s recorded context versions after every reload.

Reply processing precedence:

1. Opt-out.
2. Canned or repeated auto-reply.
3. Hostility.
4. Off-topic request.
5. Deferral.
6. Commitment.
7. Question, objection, or generic input.

Responses remain within the required `send`, `wait`, or `end` schema.

### 3.4 `GET /v1/healthz`

Returns:

- `status`
- `uptime_seconds`
- Context counts for category, merchant, customer, and trigger

### 3.5 `GET /v1/metadata`

Metadata is now environment-driven:

- `VERA_TEAM_NAME`
- `VERA_TEAM_MEMBERS`
- `VERA_CONTACT_EMAIL`
- `VERA_VERSION`
- `VERA_SUBMITTED_AT`

The model description automatically reports whether OpenAI refinement is configured.

When `VERA_CONTACT_EMAIL` is absent, local metadata returns an empty string.
`render.yaml` marks the variable as a deployment-time secret, so a real value
must be supplied before the service is considered submission-ready.

### 3.6 `POST /v1/teardown`

Teardown clears:

- Contexts.
- Conversations.
- Suppression keys.
- Sent trigger IDs.
- Outbound fingerprints.
- Merchant opt-outs.
- Customer opt-outs.
- Merchant fatigue timestamps.

### 3.7 `POST /api/assistant`

This route was added for the dashboard.

Reason:

- The challenge `/v1/reply` contract should reject unknown conversations.
- The dashboard previously called `/v1/reply` with ad hoc IDs.
- Keeping that behavior would weaken contract enforcement.

The dashboard assistant now uses bundled seed data and clearly operates as a demo workspace assistant.

## 4. Conversation state model

Each challenge conversation now stores:

- `conversationId`
- `merchantId`
- `customerId`
- `categorySlug`
- `triggerId`
- `triggerKind`
- `suppressionKey`
- `phase`
- `lastCta`
- `lastOutbound`
- `intent`
- `language`
- `autoReplyCount`
- `lastInboundNormalized`
- `exactRepeatCount`
- `contextVersions`
- `turns`
- `createdAt`
- `updatedAt`

Conversation phases:

- `initiated`
- `waiting`
- `executing`
- `awaiting_approval`
- `ended`

Conversation intents:

- `unknown`
- `commitment`
- `question`
- `objection`
- `deferral`
- `opt_out`
- `auto_reply`
- `hostile`
- `off_topic`

Languages:

- English.
- Hindi.
- Hinglish.

## 5. Adaptive context behavior

Conversation state stores context identifiers, not frozen payload snapshots.

For example:

1. Trigger starts a performance-dip conversation using merchant version 1.
2. Judge pushes merchant version 2 with a different active offer.
3. Merchant replies “yes, go ahead.”
4. `/v1/reply` reloads merchant version 2.
5. The execution response uses the version 2 offer.

This behavior passed both an automated test and a production-server lifecycle smoke test.

## 6. Intent and language classification

### Auto-reply detection

Recognized phrases now include:

- Thank you/thanks for contacting.
- We will respond shortly.
- Will get back to you.
- Automated assistant/message.
- Automatic/auto reply.
- Business hours.
- Away right now.
- Currently unavailable.
- Out of office.
- Sent from WhatsApp Business.
- Driving.
- Cannot respond right now.
- Common Hindi/Hinglish team-forwarding wording.

Exact normalized repetition is detected independently of the phrase list.

Behavior:

- First likely auto-reply: wait four hours.
- Second canned or repeated reply: end.

This avoids burning three or more turns in the replay scenario.

### Commitment

Recognized commitment includes:

- Yes.
- Confirm.
- Go ahead.
- Let’s do it.
- Proceed.
- Start.
- Do it.
- Join.
- Enroll.
- Activate.
- Launch.
- Haan.
- Kar do.
- Shuru karo.
- Theek hai.

The first commitment produces a trigger-specific artifact and asks for approval.

A second confirmation records approval without claiming an external side effect occurred.

### Deferral

Recognized deferral includes:

- Later.
- Busy.
- Tomorrow.
- Next week.
- Call me later.
- Not now.
- Baad mein.
- Kal.
- Abhi busy.

The route returns `wait`, using one day for tomorrow/kal and four hours otherwise.

### Opt-out

Recognized English and Hindi/Hinglish opt-out wording suppresses the relevant merchant or customer and ends the conversation.

### Hostility

Hostile language ends the conversation without escalating or continuing outreach.

### Off-topic

Tax, GST, legal, court, passport, loan, stock-tip, and crypto requests are declined without pretending expertise. The assistant briefly states the merchant-growth areas it can support.

### Language selection

Language is selected from:

1. Customer language preference.
2. Devanagari detection.
3. Hindi/Hinglish lexical markers.
4. Merchant language configuration.
5. English fallback.

## 7. Trigger-specific execution

Explicit commitment now produces grounded artifacts for:

- Performance recovery.
- Research or regulation customer messaging.
- Review responses.
- Renewal impact summaries.
- Recall confirmations.
- Refill confirmations.
- Planning and festival campaign drafts.
- Generic trigger action drafts.

Every execution response states that nothing is published before approval.

The bot never claims that WhatsApp, Google Business, or another external action was completed.

## 8. Trigger ranking

Ranking currently uses:

- Urgency.
- Delivery freshness.
- Merchant engagement signals.
- Specific trigger-kind bonus.
- Recent merchant outreach penalty.

Stable trigger ID ordering resolves equal scores.

One merchant cannot receive multiple proactive actions in the same tick.

The store retains seven days of outbound timestamps for fatigue calculation.

## 9. Consent rules

Explicit mappings include:

- `recall_due` → `recall_reminders` or `recall_alerts`
- `appointment_tomorrow` → `appointment_reminders`
- `chronic_refill_due` → `refill_reminders`
- `wedding_package_followup` → `bridal_package_followup` or `promotional_offers`
- `customer_lapsed_hard` → `winback_offers`
- `winback_eligible` → `winback_offers`
- `trial_followup` → program, treatment, or kids-program update scopes

Customer outreach additionally requires:

- Matching customer ID.
- Matching merchant ID.
- `opted_in_at`.
- Reminder preference not explicitly false.

Unknown customer trigger kinds fail closed unless the trigger declares a required consent scope that the customer has granted.

## 10. Suppression and anti-repetition

Separate state now tracks:

- Sent trigger IDs.
- Trigger suppression keys.
- Merchant + trigger + CTA fingerprints.
- Body hashes.
- Merchant opt-outs.
- Customer opt-outs.
- Merchant fatigue.

OpenAI output is also checked against prior Vera turns to prevent verbatim repetition.

## 11. Hybrid OpenAI refinement

### Runtime selection

No API key:

```text
deterministic composition only
```

With `OPENAI_API_KEY`:

```text
deterministic draft
  -> OpenAI structured refinement
  -> grounding validation
  -> refined output or deterministic fallback
```

Default model:

```text
OPENAI_MODEL=gpt-5.4-mini
```

Default timeout:

```text
OPENAI_TIMEOUT_MS=8000
```

The Responses API request uses a strict JSON schema containing:

- `body`
- `cta`
- `rationale`

### Data minimization

The model receives only relevant:

- Category voice and knowledge.
- Merchant identity, performance, offers, signals, and recent history.
- Trigger.
- Optional customer relationship, state, preference, and consent.
- Conversation phase and recent turns.

Phone fields are omitted.

### Validation

A model refinement is rejected when:

- It is missing.
- JSON is malformed.
- Body is too short or exceeds 1,200 characters.
- CTA is invalid.
- CTA differs from the deterministic contract.
- Rationale is empty.
- A number/currency/percentage is unsupported by context or fallback.
- A URL is unsupported.
- Category taboo text appears.
- The message repeats an earlier Vera turn.

Provider errors are caught at the interface boundary. The deterministic path remains available even if a custom provider throws unexpectedly.

## 12. Automated tests

Framework:

```text
Vitest 4.1.9
```

Current result:

```text
2 test files passed
13 tests passed
```

Covered scenarios:

- Equal-version no-op.
- Lower-version rejection.
- Versioned context storage.
- Commitment detection.
- Canned auto-reply detection.
- Exact repetition detection.
- Hinglish detection.
- Matching consent.
- Mismatched consent.
- Grounded refinement acceptance.
- Unsupported numeric-claim rejection.
- CTA-change rejection.
- Provider-failure deterministic fallback.
- Trigger ranking.
- One merchant per tick.
- Duplicate trigger suppression.
- Adaptive context update in reply.
- First auto-reply wait.
- Second auto-reply end.
- Unknown conversation rejection.
- Expired trigger rejection.
- Non-consented customer trigger rejection.
- Health counts.
- Complete teardown.
- Metadata schema.

## 13. Build and live verification

### TypeScript

```text
npm run lint
PASS
```

### Automated tests

```text
npm run test
PASS — 13/13
```

### Production build

```text
npm run build
PASS
```

Generated routes:

- `/`
- `/api/assistant`
- `/api/demo`
- `/v1/context`
- `/v1/healthz`
- `/v1/metadata`
- `/v1/reply`
- `/v1/teardown`
- `/v1/tick`

### Production-server smoke test

Verified:

- Health is `ok`.
- Contexts are accepted.
- Equal version is a no-op.
- Tick produces an action.
- Merchant version 2 is used by the next reply.
- Reply returns `send`.
- Commitment returns `binary_confirm_cancel`.
- Metadata reports version `2.0.0`.
- Dashboard assistant returns `send`.
- Teardown reports cleared.
- Health reports zero contexts after teardown.

## 14. Expanded dataset

Command:

```powershell
npm run dataset:expand
```

Generated:

- 5 categories.
- 50 merchants.
- 200 customers.
- 100 triggers.
- 30 canonical test pairs.

Generated data is placed under `dataset/generated/` and ignored by Git because it is reproducible.

## 15. Legacy submission

Added:

- `bot.py`
- `scripts/generate_submission.py`
- `submission.jsonl`

The Python composer is deterministic and exposes:

```python
compose(category, merchant, trigger, customer=None)
```

Submission generation validates:

- Exactly 30 lines.
- Unique test IDs.
- Required fields.
- Non-empty body.
- CTA enum.
- `send_as` enum.

Current generation result:

```text
Wrote and validated 30 records
```

Python syntax compilation also passed.

## 16. Judge simulator

The simulator now reads:

- `BOT_URL`
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`
- `OLLAMA_URL`
- `TEST_SCENARIO`

No key is stored in source.

Baseline and final official judge scores are unavailable because:

```text
LLM_API_KEY was not present in the execution environment.
```

This is an external credential gate, not an implementation failure.

Once a key is set:

```powershell
$env:BOT_URL="http://localhost:3000"
$env:LLM_PROVIDER="openai"
$env:LLM_API_KEY="..."
python judge_simulator.py
```

## 17. Render deployment

Added `render.yaml` with:

- Node runtime.
- `npm ci && npm run build`.
- `npm start`.
- `/v1/healthz` health check.
- One instance.
- Environment-driven model and metadata.
- Secret prompts for OpenAI key and contact email.

Deployment was not executed because no Render authorization or target service was available in this environment.

The single-instance requirement is important because state remains process-local.

## 18. Environment variables

Documented in `.env.example`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_TIMEOUT_MS`
- `VERA_MAX_ACTIONS_PER_TICK`
- `VERA_TEAM_NAME`
- `VERA_TEAM_MEMBERS`
- `VERA_CONTACT_EMAIL`
- `VERA_VERSION`
- `VERA_SUBMITTED_AT`
- `BOT_URL`
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`
- `OLLAMA_URL`
- `TEST_SCENARIO`

`.env` and `.env.local` remain ignored.

## 19. Dependency and security note

Vitest was added as a development dependency.

`npm install` reported two moderate dependency audit findings. No force upgrade was applied because `npm audit fix --force` can introduce breaking dependency changes. These should be reviewed before production deployment.

## 20. Remaining external gates

The following require user credentials or account access:

1. Set `LLM_API_KEY`.
2. Run and record the official judge simulator.
3. Optionally set `OPENAI_API_KEY` and exercise live refinement.
4. Set a real `VERA_CONTACT_EMAIL`.
5. Create the Render service.
6. Verify the public URL.
7. Rerun the judge against the Render URL.

## 21. Remaining engineering limitations

- State does not survive a process restart.
- Multiple Render instances are unsupported without a shared state store.
- OpenAI refinement has not been live-tested in this environment.
- The deterministic TypeScript and Python composers are aligned conceptually but are separate implementations.
- The dashboard still uses bundled seed data rather than judge-injected context.
- Dashboard-created campaigns, knowledge, and merchants are not persisted.
- No browser automation suite exists.
- The trigger scoring formula is deterministic but not learned from historical engagement.
- Grounding validation focuses strongly on numbers, URLs, taboos, and repetition; it cannot prove every natural-language claim.

## 22. Recommended final submission steps

1. Copy `.env.example` to `.env.local`.
2. Set real metadata.
3. Set judge key.
4. Optionally set bot OpenAI key.
5. Run lint, tests, and build.
6. Start the production server.
7. Run the judge simulator.
8. Review low-scoring transcripts.
9. Tighten prompts or deterministic trigger handlers.
10. Regenerate `submission.jsonl`.
11. Deploy through Render.
12. Test the deployed health and metadata endpoints.
13. Run the judge against Render.
14. Record the final URL and scores in this report.

## 23. Final submission-readiness pass

The final readiness-only pass was completed after implementation.

Documentation audit:

- `README.md` matches the current endpoint and environment behavior.
- This report matches the current implementation and verification results.
- `SESSION_HANDOFF.md` contains the completed judge-score upgrade and remaining external gates.
- Stale `hello@vera.local` guidance was removed.
- `/v1/metadata` now reads all identity fields from environment variables.
- Missing local `VERA_CONTACT_EMAIL` returns an empty string rather than a fake address.
- `render.yaml` requires `VERA_CONTACT_EMAIL` at deployment time through `sync: false`.
- No API key value is committed; `.env` and `.env.local` remain ignored.

Final command results:

```text
npm run lint
PASS

npm run test
PASS — 2 files, 13 tests

npm run build
PASS — 10 application routes generated

python -m py_compile bot.py scripts/generate_submission.py
PASS

npm run submission:generate
PASS — 30 records
```

Final JSONL validation:

```text
Lines: 30
Unique test IDs: 30
Non-empty bodies: 30
Valid CTA values: 30
```

Final status:

- Repository implementation: ready.
- Local deterministic verification: ready.
- Real metadata: awaiting deployment environment values.
- Official judge score: awaiting `LLM_API_KEY`.
- Live hybrid OpenAI test: awaiting optional `OPENAI_API_KEY`.
- Render URL and public endpoint verification: awaiting deployment/account access.
