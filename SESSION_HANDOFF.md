# Vera Merchant OS — Complete Session Handoff

This is a cold-start handoff for a future Codex session. Read this file together with:

1. `CHALLENGE_REQUIREMENTS.md`
2. `challenge-brief.md`
3. `challenge-testing-brief.md`
4. `README.md`

## 1. User’s goal so far

The repository began as a polished but mostly non-functional dashboard. The user asked to:

1. Make the UI functionality work instead of being purely visual.
2. Verify every Overview interaction.
3. Verify the rest of the visible controls.
4. Clarify whether displayed data was real or fake.
5. Remove misleading fake aggregates and derive page data from the bundled seed dataset.

The current implementation is a Next.js application named **Vera Merchant OS**, representing a merchant-growth and WhatsApp-assistant workspace.

## 2. Current technology

- Next.js 15 App Router.
- React 19.
- TypeScript.
- Lucide React icons.
- Plain global CSS.
- Local JSON seed files.
- In-memory server-side challenge state.
- No database.
- No authentication.
- No external LLM integration.
- No real magicpin API integration.

Key scripts:

```powershell
npm install
npm run dev
npm run lint
npm run build
npm start
```

`npm run lint` currently executes `tsc --noEmit`.

## 3. Repository structure

### Application

- `app/page.tsx` — entire dashboard UI and client-side interaction logic.
- `app/globals.css` — complete visual styling and responsive behavior.
- `app/layout.tsx` — root layout.
- `app/api/demo/route.ts` — returns seed-backed dashboard data.

### Challenge HTTP API

- `app/v1/context/route.ts`
- `app/v1/tick/route.ts`
- `app/v1/reply/route.ts`
- `app/v1/healthz/route.ts`
- `app/v1/metadata/route.ts`
- `app/v1/teardown/route.ts`

### Server logic

- `lib/store.ts` — global in-memory context and conversation state.
- `lib/composer.ts` — deterministic trigger-aware message composition and reply classifiers.
- `lib/types.ts` — challenge API types.
- `lib/demo-data.ts` — loads and aggregates local seed JSON for the dashboard.

### Dataset

- `dataset/merchants_seed.json`
- `dataset/customers_seed.json`
- `dataset/triggers_seed.json`
- `dataset/categories/dentists.json`
- `dataset/categories/salons.json`
- `dataset/categories/restaurants.json`
- `dataset/categories/gyms.json`
- `dataset/categories/pharmacies.json`

### Challenge references

- `challenge-brief.md`
- `challenge-testing-brief.md`
- `judge_simulator.py`
- `examples/api-call-examples.md`
- `examples/case-studies.md`

## 4. Data truth and provenance

There is no live production data.

The dashboard reads:

```text
GET /api/demo
  -> lib/demo-data.ts
  -> dataset/*_seed.json and dataset/categories/*.json
```

The seed is synthetic challenge data. The UI now explicitly says **Synthetic seed data** and contains a tooltip listing the source files.

Current repository dataset counts:

- 5 category packs.
- 10 merchants.
- 15 customers.
- 25 triggers.
- 12 stored conversation turns at the time of the latest verification.
- 8 merchants with `subscription.status === "active"`.
- 29,100 total profile views derived from merchant performance.
- 284 total calls derived from merchant performance.

Important distinction:

- Dashboard pages read local seed JSON through `/api/demo`.
- Judge-pushed contexts are stored separately by `/v1/context`.
- The dashboard does not currently visualize the dynamically injected `/v1/context` state.

## 5. Fake-data cleanup already completed

The original UI contained many invented numbers, including:

- 100.3K merchants.
- 47.7K conversations.
- 84.2% automation.
- ₹12.8 crore revenue influence.
- 1.18M monthly messages.
- 994,306 Vera resolutions.
- 1,842 recall customers.
- Fabricated campaign reaches and expected lift.
- Fabricated audience segment counts.
- Fabricated analytics percentages.
- Fabricated remaining AI credit count.
- Fabricated “Now” timestamps and unread state.
- A fabricated 31% dental campaign uplift claim.

These claims were removed or replaced with seed-derived calculations.

Current principles:

