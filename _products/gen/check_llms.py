"""Verify llms.txt against site-data.json without running the Rust generator.

Usage: python3 _products/gen/check_llms.py [--write]
--write rewrites the Products block from data (keeps the rest of the file).
With no products in site-data.json, llms.txt must have no Products block.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "_products/site-data.json").read_text(encoding="utf-8"))
LLMS = ROOT / "llms.txt"


def products_block() -> str:
    lines = []
    for product in DATA["products"]:
        prices = " / ".join(f"{t['name']} ${t['price_usd']}" for t in product["tiers"])
        url = f"{DATA['base_url']}/products/{product['slug']}/"
        lines.append(f"- [{product['name']}]({url}): {product['summary']} Prices: {prices}.\n")
    return "".join(lines)


def main() -> int:
    text = LLMS.read_text(encoding="utf-8")
    if not DATA["products"]:
        # No products on sale: llms.txt must not carry a Products block at all.
        if "## Products" in text:
            print("drift: site-data.json has no products but llms.txt has a Products block")
            return 1
        print("ok: no products in site-data.json or llms.txt")
        return 0
    start = text.index("## Products")
    end = text.index("\n## ", start + 3) + 1
    actual = text[start:end]
    expected = "## Products\n\n" + products_block() + "\n"
    if "--write" in sys.argv:
        LLMS.write_text(text[:start] + expected + text[end:], encoding="utf-8")
        print("wrote llms.txt")
        return 0
    if actual != expected:
        print("drift: run python3 _products/gen/check_llms.py --write")
        return 1
    print("ok: llms.txt products match site-data.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
