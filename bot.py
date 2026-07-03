"""Legacy deterministic compatibility entrypoint for the magicpin challenge.

The deployed Next.js HTTP API is the primary submission. This module preserves
the main brief's importable `compose(...)` contract for static evaluation.
"""

from __future__ import annotations

from typing import Any, Optional


def _clean(value: Any) -> str:
    return " ".join(str(value or "").replace("_", " ").split())


def _offer(merchant: dict) -> Optional[str]:
    for offer in merchant.get("offers", []):
        if offer.get("status") == "active":
            return offer.get("title")
    return None


def _who(category: dict, merchant: dict) -> str:
    identity = merchant.get("identity", {})
    owner = identity.get("owner_first_name")
    if category.get("slug") == "dentists" and owner:
        return f"Dr. {owner}"
    return owner or identity.get("name") or "there"


def _digest(category: dict, trigger: dict) -> Optional[dict]:
    payload = trigger.get("payload", {})
    item_id = (
        payload.get("top_item_id")
        or payload.get("digest_item_id")
        or payload.get("alert_id")
    )
    return next(
        (item for item in category.get("digest", []) if item.get("id") == item_id),
        None,
    )


def compose(
    category: dict,
    merchant: dict,
    trigger: dict,
    customer: Optional[dict] = None,
) -> dict:
    """Compose one grounded deterministic WhatsApp message."""

    kind = trigger.get("kind", "merchant_growth")
    payload = trigger.get("payload", {})
    merchant_name = merchant.get("identity", {}).get("name", "your business")
    who = _who(category, merchant)
    offer = _offer(merchant)
    cta = "binary_yes_no"

    if customer:
        name = customer.get("identity", {}).get("name", "there")
        preference = customer.get("identity", {}).get("language_pref", "en")
        mixed = "mix" in preference or preference == "hi"
        if kind == "recall_due":
            slots = [
                slot.get("label")
                for slot in payload.get("available_slots", [])
                if slot.get("label")
            ]
            last_visit = (
                f" after your last visit on {payload.get('last_service_date')}"
                if payload.get("last_service_date")
                else ""
            )
            slot_text = f" {', '.join(slots)} available." if slots else ""
            offer_text = f" {offer} is currently active." if offer else ""
            body = (
                f"Hi {name}, {merchant_name} here. Your "
                f"{_clean(payload.get('service_due') or 'follow-up')} is due"
                f"{last_visit}.{slot_text}{offer_text} "
                + (
                    "YES reply kijiye; hum suitable slot hold kar denge."
                    if mixed
                    else "Reply YES and we will hold a suitable slot."
                )
            )
        elif kind == "chronic_refill_due":
            cta = "binary_confirm_cancel"
            medicines = ", ".join(payload.get("molecule_list", []))
            runout = str(payload.get("stock_runs_out_iso", ""))[:10]
            body = (
                f"Namaste {name}, {merchant_name} here. Your {medicines} refill "
                f"is expected to run out on {runout}. "
                f"{f'{offer} is active. ' if offer else ''}"
                "Reply CONFIRM and we will prepare the same refill"
                f"{' for your saved address' if payload.get('delivery_address_saved') else ''}."
            )
        else:
            body = (
                f"Hi {name}, {merchant_name} here. Following up on "
                f"{_clean(kind)}. {f'{offer} is currently available. ' if offer else ''}"
                "Would you like us to prepare the next step?"
            )
    elif kind in {"research_digest", "regulation_change", "cde_opportunity"}:
        item = _digest(category, trigger) or {}
        title = item.get("title") or payload.get("title") or _clean(kind)
        summary = item.get("summary") or payload.get("summary") or ""
        source = f" — {item.get('source')}." if item.get("source") else ""
        cta = "open_ended"
        body = (
            f"{who}, {title}. {summary}{source} Want me to turn this into one "
            f"practical customer message for {merchant_name}?"
        )
    elif "perf_dip" in kind:
        raw = payload.get(
            "delta_pct",
            merchant.get("performance", {}).get("delta_7d", {}).get("views_pct", 0),
        )
        percentage = abs(float(raw or 0) * 100)
        body = (
            f"{who}, {_clean(payload.get('metric') or 'views')} are down "
            f"{percentage:.0f}% over {_clean(payload.get('window') or 'the last 7 days')}. "
            "Want me to draft the highest-impact recovery action?"
        )
    elif kind in {"perf_spike", "milestone_reached"}:
        if kind == "perf_spike":
            detail = (
                f"{_clean(payload.get('metric') or 'performance')} is up "
                f"{float(payload.get('delta_pct') or 0) * 100:.0f}%"
            )
        else:
            detail = (
                f"{_clean(payload.get('metric') or 'performance')} is at "
                f"{payload.get('value_now')}, near {payload.get('milestone_value')}"
            )
        body = f"{who}, a good signal: {detail}. Want a Google Business post draft?"
    elif kind == "active_planning_intent":
        cta = "binary_confirm_cancel"
        body = (
            f"{who}, I picked up your "
            f"{_clean(payload.get('intent_topic') or 'campaign')} plan. "
            "Reply CONFIRM and I will prepare the offer, customer copy, and "
            "Google Business post for approval."
        )
    elif kind == "review_theme_emerged":
        body = (
            f"{who}, {payload.get('occurrences_30d')} recent reviews mention "
            f"“{_clean(payload.get('theme'))}”. Want me to draft a response and "
            "one operating fix?"
        )
    elif kind == "renewal_due":
        body = (
            f"{who}, your {payload.get('plan')} plan has "
            f"{payload.get('days_remaining')} days left. "
            "Want a one-page impact summary before you decide?"
        )
    elif kind == "supply_alert":
        cta = "binary_confirm_cancel"
        batches = " and ".join(payload.get("affected_batches", []))
        body = (
            f"{who}, urgent stock alert for {payload.get('molecule')}: batches "
            f"{batches} from {payload.get('manufacturer')}. Want the customer "
            "notice and replacement workflow now?"
        )
    elif kind == "competitor_opened":
        body = (
            f"{who}, {payload.get('competitor_name')} opened "
            f"{payload.get('distance_km')} km away. Your profile can answer with "
            "stronger proof rather than a price war. Want the three changes?"
        )
    elif kind == "curious_ask_due":
        cta = "open_ended"
        body = (
            f"{who}, what service has been requested most this week at "
            f"{merchant_name}? I will turn the answer into a Google Business post."
        )
    else:
        body = (
            f"{who}, a new {_clean(kind)} signal is available for {merchant_name}. "
            f"{f'Your active offer is {offer}. ' if offer else ''}"
            "Want me to prepare one grounded next action?"
        )

    customer_id = (customer or {}).get("customer_id") or trigger.get("customer_id")
    return {
        "body": " ".join(body.split()),
        "cta": cta,
        "send_as": "merchant_on_behalf" if customer_id else "vera",
        "suppression_key": trigger.get("suppression_key")
        or f"{kind}:{merchant.get('merchant_id')}",
        "rationale": (
            f"Grounded {kind} response using {category.get('slug')} category, "
            f"latest merchant state"
            f"{', customer relationship and recorded consent' if customer_id else ''}."
        ),
    }