- Merchant performance comes from merchant seed records.
- Customer counts and consent come from customer seed records.
- Queue items come from trigger seed records.
- Category counts come from category seed records.
- Conversation chart values come from actual conversation-history timestamps.
- Campaign suggestions show consented seed audience and available trigger count, not predicted lift.
- Audience segments count matching customer states or trigger kinds.
- Analytics values are derived from seed turns, engagement signals, views, and calls.
- Settings are explicitly labeled demo configuration rather than live connections.

## 6. Implemented dashboard features

### 6.1 Shared shell and navigation

Implemented:

- Responsive sidebar.
- Mobile sidebar open/close.
- Navigation between all workspaces.
- Active navigation styles.
- Workspace selector.
- Workspace settings handoff.
- Profile button routing to settings.
- Seed-data coverage summary.
- Dynamic conversation-turn badge.
- Global data-source label.

### 6.2 Global search

Implemented:

- Searches merchants by business name, category, city, and locality.
- Displays merchant results in a dropdown.
- Opens Merchant 360 from a result.
- `Ctrl+K` or `Cmd+K` focuses search.
- `Enter` opens the first result.
- `Escape` clears search.

### 6.3 Ask Vera

Implemented:

- Global Ask Vera modal.
- Prompt input.
- Enter-to-submit.
- Loading state.
- Calls `/v1/reply`.
- Displays returned response or rationale.
- Can route to Conversations.

Limitation:

- This is not an LLM. `/v1/reply` uses deterministic classification and generic rule-based responses.

### 6.4 Overview

Implemented:

- Seed-data disclosure.
- Derived active merchant count.
- Derived stored conversation-turn count.
- Derived trigger count.
- Derived views and calls.
- Activity chart built from actual seed conversation timestamps.
- 24-hour, seven-day, and 30-day windows relative to the latest seed timestamp.
- High-urgency trigger queue.
- Trigger-to-merchant lookup.
- Merchant momentum table.
- Actual seven-day merchant performance deltas.
- Merchant 360 opening from queue and table.
- Derived dental category views, calls, and merchant count.
- Create Campaign opens the actual campaign composer.
- Build Campaign opens the campaign composer.
- View All routes to the correct workspace.

### 6.5 Merchant network

Implemented:

- Merchant cards generated from seed merchants.
- Search.
- Category filter.
- Subscription-status filter.
- Empty-filter state.
- Merchant 360 drawer.
- Local Add Merchant modal.
- Validation for merchant name.
- New merchant appears in the current component state.

Limitation:

- Added merchants are client-side demo state.
- They are not persisted to disk or a database.
- They may reset when the component remounts or the page reloads.

### 6.6 Merchant 360 drawer

Implemented:

- Merchant identity.
- Category.
- Location.
- Views, calls, and directions.
- Recorded performance delta.
- Signal list.
- Offer list.
- Contextual Vera summary.
- Open Conversation action.
- Create Campaign action.
- Backdrop and Escape-compatible modal behavior where applicable.

### 6.7 Conversations

Implemented:

- Merchant conversation list.
- Conversation search.
- All, Unread, and Escalated filters.
- Unread state derived from the last stored turn being from the merchant.
- Escalation derived from severe signals.
- Seed timestamps instead of fabricated relative times.
- Seed conversation history.
- Local newly sent turns.
- API-backed replies through `/v1/reply`.
- Enter-to-send.
- Loading and typing indicator.
- Error fallback.
- Suggested reply insertion.
- AI handling on/off.
- Human-handling state.
- Conversation settings modal.
- Mark Resolved action.
- Mute action closes settings.
- Merchant context sidebar with performance, signals, and offers.

Important semantic detail:

- The composer input represents a merchant reply to Vera.
- It sends `from_role: "merchant"` to `/v1/reply`.

Limitations:

- UI turns are client state and are not persisted across reloads.
- Turning AI off suppresses an automatic Vera reply but does not create a real human assignment.
- “Mute notifications” is a demo interaction, not persisted state.

### 6.8 Campaign studio

Implemented:

- Dataset-backed suggested campaign concepts.
- Category-specific consented audience counts.
- Trigger counts used as source-context metrics.
- Dental recall recommendation derived from eligible recall triggers and consent.
- New Campaign modal.
- Name and category selection.
- Local Draft creation.
- Status filter for all, suggested, draft, and scheduled demo items.
- Campaign details.
- Schedule Demo action.
- Data coverage progress derived from audience size.

