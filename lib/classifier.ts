import type {
  ConversationIntent,
  ConversationLanguage,
  ConversationRecord
} from "./types";

const AUTO_REPLY_PHRASES = [
  "thank you for contacting",
  "thanks for contacting",
  "we will respond shortly",
  "will get back to you",
  "automated assistant",
  "automatic reply",
  "auto reply",
  "business hours are",
  "away right now",
  "currently unavailable",
  "out of office",
  "sent from whatsapp business",
  "i am driving",
  "i'm driving",
  "cannot respond right now",
  "team tak pahuncha",
  "automated message"
];

const HINDI_MARKERS = [
  "haan",
  "nahi",
  "nahin",
  "kya",
  "kar do",
  "chahiye",
  "abhi",
  "baad mein",
  "dhanyavaad",
  "shukriya",
  "mujhe",
  "aap",
  "hai",
  "theek"
];

export function normalizeMessage(message: string) {
  return message
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAutoReply(message: string) {
  const text = normalizeMessage(message);
  return AUTO_REPLY_PHRASES.some((phrase) => text.includes(phrase));
}

export function isOptOut(message: string) {
  return /\b(stop|unsubscribe|not interested|don'?t message|do not message|no more|remove me|useless spam|band karo|message mat karo|nahi chahiye)\b/i.test(
    message
  );
}

export function isCommitment(message: string) {
  return /\b(yes|confirm|go ahead|let'?s do it|lets do it|proceed|start|do it|join|enroll|activate|launch|haan|ha|kar do|shuru karo|theek hai)\b/i.test(
    message
  );
}

export function isDeferral(message: string) {
  return /\b(later|busy|tomorrow|next week|call me later|not now|baad mein|kal|abhi busy)\b/i.test(
    message
  );
}

export function isHostile(message: string) {
  return /\b(idiot|stupid|shut up|fuck|fucking|bullshit|harass|bakwas|bewakoof|gaali)\b/i.test(
    message
  );
}

export function isOffTopic(message: string) {
  return /\b(gst|tax filing|income tax|legal case|court case|passport|loan application|stock tip|crypto)\b/i.test(
    message
  );
}

export function isQuestion(message: string) {
  return (
    message.includes("?") ||
    /\b(what|why|how|when|where|which|can you|could you|kya|kaise|kab|kyun)\b/i.test(
      message
    )
  );
}

export function detectLanguage(
  message: string,
  merchant?: Record<string, any>,
  customer?: Record<string, any>
): ConversationLanguage {
  const preferred = String(customer?.identity?.language_pref || "").toLowerCase();
  if (preferred.includes("mix")) return "hinglish";
  if (preferred === "hi" || preferred.includes("hindi")) return "hi";

  const normalized = normalizeMessage(message);
  const hasDevanagari = /[\u0900-\u097f]/.test(message);
  const hindiMarkers = HINDI_MARKERS.filter((word) =>
    normalized.split(" ").includes(word)
  ).length;
  const merchantLanguages = merchant?.identity?.languages || [];

  if (hasDevanagari) return "hi";
  if (hindiMarkers >= 2) return "hinglish";
  if (merchantLanguages.includes("hi") && hindiMarkers >= 1) return "hinglish";
  return "en";
}

export function classifyIntent(
  message: string,
  conversation?: ConversationRecord
): {
  intent: ConversationIntent;
  normalized: string;
  repeated: boolean;
} {
  const normalized = normalizeMessage(message);
  const repeated =
    Boolean(normalized) &&
    normalized === conversation?.lastInboundNormalized;

  if (isOptOut(message)) return { intent: "opt_out", normalized, repeated };
  if (isAutoReply(message) || repeated) {
    return { intent: "auto_reply", normalized, repeated };
  }
  if (isHostile(message)) return { intent: "hostile", normalized, repeated };
  if (isOffTopic(message)) return { intent: "off_topic", normalized, repeated };
  if (isDeferral(message)) return { intent: "deferral", normalized, repeated };
  if (isCommitment(message)) {
    return { intent: "commitment", normalized, repeated };
  }
  if (isQuestion(message)) return { intent: "question", normalized, repeated };
  if (/\b(no|not sure|too expensive|won'?t work|nahi|mehenga)\b/i.test(message)) {
    return { intent: "objection", normalized, repeated };
  }
  return { intent: "unknown", normalized, repeated };
}
