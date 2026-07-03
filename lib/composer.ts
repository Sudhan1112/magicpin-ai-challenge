import type {
  Action,
  ConversationLanguage,
  ConversationRecord,
  GroundingBundle,
  ReplyResult
} from "./types";

const money = (value: unknown) =>
  typeof value === "number"
    ? `₹${value.toLocaleString("en-IN")}`
    : String(value ?? "");

const clean = (value: unknown) =>
  String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

function activeOffer(merchant: Record<string, any>) {
  return merchant.offers?.find(
    (offer: Record<string, any>) => offer.status === "active"
  )?.title;
}

function salutation(
  merchant: Record<string, any>,
  category: Record<string, any>
) {
  const owner = merchant.identity?.owner_first_name;
  if (category.slug === "dentists") {
    return owner ? `Dr. ${owner}` : merchant.identity?.name;
  }
  return owner || merchant.identity?.name || "there";
}

function digestItem(
  category: Record<string, any>,
  trigger: Record<string, any>
) {
  const id =
    trigger.payload?.top_item_id ||
    trigger.payload?.digest_item_id ||
    trigger.payload?.alert_id;
  return category.digest?.find((item: Record<string, any>) => item.id === id);
}

function localizedAsk(
  language: ConversationLanguage,
  english: string,
  hinglish: string
) {
  if (language === "en") return english;
  return hinglish;
}

export function inferContextLanguage(
  merchant: Record<string, any>,
  customer?: Record<string, any>
): ConversationLanguage {
  const preference = String(
    customer?.identity?.language_pref || ""
  ).toLowerCase();
  if (preference.includes("mix")) return "hinglish";
  if (preference === "hi" || preference.includes("hindi")) return "hi";
  return "en";
}

