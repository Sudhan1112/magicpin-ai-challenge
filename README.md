# Vera — Merchant Growth OS

Vera is a stateful, four-context merchant assistant for the magicpin AI Challenge. It combines category knowledge, merchant performance, trigger events, optional customer relationships, and conversation memory to create grounded WhatsApp actions.

The repository contains:

- A challenge-compatible Next.js HTTP service.
- A deterministic composer with optional OpenAI refinement.
- Multi-turn intent, auto-reply, opt-out, deferral, and language routing.
- Trigger ranking, consent enforcement, suppression, and teardown.
- A synthetic seed-backed dashboard.
- Automated contract and behavior tests.
- Legacy `bot.py` and 30-line `submission.jsonl` artifacts.

## Data notice

All bundled dashboard data is synthetic challenge data. It is loaded from:

- `dataset/merchants_seed.json`
- `dataset/customers_seed.json`
- `dataset/triggers_seed.json`
- `dataset/categories/*.json`

No live magicpin, WhatsApp, or Google Business data is connected.

## Architecture

```text
Judge context pushes
       |
       v
Versioned context store
 category + merchant + trigger + optional customer
       |
       v
Trigger validation -> consent -> ranking -> suppression
       |
       v
Deterministic grounded draft
       |
       +--> optional OpenAI structured refinement
       |         |
       |         +--> validation failure/timeout -> deterministic draft
       v
Conversation record + proactive action
       |
       v
Merchant/customer reply
       |
       v
Intent/language classifier -> latest contexts -> send/wait/end
```

The process-local store retains only context IDs in the conversation mission. Every reply reloads the latest context versions, so adaptive judge updates are used immediately.

## HTTP API

### `POST /v1/context`

Stores versioned category, merchant, customer, or trigger context.

- Equal version: HTTP 200 successful no-op.
- Higher version: atomically replaces the previous payload.
- Lower version: HTTP 409 `stale_version`.

### `POST /v1/tick`

Validates and ranks currently available triggers, then returns zero or more proactive actions.

The route enforces:

- Trigger expiry.
- Customer ownership and consent scope.
- Merchant/customer opt-out.
- Trigger and suppression-key deduplication.
- Body and merchant/trigger/CTA fingerprints.
- One proactive action per merchant per tick.
- Configurable action cap, default five and hard maximum twenty.

### `POST /v1/reply`

Continues an existing conversation created by `/v1/tick`.

The route can return:

- `send`
- `wait`
- `end`

It handles:

- Explicit commitment.
- Questions and objections.
- English, Hindi, and Hinglish.
- Canned WhatsApp Business replies.
- Exact repeated replies.
- Deferral.
- Opt-out.
- Hostility.
- GST/tax/legal and other off-topic requests.

Unknown conversation IDs return HTTP 404. The dashboard’s general assistant uses `/api/assistant`, not the challenge reply contract.

### `GET /v1/healthz`

Returns uptime and context counts.

### `GET /v1/metadata`

Returns environment-configured submission metadata.

### `POST /v1/teardown`

Clears all contexts, conversations, suppression state, opt-outs, fingerprints, and fatigue history.

## Hybrid composition

The deterministic composer is always available. If `OPENAI_API_KEY` is present, the service uses the OpenAI Responses API to request a structured refinement.

Server-side validation rejects:

- Empty, excessively long, or malformed output.
- CTA changes.
- Unsupported numbers, currency, percentages, and URLs.
- Category taboo language.
- Verbatim repeated outbound messages.

Any model error, timeout, invalid JSON, rate limit, or validation failure returns the deterministic draft instead of failing the API.

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

OpenAI is optional. To enable hybrid refinement, set this only in `.env.local`:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

Never commit `.env.local`.

## Verification

```powershell
npm run lint
npm run test
npm run build
```

## Judge simulator

The simulator now reads configuration from environment variables:

```powershell
$env:BOT_URL="http://localhost:3000"
$env:LLM_PROVIDER="openai"
$env:LLM_API_KEY="..."
$env:LLM_MODEL=""
python judge_simulator.py
```

The judge key is used by the simulator. `OPENAI_API_KEY` is separately used by the bot’s optional refinement path.

## Expanded dataset and legacy submission

Generate the full 50-merchant, 200-customer, 100-trigger dataset and canonical test pairs:

```powershell
npm run dataset:expand
```

Generate and validate exactly 30 legacy submission records:

```powershell
npm run submission:generate
```

Legacy artifacts:

- `bot.py`
- `submission.jsonl`

## Render deployment

`render.yaml` defines one long-lived Node web service.

1. Create a Render Blueprint from this repository.
2. Set secret `OPENAI_API_KEY` if hybrid refinement is desired.
3. Set required `VERA_CONTACT_EMAIL`.
4. Confirm team metadata environment variables.
5. Keep `numInstances: 1` while state is process-local.
6. Verify `/v1/healthz`.
7. Set `BOT_URL` to the Render URL and rerun `judge_simulator.py`.

An always-on instance is recommended for the timed judge window. Do not enable multi-instance autoscaling unless the state is moved to Redis or another shared store.

## Privacy and operational tradeoffs

- Customer data sent to OpenAI is minimized and excludes phone fields.
- Full customer payloads are not logged.
- The bot never claims an external campaign or profile update was published.
- In-memory state is challenge-compatible but does not survive a process restart.
- The deterministic fallback protects latency and availability.
- The dashboard is a demo workspace; its locally created campaigns and merchants are not production persistence.
