const REQUIRED_SCOPES: Record<string, string[]> = {
  recall_due: ["recall_reminders", "recall_alerts"],
  appointment_tomorrow: ["appointment_reminders"],
  chronic_refill_due: ["refill_reminders"],
  wedding_package_followup: [
    "bridal_package_followup",
    "promotional_offers"
  ],
  customer_lapsed_hard: ["winback_offers"],
  winback_eligible: ["winback_offers"],
  trial_followup: [
    "program_updates",
    "treatment_followup",
    "kids_program_updates"
  ]
};

export function customerConsentAllows(
  trigger: Record<string, any>,
  customer?: Record<string, any>
) {
  if (trigger.scope !== "customer") return true;
  if (!customer || customer.customer_id !== trigger.customer_id) return false;
  if (customer.merchant_id !== trigger.merchant_id) return false;
  if (!customer.consent?.opted_in_at) return false;
  if (customer.preferences?.reminder_opt_in === false) return false;

  const granted = new Set<string>(customer.consent?.scope || []);
  const required = REQUIRED_SCOPES[trigger.kind];
  if (required) return required.some((scope) => granted.has(scope));

  // Unknown customer outreach fails closed unless the payload explicitly
  // declares a consent scope that the customer granted.
  const declared = trigger.payload?.required_consent_scope;
  return typeof declared === "string" && granted.has(declared);
}
