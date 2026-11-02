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


def stop(app, i, lang):
    n = f"{i + 1:02d}"
    name = escape(app["name"][lang])
    note_id = f"walk-note-{i + 1}"
    link = app.get("link")
    href = link.get("href_" + lang, link["href"]) if link else None
    head = (f'<span class="poster-head"><span class="poster-tag"><span class="poster-n">{n}</span>{escape(app["tag"][lang])}</span>'
            f'<span class="poster-name">{name}</span></span>')
    body = f'<span class="poster-body"><span class="poster-desc">{escape(app["line"][lang])}</span>'
    dl = DOWNLOADS[app["download"]] if app.get("download") else None
    if dl:
        # Two links on one sheet, so the poster is a plain block rather than one big link.
        go = f'<a class="poster-go"{link_attrs(href)}>{escape(link[lang])} <span aria-hidden="true">↗</span></a>' if link else ""
        body += (f'<a class="dl-btn" href="{escape(dl["url"])}">{DL[lang]}</a>'
                 f'<span class="poster-req">{escape(dl["requires"][lang])}</span>{go}</span>')
        poster = f'<div class="poster poster-has-dl">{head}{body}</div>'
    elif link:
        body += f'<span class="poster-go">{escape(link[lang])} <span aria-hidden="true">↗</span></span></span>'
        poster = f'<a class="poster"{link_attrs(href)}>{head}{body}</a>'
    else:
        body += "</span>"
        poster = f'<div class="poster" tabindex="0" aria-describedby="{note_id}">{head}{body}</div>'
    note = [f'<p class="note-h" aria-hidden="true"><span class="poster-n">{n}</span>{name}</p>',
            f'<p class="note-what">{escape(app.get("what", app["line"])[lang])}</p>']
    if app.get("for"):
        note.append(f'<p class="note-for"><span class="note-k">{FOR[lang]}</span> {escape(app["for"][lang])}</p>')
    if app.get("points"):
        note.append('<ul class="note-pts">' + "".join(f"<li>{escape(p)}</li>" for p in app["points"][lang]) + "</ul>")
    if dl:
        note.append(f'<p class="note-dl"><a class="dl-btn" href="{escape(dl["url"])}">{DL[lang]}</a> <span class="note-req">{escape(dl["requires"][lang])}</span></p>')
        note.append(f'<p class="note-install">{escape(dl["install"][lang])}</p>')
    if link:
        note.append(f'<a class="note-go"{link_attrs(href)}>{escape(link[lang])} <span aria-hidden="true">↗</span></a>')
    on = " is-on" if i == 0 else ""
    thin = "" if app.get("what") else " note-thin"
    inner = "\n              ".join(note)
    return (f'          <li class="stop{on}" data-stop>\n            {poster}\n'
            f'            <div class="note{thin}" id="{note_id}">\n              {inner}\n            </div>\n          </li>\n')


def render(path, lang):
    text = path.read_text(encoding="utf-8")
    items = "".join(stop(a, i, lang) for i, a in enumerate(APPS))
    text, k = re.subn(r'(<ol class="walk-track" data-walk-track>\n).*?(\s*</ol>)', lambda m: m.group(1) + items.rstrip("\n") + m.group(2), text, flags=re.S)
    assert k == 1, path
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))


render(ROOT / "index.html", "en")
render(ROOT / "ko/index.html", "ko")
