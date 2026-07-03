"""Generate and validate the 30-line legacy submission.jsonl artifact."""

from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from bot import compose  # noqa: E402

GENERATED = ROOT / "dataset" / "generated"
OUTPUT = ROOT / "submission.jsonl"
REQUIRED = {"body", "cta", "send_as", "suppression_key", "rationale"}
CTA_VALUES = {"binary_yes_no", "binary_confirm_cancel", "open_ended", "none"}


def load(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    pair_file = GENERATED / "test_pairs.json"
    if not pair_file.exists():
        raise SystemExit(
            "Missing generated dataset. Run: "
            "python dataset/generate_dataset.py --seed-dir dataset --out dataset/generated"
        )

    pairs = load(pair_file)["pairs"]
    if len(pairs) != 30:
        raise SystemExit(f"Expected exactly 30 test pairs, found {len(pairs)}")

    results = []
    for pair in pairs:
        merchant = load(GENERATED / "merchants" / f"{pair['merchant_id']}.json")
        trigger = load(GENERATED / "triggers" / f"{pair['trigger_id']}.json")
        category = load(
            GENERATED / "categories" / f"{merchant['category_slug']}.json"
        )
        customer = (
            load(GENERATED / "customers" / f"{pair['customer_id']}.json")
            if pair.get("customer_id")
            else None
        )
        result = compose(category, merchant, trigger, customer)
        missing = REQUIRED - result.keys()
        if missing:
            raise SystemExit(f"{pair['test_id']} missing fields: {sorted(missing)}")
        if result["cta"] not in CTA_VALUES:
            raise SystemExit(f"{pair['test_id']} has invalid CTA: {result['cta']}")
        if result["send_as"] not in {"vera", "merchant_on_behalf"}:
            raise SystemExit(
                f"{pair['test_id']} has invalid send_as: {result['send_as']}"
            )
        if not result["body"].strip():
            raise SystemExit(f"{pair['test_id']} has an empty body")
        results.append({"test_id": pair["test_id"], **result})

    if len({item["test_id"] for item in results}) != 30:
        raise SystemExit("Test IDs are not unique")

    with OUTPUT.open("w", encoding="utf-8", newline="\n") as handle:
        for item in results:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Wrote and validated {len(results)} records to {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
