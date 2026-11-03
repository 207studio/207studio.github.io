"""Render the home page comparison (Hancom 한글 vs Ttoryeot) from _products/compare.json.

Usage: python3 _products/compare-gen.py [compare.json]
Rewrites the block between <!-- compare:start --> and <!-- compare:end --> in index.html
and ko/index.html. With no samples the block is left empty, so nothing unverified is shown.
Every sample must name existing files, and its two renders must be the same pixel size.
"""
import json
import struct
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_products/compare.json"
T = {
    "eyebrow": {"en": "Ttoryeot, side by side", "ko": "또렷, 나란히 보기"},
    "title": {"en": "The same file, opened in 한글 and in Ttoryeot.", "ko": "같은 파일을 한글과 또렷으로 열었어요."},
    "hint": {"en": "Tap or click a spot on either page to see the same spot up close on both.", "ko": "어느 쪽이든 한 곳을 누르면 양쪽의 같은 자리를 크게 보여 줘요."},
    "lens": {"en": "Up close", "ko": "크게 보기"},
    "full": {"en": "Full size", "ko": "원본 크기"},
    "page": {"en": "page", "ko": "쪽"},
    "file": {"en": "Sample file (.hwpx)", "ko": "예시 파일(.hwpx)"},
    "pdf": {"en": "PDF", "ko": "PDF"},
    "how": {"en": "How these were made", "ko": "만든 방법"},
}


def image_size(path):
    data = path.read_bytes()[:64]
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", data[16:24])
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        if data[12:16] == b"VP8X":
            return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
        if data[12:16] == b"VP8 ":
            w, h = struct.unpack("<HH", data[26:30])
            return w & 0x3FFF, h & 0x3FFF
        if data[12:16] == b"VP8L":
            b = int.from_bytes(data[21:25], "little")
            return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    raise SystemExit(f"{path}: only PNG or WebP renders are supported")


def site_file(src):
    path = ROOT / src.lstrip("/")
    if not src.startswith("/assets/apps/ttoryeot/compare/") or not path.is_file():
        raise SystemExit(f"missing or misplaced file: {src}")
    return path


def side(key, sample, data, lang, size):
    who = data[key]
    label = (f'<b>{escape(who["label"][lang])}</b> <span>{escape(who["version"][lang])}</span>'
             f'<span class="compare-made">{escape(who["made"][lang])}</span>')
    alt = f'{who["label"][lang]} {who["version"][lang]}: {sample["title"][lang]}, {T["page"][lang]} {sample["page"]}'
    w, h = size
    return (f'<figure class="compare-side" data-side="{key}">'
            f'<figcaption>{label}</figcaption>'
            f'<div class="compare-shot"><img src="{escape(sample[key])}" width="{w}" height="{h}" alt="{escape(alt)}" loading="lazy" decoding="async"></div>'
            f'<p class="compare-links"><a href="{escape(sample[key])}" target="_blank" rel="noopener">{T["full"][lang]} <span aria-hidden="true">↗</span></a>'
            f'<a href="{escape(sample[key + "_pdf"])}" target="_blank" rel="noopener">{T["pdf"][lang]} <span aria-hidden="true">↗</span></a></p>'
            f'</figure>')


def render(data, lang):
    samples = data.get("samples") or []
    if not samples:
        return ""
    out = []
    for s in samples:
        a, b = image_size(site_file(s["hancom"])), image_size(site_file(s["ttoryeot"]))
        if a != b:
            raise SystemExit(f'{s["id"]}: renders differ in size {a} vs {b}; export both at the same pixel size')
        for k in ("file", "hancom_pdf", "ttoryeot_pdf"):
            site_file(s[k])
        fx, fy = s["focus"]
        out.append(f'<div class="compare-page" data-compare-page data-focus="{fx} {fy}" data-n="{escape(s["id"])}">'
                   f'<p class="compare-doc">{escape(s["title"][lang])} · {s["page"]} {T["page"][lang]} '
                   f'<a class="text-link" href="{escape(s["file"])}" download>{T["file"][lang]} <span aria-hidden="true">↓</span></a></p>'
                   f'<div class="compare-pair" tabindex="0" aria-describedby="compare-hint">{side("hancom", s, data, lang, a)}{side("ttoryeot", s, data, lang, b)}</div>'
                   f'</div>')
    lens = (f'<div class="compare-lens" data-compare-lens aria-hidden="true">'
            f'<p class="compare-lens-h">{T["lens"][lang]}</p>'
            f'<div class="compare-lens-pair"><div class="compare-lens-pane" data-pane="hancom"><span>{escape(data["hancom"]["label"][lang])}</span></div>'
            f'<div class="compare-lens-pane" data-pane="ttoryeot"><span>{escape(data["ttoryeot"]["label"][lang])}</span></div></div></div>')
    tabs = ""
    if len(samples) > 1:
        tabs = '<p class="compare-tabs" data-compare-tabs>' + "".join(
            f'<button type="button" data-n="{escape(s["id"])}">{escape(s["title"][lang])}</button>' for s in samples) + "</p>"
    return (f'  <section class="compare" id="compare" aria-labelledby="compare-title" data-compare>\n'
            f'    <div class="wrap">\n'
            f'      <p class="eyebrow">{T["eyebrow"][lang]}</p>\n'
            f'      <h2 id="compare-title">{T["title"][lang]}</h2>\n'
            f'      <p class="compare-meta">{escape(data["caption"][lang])}</p>\n'
            f'      <div class="compare-body">\n'
            f'        <div class="compare-pages">{tabs}{"".join(out)}</div>\n'
            f'        <div class="compare-aside"><p class="compare-hint" id="compare-hint">{T["hint"][lang]}</p>{lens}</div>\n'
            f'      </div>\n'
            f'      <details class="compare-how"><summary>{T["how"][lang]}</summary><p>{escape(data["method"][lang])}</p></details>\n'
            f'    </div>\n'
            f'  </section>\n')


def write(path, lang, data):
    text = path.read_text(encoding="utf-8")
    start, end = "  <!-- compare:start -->\n", "  <!-- compare:end -->"
    i, j = text.index(start) + len(start), text.index(end)
    path.write_text(text[:i] + render(data, lang) + text[j:], encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


data = json.loads(DATA.read_text(encoding="utf-8"))
write(ROOT / "index.html", "en", data)
write(ROOT / "ko/index.html", "ko", data)