Removed:

- Invented expected-lift percentages.
- Invented thousands-sized audiences.
- Claims that demo campaigns are live production campaigns.

Limitations:

- Campaigns are client-side demo objects.
- Scheduling does not call WhatsApp, Google Business, or an external service.
- Campaign state is not persisted.

### 6.9 Audiences

Implemented:

- Total customer records.
- Recorded opt-in count.
- Customer-linked trigger count.
- Profiles excluded for lacking recorded opt-in.
- Recall segment derived from `recall_due`.
- Lapsed segment derived from customer state.
- Refill segment derived from `chronic_refill_due`.
- Trial follow-up segment derived from `trial_followup`.
- Build Audience opens Ask Vera.

### 6.10 Category knowledge

Implemented:

- Five category packs from JSON.
- Tone.
- Digest record count.
- Offer-pattern count.
- Pack-detail modal.
- Local Add Knowledge workflow.
- Category selection.
- Local digest-count increment.

Limitations:

- Added knowledge is client-side demo state.
- It is not written to category JSON or the challenge context store.

### 6.11 Automations

Implemented:

- Four demonstration rules.
- On/off toggles.
- New Automation routes through Ask Vera.

Limitation:

- Toggle state is UI-only and does not change `/v1/tick` behavior.

### 6.12 Analytics

Implemented seed-derived values:

- Stored conversation turns.
- Merchant engagement percentage based on engagement signals.
- Calls divided by profile views.

No production analytics integration exists.

### 6.13 Compliance

Implemented seed-derived values:

- Recorded opt-ins.
- Excluded profiles.
- Category-pack count.

Actual consent enforcement also exists in `/v1/tick` for customer triggers.

### 6.14 Settings

Implemented as a demo configuration page.

It explicitly says integrations are not live.

No real WhatsApp, Google Business, authentication, team, or notification settings backend exists.

## 7. Challenge API implementation

### 7.1 In-memory state

`lib/store.ts` stores:

- Start timestamp.
- Versioned contexts.
- Conversation turns.
- Suppression keys.
- Sent trigger IDs.
- Auto-reply counts.

The state is placed on `globalThis` to survive development module reloads within the same server process.

It does not survive a full server restart.

### 7.2 `POST /v1/context`

Implemented:

- JSON parsing.
- Scope validation.
- Required field validation.
- Integer-version validation.
- Versioned storage.
- Stale/duplicate version rejection with HTTP 409.
- Acknowledgement ID.
- Storage timestamp.

Current behavior treats an equal version as stale and returns 409. The brief’s wording also describes a same-version repost as a no-op, so this detail should be rechecked against the organizer’s exact expected status.

### 7.3 `POST /v1/tick`

Implemented:

- Validates `available_triggers`.
- Caps inspection at 20 triggers.
- Skips already-sent trigger IDs.
- Loads trigger, merchant, category, and optional customer.
- Skips missing contexts.
- Checks merchant suppression.
- Checks customer consent and reminder opt-in.
- Checks expiration against simulated time.
- Checks suppression key.
- Composes a deterministic action.
- Creates a conversation.
- Records sent trigger and suppression state.

Potential improvement:

- Prioritization is currently input order, not a score using urgency, freshness, and merchant fatigue.
- Expiration parsing depends on valid timestamps.
- Broader consent-scope matching could be stricter per trigger kind.

### 7.4 `POST /v1/reply`

Implemented:

- Validates conversation ID and message.
- Appends merchant/customer turn.
- Detects opt-out or frustration phrases.
- Suppresses the merchant after opt-out.
- Detects common canned WhatsApp auto-reply phrases.
- Waits after initial canned replies.
- Ends after the third detected canned reply.
- Detects explicit commitment.
- Moves immediately to action mode.
- Declines GST, tax, and legal requests without fabricating expertise.
- Provides a generic grounded next-step response otherwise.

Potential improvements:

- Detect exact repeated text even when it does not match a canned phrase list.
- Store per-conversation mission and use actual prior context in follow-up composition.
- Avoid returning identical generic reply text multiple times.
- Match language per turn.
- Distinguish customer and merchant reply strategies more deeply.
- Handle hostile content explicitly.
- Convert commitment into a trigger-specific artifact rather than only promising a draft.

