"""Render the home page walk (index.html, ko/index.html) from _products/apps.json.

Usage: python3 _products/walk-gen.py
Rewrites the <ol data-walk-track> list. Run it after
any edit to apps.json, e.g. renaming an app.
"""
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPS = json.loads((ROOT / "_products/apps.json").read_text(encoding="utf-8"))["apps"]


def link_attrs(href):
    return f' href="{escape(href)}" target="_blank" rel="noopener"' if href.startswith("http") else f' href="{escape(href)}"'


def href_for(target, lang):
    return target.get("href_" + lang, target["href"])


def stop(app, i, lang):
    """One walk stop, linking only to its consolidated project home."""
    n = f"{i + 1:02d}"
    poster = []
    if app.get("icon"):
        poster.append(f'<img class="poster-icon" src="{app["icon"]}" width="84" height="84" alt="" loading="lazy" decoding="async">')
    poster.append(f'<p class="poster-head"><span class="poster-tag"><span class="poster-n">{n}</span>{escape(app["tag"][lang])}</span>'
                  f'<span class="poster-name">{escape(app["name"][lang])}</span></p>')
    link = app['page']
    acts = [f'<a class="act act-main"{link_attrs(href_for(link, lang))}>{escape(link[lang])} <span aria-hidden="true">→</span></a>']
    poster.append(f'<p class="poster-acts">{"".join(acts)}</p>')
    poster.append(f'<p class="poster-desc">{escape(app["line"][lang])}</p>')
    shot = app.get("shot")
    if shot:
        poster.append(f'<img class="poster-shot" src="{shot["src"]}-1200.webp" srcset="{shot["src"]}-720.webp 720w, {shot["src"]}-1200.webp 1200w" '
                      f'sizes="(max-width: 900px) calc(100vw - 72px), 724px" width="{shot["w"]}" height="{shot["h"]}" alt="{escape(shot["alt"][lang])}" loading="lazy" decoding="async">')
    focus = "" if acts else ' tabindex="0"'
    lines = [f'<div class="poster"{focus}>', *("  " + p for p in poster), "</div>"]
    on = " is-on" if i == 0 else ""
    inner = "".join(f"            {line}\n" for line in lines)
    return f'          <li class="stop{on}" data-stop data-say="{escape(app["say"][lang])}">\n{inner}          </li>\n'


def render(path, lang):
    text = path.read_text(encoding="utf-8")
    items = "".join(stop(a, i, lang) for i, a in enumerate(APPS))
    text, k = re.subn(r'(<ol class="walk-track" data-walk-track>\n).*?(\s*</ol>)', lambda m: m.group(1) + items.rstrip("\n") + m.group(2), text, flags=re.S)
    assert k == 1, path
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


render(ROOT / "index.html", "en")
render(ROOT / "ko/index.html", "ko")
