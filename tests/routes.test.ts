import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { clearState, putContext, state } from "@/lib/store";
import { GET as health } from "@/app/v1/healthz/route";
import { GET as metadata } from "@/app/v1/metadata/route";
import { POST as teardown } from "@/app/v1/teardown/route";
import { POST as context } from "@/app/v1/context/route";

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

beforeEach(clearState);

describe("API contracts", () => {
  it("reports context counts and clears all state on teardown", async () => {
    putContext({
      scope: "category",
      context_id: "dentists",
      version: 1,
      payload: { slug: "dentists" },
      delivered_at: "2026-07-03T00:00:00Z"
    });
    state.optedOutMerchants.add("m_1");
    state.suppressionKeys.add("s_1");

    expect((await (await health()).json()).contexts_loaded.category).toBe(1);
    expect((await (await teardown()).json()).cleared).toBe(true);
    expect((await (await health()).json()).contexts_loaded.category).toBe(0);
    expect(state.optedOutMerchants.size).toBe(0);
    expect(state.suppressionKeys.size).toBe(0);
  });

  it("returns a successful no-op for an equal context version", async () => {
    const body = {
      scope: "category",
      context_id: "dentists",
      version: 1,
      payload: { slug: "dentists" },
      delivered_at: "2026-07-03T00:00:00Z"
    };
    expect((await (await context(post("/v1/context", body))).json()).noop).toBe(
      false
    );
    const second = await context(post("/v1/context", body));
    expect(second.status).toBe(200);
    expect((await second.json()).noop).toBe(true);

    const stale = await context(
      post("/v1/context", { ...body, version: 0 })
    );
    expect(stale.status).toBe(409);
    expect((await stale.json()).reason).toBe("stale_version");
  });

  it("returns stable, complete metadata fields", async () => {
    const result = await (await metadata()).json();
    expect(result).toMatchObject({
      team_name: expect.any(String),
      team_members: expect.any(Array),
      model: expect.any(String),
      approach: expect.any(String),
      contact_email: expect.any(String),
      version: expect.any(String),
      submitted_at: expect.any(String)
    });
  });
});