### 7.5 `GET /v1/healthz`

Implemented:

- Status.
- Uptime.
- Context counts by all four scopes.

### 7.6 `GET /v1/metadata`

Implemented fields:

- Team name.
- Team member.
- Model description.
- Approach.
- Contact email.
- Version.
- Submission timestamp.

Before submission:

- Set a real `VERA_CONTACT_EMAIL` deployment environment value.
- Confirm actual team and model wording.
- Consider a stable submission timestamp rather than generating the current timestamp per request.

### 7.7 `POST /v1/teardown`

Implemented:

- Clears contexts.
- Clears conversations.
- Clears suppressions.
- Clears sent triggers.
- Clears auto-reply counts.

## 8. Deterministic composer

`lib/composer.ts` handles:

- Customer recall.
- Chronic refill.
- Lapsed customer or trial follow-up.
- Generic customer outreach.
- Research digest.
- Regulation change.
- Category development opportunity.
- Performance dip.
- Performance spike.
- Milestone.
- Active planning intent.
- Review theme.
- Renewal due.
- Supply alert.
- IPL match event.
- Competitor opening.
- Curiosity ask.
- Generic trigger fallback.

It also:

- Uses dentist-specific salutation.
- Reads active merchant offer.
- Resolves digest items by ID.
- Selects CTA type.
- Selects `vera` versus `merchant_on_behalf`.
- Generates template names and parameters.
- Generates suppression keys and rationale.

Major limitation:

- It is a rules engine, not an LLM or retrieval-augmented composer.
- Coverage quality varies by trigger.
- Some messages remain generic.
- The challenge rewards richer adaptation and category fit than this composer currently provides.

## 9. Verification already performed

The following checks passed after the latest changes:

```powershell
npm run lint
npm run build
```

The production build generated:

- `/`
- `/api/demo`
- `/v1/context`
- `/v1/tick`
- `/v1/reply`
- `/v1/healthz`
- `/v1/metadata`
- `/v1/teardown`

A local lifecycle smoke test also verified:

- Health returns `ok`.
- Category, merchant, and trigger contexts are accepted.
- Duplicate/stale context returns HTTP 409.
- Tick generates an action.
- Explicit commitment returns `action: "send"`.
- Teardown clears all context counts.

The latest `/api/demo` smoke output confirmed:

```json
{
  "source": "synthetic_seed",
  "live": false,
  "merchants": 10,
  "activeMerchants": 8,
  "customers": 15,
  "triggers": 25,
  "conversationTurns": 12,
  "profileViews": 29100,
  "calls": 284
}
```

## 10. Testing not completed

`judge_simulator.py` was invoked but requires `LLM_API_KEY`. It stopped before running scenarios because no key was configured.

Therefore:

- Local deterministic endpoint smoke tests passed.
- The complete LLM-judged simulator has not run.
- No public deployment has been tested.
- No browser automation suite exists.
- UI interactions were audited in code and production compilation, but not with Playwright/Cypress.

## 11. Important gaps before a competitive submission

### Highest priority

1. Confirm whether the organizer expects only the HTTP deployment or also `bot.py` and `submission.jsonl`.
2. Configure and run `judge_simulator.py`.
3. Replace placeholder metadata.
4. Deploy to a public URL.
5. Improve multi-turn reply quality.
6. Add repeated-text auto-reply detection.
7. Use conversation mission and trigger context in replies.
8. Add language matching.
9. Confirm same-version `/v1/context` semantics.
10. Add automated API contract tests.

### Product/data architecture

1. Decide whether the dashboard should visualize judge-injected state.
2. Move UI-created merchants, campaigns, knowledge, and automation settings to persistent storage if persistence is desired.
3. Add a real database only if the challenge or deployment needs restart resilience.
4. Keep seed/demo and live data visually distinct.
5. Never reintroduce unsupported marketing metrics or predicted lift.

### UI engineering

1. Split the very large `app/page.tsx` into components.
2. Add accessible labels and focus management.
3. Add browser-level interaction tests.
4. Add persistent toast/feedback for successful actions.
5. Add error boundaries and retry state for `/api/demo`.
6. Test mobile layouts in a real browser.

