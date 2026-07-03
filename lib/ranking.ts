import { recentOutboundCount } from "./store";

const SPECIFIC_TRIGGER_BONUS = new Set([
  "supply_alert",
  "regulation_change",
  "recall_due",
  "chronic_refill_due",
  "perf_dip",
  "perf_spike",
  "renewal_due",
  "review_theme_emerged",
  "active_planning_intent"
]);

export function scoreTrigger(
  trigger: Record<string, any>,
  merchant: Record<string, any>,
  deliveredAt: string,
  now: string
) {
  const urgency = Math.max(0, Math.min(5, Number(trigger.urgency) || 0));
  const nowMs = Date.parse(now);
  const deliveredMs = Date.parse(deliveredAt);
  const ageHours =
    Number.isFinite(nowMs) && Number.isFinite(deliveredMs)
      ? Math.max(0, (nowMs - deliveredMs) / 3_600_000)
      : 168;
  const freshness = Math.max(0, 10 - ageHours / 12);
  const engaged = (merchant.signals || []).some((signal: string) =>
    /engaged|high_engagement|intent/i.test(signal)
  );
  const specificity = SPECIFIC_TRIGGER_BONUS.has(trigger.kind) ? 6 : 0;
  const fatigue = recentOutboundCount(trigger.merchant_id, now) * 8;

  return urgency * 20 + freshness + (engaged ? 7 : 0) + specificity - fatigue;
}
