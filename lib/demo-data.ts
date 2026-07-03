import fs from "node:fs";
import path from "node:path";

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"));
}

export function getDemoData() {
  const merchants = readJson("dataset/merchants_seed.json").merchants;
  const customers = readJson("dataset/customers_seed.json").customers;
  const triggers = readJson("dataset/triggers_seed.json").triggers;
  const categoryFiles = fs.readdirSync(path.join(process.cwd(), "dataset/categories"));
  const categories = categoryFiles.map((file) => readJson(`dataset/categories/${file}`));

  const engaged = merchants.filter((merchant: any) =>
    merchant.signals.some((signal: string) => signal.includes("engaged") || signal.includes("high_engagement"))
  ).length;
  const totalViews = merchants.reduce((sum: number, merchant: any) => sum + merchant.performance.views, 0);
  const totalCalls = merchants.reduce((sum: number, merchant: any) => sum + merchant.performance.calls, 0);
  const conversationTurns = merchants.reduce(
    (sum: number, merchant: any) => sum + (merchant.conversation_history?.length || 0),
    0
  );
  const consentedCustomers = customers.filter(
    (customer: any) => customer.consent?.opted_in_at && customer.preferences?.reminder_opt_in !== false
  ).length;
  const activeMerchants = merchants.filter((merchant: any) => merchant.subscription?.status === "active").length;

  return {
    source: {
      kind: "synthetic_seed",
      label: "Bundled challenge seed data",
      live: false
    },
    metrics: {
      activeMerchants,
      conversations: conversationTurns,
      automationRate: triggers.length ? Math.round((triggers.filter((trigger: any) => trigger.merchant_id).length / triggers.length) * 100) : 0,
      activeTriggers: triggers.length,
      consentedCustomers,
      totalViews,
      totalCalls,
      engagementRate: Math.round((engaged / merchants.length) * 100)
    },
    merchants,
    customers,
    triggers,
    categories: categories.map((category: any) => ({
      slug: category.slug,
      display_name: category.display_name,
      tone: category.voice.tone,
      offers: category.offer_catalog.length,
      digest: category.digest.length
    }))
  };
}