## 12. Git/worktree caution

At the time of work, the repository files appeared untracked in `git status`. Do not assume there is a clean baseline commit.

Before committing:

```powershell
git status --short
git diff --name-only
```

Preserve any unrelated user files.

## 13. Recommended next-session workflow

1. Read `CHALLENGE_REQUIREMENTS.md`.
2. Read this handoff completely.
3. Run `git status --short`.
4. Run `npm run lint`.
5. Run `npm run build`.
6. Inspect current user request.
7. If improving challenge score, prioritize `/v1/reply` and adaptive context use over additional dashboard decoration.
8. If preparing submission, resolve artifact-format ambiguity and run the judge simulator.

## 14. Ready-to-paste prompt for a new Codex session

```text
We are continuing work on the magicpin AI Challenge repository.

First read these files completely:
1. CHALLENGE_REQUIREMENTS.md
2. SESSION_HANDOFF.md
3. challenge-brief.md
4. challenge-testing-brief.md

Then inspect the current worktree without discarding any existing changes. Treat SESSION_HANDOFF.md as the implementation history, but verify the code before relying on it.

Important facts:
- The dashboard uses synthetic bundled seed data, not real magicpin data.
- The Next.js HTTP challenge endpoints are implemented.
- The composer and reply router are deterministic, not an external LLM.
- Lint and production build passed at the end of the previous session.
- The full judge simulator has not run because LLM_API_KEY was unavailable.
- UI-created data is mostly client-side demo state.
- app/page.tsx is large and should be refactored only if that supports the requested task.

Continue from the user’s newest request. Do not reintroduce fabricated dashboard metrics. Ground every claim in either seed data, injected context, or clearly labeled demo state.
```

## 15. Definition of “done” for the full challenge

The project is genuinely submission-ready only when:

- Required artifact format is confirmed.
- All required endpoints pass contract tests.
- Public deployment is stable.
- Judge simulator produces acceptable scores.
- Adaptive context updates affect messages.
- Consent, expiry, suppression, and teardown are verified.
- Repeated auto-replies end gracefully.
- Explicit commitment advances to action.
- Hostile and off-topic replies remain safe and on-mission.
- No fabricated data appears in UI or messages.
- Final metadata and contact details are correct.
- README accurately documents architecture, tradeoffs, and limitations.

## 16. Judge-score engine upgrade completed

The implementation described in the original handoff has now been materially upgraded. Read `IMPLEMENTATION_REPORT.md` for the exhaustive record.

Completed after the original handoff:

- Typed conversation mission and phase state.
- Context delivery timestamps and version tracking.
- Same-version context no-op behavior.
- Latest-context reload on every reply.
- Separate trigger suppression, fingerprints, opt-outs, and fatigue.
- Trigger ranking and one-action-per-merchant behavior.
- Trigger-compatible customer consent mapping.
- Expanded English/Hindi/Hinglish intent classification.
- Canned plus exact repeated auto-reply handling.
- Trigger-specific commitment execution.
- Optional OpenAI Responses API structured refinement.
- Deterministic fallback and grounding validator.
- Dashboard assistant separated from `/v1/reply`.
- Vitest with 13 passing tests.
- Production build and server lifecycle smoke verification.
- Expanded 50/200/100 generated dataset.
- Standalone `bot.py`.
- Validated 30-line `submission.jsonl`.
- Environment-driven judge configuration.
- Environment-driven metadata.
- `.env.example`.
- Render blueprint.
- Expanded README.
- Detailed `IMPLEMENTATION_REPORT.md`.

Credential-dependent work still outstanding:

- Official simulator score, because `LLM_API_KEY` is not set.
- Live OpenAI refinement test, because `OPENAI_API_KEY` is not set.
- Render deployment and public URL verification, because deployment account access is not available.
- Final real contact email.

The correct next-session starting point is now:

1. Read `IMPLEMENTATION_REPORT.md`.
2. Set the required environment variables without committing them.
3. Run `npm run lint`, `npm run test`, and `npm run build`.
4. Run the judge simulator and iterate from its score report.
5. Deploy to Render and repeat the judge against the public URL.