export function composeAction(
  category: Record<string, any>,
  merchant: Record<string, any>,
  trigger: Record<string, any>,
  customer?: Record<string, any>
): Action {
  const who = salutation(merchant, category);
  const kind = trigger.kind;
  const payload = trigger.payload || {};
  const offer = activeOffer(merchant);
  const digest = digestItem(category, trigger);
  const language = inferContextLanguage(merchant, customer);
  let body = "";
  let cta: Action["cta"] = "binary_yes_no";

  if (customer) {
    const name = customer.identity?.name || "there";
    if (kind === "recall_due") {
      const slots = (payload.available_slots || [])
        .map((slot: any) => slot.label)
        .filter(Boolean);
      const slotText = slots.length ? ` ${slots.join(" or ")} available.` : "";
      body = `Hi ${name}, ${merchant.identity.name} here. Your ${clean(
        payload.service_due || "follow-up"
      )} is due${
        payload.last_service_date
          ? ` after your last visit on ${payload.last_service_date}`
          : ""
      }.${slotText}${offer ? ` ${offer} is currently active.` : ""} ${localizedAsk(
        language,
        "Reply YES and we will hold a suitable slot.",
        "YES reply kijiye; hum aapke liye suitable slot hold kar denge."
      )}`;
    } else if (kind === "chronic_refill_due") {
      body = `Namaste ${name}, ${merchant.identity.name} here. Your ${(
        payload.molecule_list || []
      ).join(", ")} refill is expected to run out on ${clean(
        payload.stock_runs_out_iso
      ).slice(0, 10)}. ${offer ? `${offer} is active. ` : ""}Reply CONFIRM and we will prepare the same refill${
        payload.delivery_address_saved ? " for your saved address" : ""
      }.`;
      cta = "binary_confirm_cancel";
    } else if (
      kind.includes("lapsed") ||
      kind === "trial_followup" ||
      kind === "wedding_package_followup"
    ) {
      body = `Hi ${name}, ${merchant.identity.name} here. ${
        payload.days_since_last_visit
          ? `It has been ${payload.days_since_last_visit} days since your last visit.`
          : "Following up on your recent interest."
      } ${offer ? `${offer} is currently available. ` : ""}${localizedAsk(
        language,
        "Would you like us to hold a convenient slot?",
        "Kya hum aapke liye convenient slot hold karein?"
      )}`;
    } else {
      body = `Hi ${name}, ${merchant.identity.name} here. A quick update about ${clean(
        payload.metric_or_topic || kind
      )}. Reply YES if you would like us to take care of the next step.`;
    }
  } else if (
    kind === "research_digest" ||
    kind === "regulation_change" ||
    kind === "cde_opportunity"
  ) {
    body = `${who}, ${
      digest?.title || clean(payload.title || "a new category update")
    }. ${digest?.summary || clean(payload.summary)}${
      digest?.source ? ` — ${digest.source}.` : ""
    } Want me to turn this into one practical customer message for ${
      merchant.identity.name
    }?`;
    cta = "open_ended";
  } else if (kind.includes("perf_dip")) {
    const raw = Number(
      payload.delta_pct ?? merchant.performance?.delta_7d?.views_pct ?? 0
    );
    const pct = Math.abs(raw * 100);
    body = `${who}, ${clean(payload.metric || "views")} are down ${pct.toFixed(
      0
    )}% over ${clean(payload.window || "the last 7 days")}. ${
      payload.is_expected_seasonal
        ? "This matches the recorded seasonal pattern, so I would not increase acquisition spend yet."
        : "This is worth addressing before the trend compounds."
    } Want me to draft the highest-impact recovery action?`;
  } else if (kind === "perf_spike" || kind === "milestone_reached") {
    const detail =
      kind === "perf_spike"
        ? `${clean(payload.metric || "performance")} is up ${(
            Number(payload.delta_pct || 0) * 100
          ).toFixed(0)}%`
        : `${clean(payload.metric || "performance")} is at ${
            payload.value_now
          }, near ${payload.milestone_value}`;
    body = `${who}, a good signal: ${detail}. Want me to turn that momentum into a Google Business post?`;
  } else if (kind === "active_planning_intent") {
    cta = "binary_confirm_cancel";
    body = `${who}, I picked up your ${clean(
      payload.intent_topic || "campaign"
    )} plan. I will draft the offer, customer copy, and Google Business post using your current business data. Reply CONFIRM and I will prepare the launch pack now.`;
  } else if (kind === "review_theme_emerged") {
    body = `${who}, ${payload.occurrences_30d} recent reviews mention “${clean(
      payload.theme
    )}”${
      payload.common_quote ? `; one says “${payload.common_quote}”` : ""
    }. Want me to draft a response and one operating fix?`;
  } else if (kind === "renewal_due") {
    body = `${who}, your ${payload.plan} plan has ${
      payload.days_remaining
    } days left${
      payload.renewal_amount
        ? ` and renews at ${money(payload.renewal_amount)}`
        : ""
    }. Want a one-page impact summary before you decide?`;
  } else if (kind === "supply_alert") {
    body = `${who}, urgent stock alert for ${payload.molecule}: batches ${(
      payload.affected_batches || []
    ).join(" and ")} from ${payload.manufacturer}. Want me to draft the customer notice and replacement workflow now?`;
    cta = "binary_confirm_cancel";
  } else if (kind === "ipl_match_today") {
    body = `${who}, ${payload.match} starts at ${clean(
      payload.match_time_iso
    ).slice(11, 16)} today. ${
      offer
        ? `${offer} can be the lead offer`
        : "A delivery-first message is the safer play"
    }. Want the WhatsApp and Instagram copy?`;
  } else if (kind === "competitor_opened") {
    body = `${who}, ${payload.competitor_name} opened ${
      payload.distance_km
    } km away${
      payload.their_offer ? ` with ${payload.their_offer}` : ""
    }. Your profile can answer this with stronger proof rather than a price war. Want the three changes I would make?`;
  } else if (kind === "curious_ask_due") {
    cta = "open_ended";
    body = `${who}, quick operator check: what service has been requested most this week at ${merchant.identity.name}? I will turn your answer into a Google Business post and a ready customer reply.`;
  } else if (kind === "gbp_unverified") {
    body = `${who}, ${merchant.identity.name} is still marked unverified, which can delay profile updates. Want the shortest verification checklist for your current profile?`;
  } else if (kind === "dormant_with_vera") {
    body = `${who}, we have not worked on ${merchant.identity.name} together for ${clean(
      payload.days_since_last_engagement || "several"
    )} days. ${offer ? `Your active offer is ${offer}. ` : ""}Want one concrete growth action based on the latest profile data?`;
  } else {
    body = `${who}, a new ${clean(kind)} signal is available for ${
      merchant.identity.name
    }. ${offer ? `Your active offer is ${offer}. ` : ""}Want me to prepare one grounded next action?`;
  }

  const customerId = customer?.customer_id || trigger.customer_id || null;
  return {
    conversation_id: `conv_${merchant.merchant_id}_${trigger.id}`.replace(
      /[^a-zA-Z0-9_]/g,
      "_"
    ),
    merchant_id: merchant.merchant_id,
    customer_id: customerId,
    send_as: customerId ? "merchant_on_behalf" : "vera",
    trigger_id: trigger.id,
    template_name: customerId
      ? "merchant_contextual_outreach_v1"
      : "vera_merchant_signal_v1",
    template_params: [
      customer?.identity?.name || who,
      merchant.identity.name,
      kind
    ],
    body: body.replace(/\s+/g, " ").trim(),
    cta,
    suppression_key:
      trigger.suppression_key || `${kind}:${merchant.merchant_id}`,
    rationale: `Grounded ${kind} response using ${category.slug} category, latest merchant state${
      customerId ? ", customer relationship and recorded consent" : ""
    }.`
  };
}

