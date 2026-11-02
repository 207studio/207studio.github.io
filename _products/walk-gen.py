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
DOWNLOADS = {d["id"]: d for d in json.loads((ROOT / "_products/site-data.json").read_text(encoding="utf-8")).get("downloads", [])}
FOR = {"en": "For", "ko": "대상"}
DL = {"en": "Download for Mac", "ko": "Mac용 다운로드"}


def link_attrs(href):
    return f' href="{escape(href)}" target="_blank" rel="noopener"' if href.startswith("http") else f' href="{escape(href)}"'


def href_for(target, lang):
    return target.get("href_" + lang, target["href"])


def stop(app, i, lang):
    """One card: a cream sheet (icon, tag, name, actions, line, screenshot) over a night band
    (what it is, who it is for, points). The sheet is a grid, so CSS alone moves the actions
    below the screenshot on phones."""
    n = f"{i + 1:02d}"
    poster = []
    if app.get("icon"):
        poster.append(f'<img class="poster-icon" src="{app["icon"]}" width="84" height="84" alt="" loading="lazy" decoding="async">')
    poster.append(f'<p class="poster-head"><span class="poster-tag"><span class="poster-n">{n}</span>{escape(app["tag"][lang])}</span>'
                  f'<span class="poster-name">{escape(app["name"][lang])}</span></p>')
    acts = []
    link = app.get("link")
    if link:
        acts.append(f'<a class="act act-main"{link_attrs(href_for(link, lang))}>{escape(link[lang])} <span aria-hidden="true">↗</span></a>')
    dl = DOWNLOADS[app["download"]] if app.get("download") else None
    if dl:
        acts.append(f'<a class="act" href="{escape(dl["url"])}">{DL[lang]}</a><span class="act-req">{escape(dl["requires"][lang])}</span>')
    if acts:
        poster.append(f'<p class="poster-acts">{"".join(acts)}</p>')
    poster.append(f'<p class="poster-desc">{escape(app["line"][lang])}</p>')
    shot = app.get("shot")
    if shot:
        poster.append(f'<img class="poster-shot" src="{shot["src"]}-1200.webp" srcset="{shot["src"]}-720.webp 720w, {shot["src"]}-1200.webp 1200w" '
                      f'sizes="(max-width: 900px) calc(100vw - 72px), 724px" width="{shot["w"]}" height="{shot["h"]}" alt="{escape(shot["alt"][lang])}" loading="lazy" decoding="async">')
    focus = "" if acts else ' tabindex="0"'
    lines = [f'<div class="poster"{focus}>', *("  " + p for p in poster), "</div>"]
    if app.get("what"):
        note = [f'<p class="note-what">{escape(app["what"][lang])}</p>']
        if app.get("for"):
            note.append(f'<p class="note-for"><span class="note-k">{FOR[lang]}</span> {escape(app["for"][lang])}</p>')
        if app.get("points"):
            note.append('<ul class="note-pts">' + "".join(f"<li>{escape(p)}</li>" for p in app["points"][lang]) + "</ul>")
        if app.get("page"):
            note.append(f'<a class="note-go" href="{href_for(app["page"], lang)}">{escape(app["page"][lang])} <span aria-hidden="true">→</span></a>')
        lines += ['<div class="note">', *("  " + p for p in note), "</div>"]
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
