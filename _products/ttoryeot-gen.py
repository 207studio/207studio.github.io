"""Render the 또렷 desktop section of the home page from _products/ttoryeot-desktop.json.

Usage: python3 _products/ttoryeot-gen.py [--preview]
Rewrites the block between <!-- ttoryeot:start --> and <!-- ttoryeot:end --> in index.html and
ko/index.html. Media that is still null is drawn as a labelled placeholder only with --preview;
without it the script stops, so a placeholder cannot reach the live site.
"""
import json
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "_products/ttoryeot-desktop.json"
MEDIA = "/assets/apps/ttoryeot/desktop/"
PREVIEW = "--preview" in sys.argv[1:]
PENDING = {"en": "Pending from 예나", "ko": "예나가 만드는 중"}


def media(src, what):
    if src is None:
        if not PREVIEW:
            raise SystemExit(f"{what} is still missing; add it or run with --preview")
        return None
    if not src.startswith(MEDIA) or not (ROOT / src.lstrip("/")).is_file():
        raise SystemExit(f"missing or misplaced file: {src}")
    return src


def downloads(data, lang):
    items = data["downloads"]
    first = items[0]
    rows = "".join(
        f'<li><a href="{escape(d["href"])}" data-tt-os="{d["os"]}" data-tt-button="{escape(d["button"][lang])}">'
        f'<b>{escape(d["name"][lang])}</b><span>{escape(d["detail"][lang])}</span></a>'
        + (f'<p class="tt-dl-note">{escape(d["note"][lang])}</p>' if d.get("note") else "")
        + "</li>"
        for d in items)
    return (f'<div class="tt-dl" data-tt-dl>'
            f'<a class="btn btn-primary tt-dl-main" data-tt-main href="{escape(first["href"])}">'
            f'<span data-tt-label>{escape(first["button"][lang])}</span> <span class="btn-arrow" aria-hidden="true">↓</span></a>'
            f'<details class="tt-dl-more"><summary>{escape(data["more"][lang])}</summary><ul>{rows}</ul></details>'
            f'</div>')


def video(data, lang):
    v = data.get("video")
    if not v:
        return ""
    src, poster = media(v["src"], "the demo video"), media(v["poster"], "the demo video poster")
    caption = f'<figcaption>{escape(v["caption"][lang])}</figcaption>'
    if src is None or poster is None:
        return f'<figure class="tt-video"><div class="tt-ph" style="aspect-ratio:{v["width"]}/{v["height"]}">{PENDING[lang]} · video</div>{caption}</figure>'
    return (f'<figure class="tt-video"><video controls playsinline preload="none" width="{v["width"]}" height="{v["height"]}" poster="{escape(poster)}">'
            f'<source src="{escape(src)}" type="video/mp4"></video>{caption}</figure>')


def shots(data, lang):
    if not data["shots"]:
        return ""
    out = []
    one = len(data["shots"]) == 1
    sizes = "(max-width: 900px) 92vw, (max-width: 1250px) 45vw, 592px" if one and not data.get("video") else (
        "(max-width: 900px) 92vw, 900px" if one else "(max-width: 900px) 92vw, 33vw")
    for s in data["shots"]:
        src = media(s["src"], "a screenshot")
        alt = escape(s["alt"][lang])
        if src is None:
            out.append(f'<li><div class="tt-ph" style="aspect-ratio:16/10">{PENDING[lang]} · {alt}</div></li>')
        else:
            small = src.replace("-1200.", "-720.")
            dims = f' width="{s["w"]}" height="{s["h"]}"' if s.get("w") and s.get("h") else ""
            out.append(f'<li><img src="{escape(small)}" srcset="{escape(small)} 720w, {escape(src)} 1200w" sizes="{sizes}"{dims} alt="{alt}" loading="lazy" decoding="async"></li>')
    cls = "tt-shots" + (" tt-shots-one" if len(data["shots"]) == 1 else "")
    return f'<ul class="{cls}">{"".join(out)}</ul>'


def render(data, lang):
    o = data["open_source"]
    points = "".join(f"<li>{escape(p[lang])}</li>" for p in data["points"])
    links = "".join(f'<a class="text-link" href="{escape(l["href"])}">{escape(l[lang])} <span aria-hidden="true">↗</span></a>'
                    for l in o["links"])
    film, stills = video(data, lang), shots(data, lang)
    # With a video the screenshots go underneath it; without one the screenshot takes the right column.
    # With neither, the copy stands alone in one column.
    side = film or stills
    layout = "" if film else (" tt-solo" if stills else " tt-text")
    below = stills if film else ""
    return (f'  <section class="tt" id="ttoryeot" aria-labelledby="tt-title">\n'
            f'    <div class="wrap">\n'
            f'      <p class="eyebrow">{escape(data["eyebrow"][lang])}</p>\n'
            f'      <h2 id="tt-title">{escape(data["title"][lang])}</h2>\n'
            f'      <div class="tt-body{layout}">\n'
            f'        <div class="tt-copy"><p class="tt-lead">{escape(data["lead"][lang])}</p><ul class="tt-points">{points}</ul>'
            f'{downloads(data, lang)}'
            f'<p class="tt-oss">{escape(o[lang])} {links}</p></div>\n'
            + (f'        {side}\n' if side else '')
            + f'      </div>\n'
            + (f'      {below}\n' if below else '')
            + f'    </div>\n'
            f'  </section>\n')


def write(path, lang, data):
    text = path.read_text(encoding="utf-8")
    start, end = "  <!-- ttoryeot:start -->\n", "  <!-- ttoryeot:end -->"
    i, j = text.index(start) + len(start), text.index(end)
    path.write_text(text[:i] + render(data, lang) + text[j:], encoding="utf-8")
    print("wrote", path.relative_to(ROOT), "(preview)" if PREVIEW else "")


data = json.loads(DATA.read_text(encoding="utf-8"))
write(ROOT / "index.html", "en", data)
write(ROOT / "ko/index.html", "ko", data)