function executionArtifact(bundle: GroundingBundle) {
  const { merchant, trigger, customer } = bundle;
  const offer = activeOffer(merchant);
  const kind = trigger.kind;
  const payload = trigger.payload || {};

  if (kind.includes("perf_dip")) {
    return `Recovery draft: refresh the Google Business post around ${
      offer || "the strongest current service"
    }, update the primary profile proof, and review calls after seven days.`;
  }
  if (kind === "research_digest" || kind === "regulation_change") {
    return `Customer-message draft: “A relevant ${clean(
      kind
    )} update is available from ${merchant.identity.name}. Reply if you would like the practical summary.”`;
  }
  if (kind === "review_theme_emerged") {
    return `Review-response draft: “Thank you for flagging ${clean(
      payload.theme
    )}. We are reviewing this with the team and will improve the experience.”`;
  }
  if (kind === "renewal_due") {
    return `Impact-summary draft: ${merchant.performance?.views || 0} profile views, ${
      merchant.performance?.calls || 0
    } calls, and ${merchant.performance?.directions || 0} direction requests in the current performance window.`;
  }
  if (kind === "recall_due" && customer) {
    return `Recall confirmation draft for ${customer.identity?.name}: ${
      offer || clean(payload.service_due || "follow-up")
    } with the recorded available slots.`;
  }
  if (kind === "chronic_refill_due" && customer) {
    return `Refill confirmation draft for ${customer.identity?.name}: ${(
      payload.molecule_list || []
    ).join(", ")}${
      payload.delivery_address_saved ? " using the saved delivery address" : ""
    }.`;
  }
  if (kind === "active_planning_intent" || kind.includes("festival")) {
    return `Campaign draft: lead with ${
      offer || clean(payload.intent_topic || "the merchant's current service")
    }, use one WhatsApp CTA, and prepare one Google Business post for approval.`;
  }
  return `Action draft: use ${
    offer || "the latest merchant profile context"
  } to address the ${clean(kind)} signal, with nothing published until approval.`;
}

export function composeExecutionReply(
  bundle: GroundingBundle,
  language: ConversationLanguage
): ReplyResult {
  const artifact = executionArtifact(bundle);
  const body =
    language === "en"
      ? `Done — I have moved to action mode. ${artifact} Reply CONFIRM to approve this draft; nothing will be published before approval.`
      : `Done — action mode start kar diya. ${artifact} Approve karne ke liye CONFIRM reply kijiye; approval se pehle kuch publish nahi hoga.`;
  return {
    action: "send",
    body,
    cta: "binary_confirm_cancel",
    rationale: `Explicit commitment advanced directly to a ${bundle.trigger.kind} execution artifact using the latest contexts.`
  };
}

export function composeContextualReply(
  bundle: GroundingBundle,
  language: ConversationLanguage,
  intent: ConversationRecord["intent"]
): ReplyResult {
  const { merchant, trigger } = bundle;
  const offer = activeOffer(merchant);
  const anchor =
    offer ||
    (trigger.payload?.metric
      ? clean(trigger.payload.metric)
      : clean(trigger.kind));
  const body =
    language === "en"
      ? `I have added that to the ${clean(
          trigger.kind
        )} context for ${merchant.identity.name}. The next step will use ${anchor}. Shall I prepare the draft for your approval?`
      : `Maine yeh detail ${merchant.identity.name} ke ${clean(
          trigger.kind
        )} context mein add kar di hai. Next step ${anchor} use karega. Kya main approval ke liye draft bana doon?`;
  return {
    action: "send",
    body,
    cta: "binary_yes_no",
    rationale: `${intent} acknowledged and reduced to one grounded next-step commitment.`
  };
}
