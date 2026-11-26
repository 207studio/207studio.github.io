"""Render the home work lists from _products/apps.json.

Usage: python3 _products/walk-gen.py
"""

import sys
from html import escape

sys.dont_write_bytecode = True
from chrome import APPS, ROOT, href_for, link_attrs

LABELS = {
    "en": ("Available now", "In the workshop"),
    "ko": ("지금 받을 수 있는 앱", "만들고 있는 것들"),
}
START = "<!-- work:start -->"
END = "<!-- work:end -->"


def row(app, lang):
    name = app["name"][lang]
    icon = app.get("icon")
    if icon:
        tile = f'<span class="tile"><img src="{escape(icon)}" alt="" width="52" height="52"></span>'
    else:
        tile = f'<span class="tile" aria-hidden="true">{escape(name[0])}</span>'
    href = href_for(app["page"], lang)
    status = escape(app["status"])
    tag = escape(app["tag"][lang])
    description = escape(app["line"][lang])
    return (
        f'<a class="row"{link_attrs(href)}>{tile}'
        f'<div><div class="row-title">{escape(name)}<span class="chip" data-status="{status}"><i class="dot"></i>{tag}</span></div>'
        f'<div class="row-desc">{description}</div></div><span class="row-go" aria-hidden="true">→</span></a>'
    )


def render(path, lang):
    available, workshop = [], []
    for app in APPS:
        group = available if app["status"] == "available" else workshop
        group.append(row(app, lang))
    groups = "\n".join(
        f'<div class="row-group"><p class="label">{label}</p><div class="rows">{"".join(rows)}</div></div>'
        for label, rows in zip(LABELS[lang], (available, workshop))
    )

    text = path.read_text(encoding="utf-8")
    before, _, rest = text.partition(START)
    _, end, after = rest.partition(END)
    if text.count(START) != 1 or text.count(END) != 1 or not end:
        raise SystemExit(f"{path.relative_to(ROOT)}: expected one work marker pair")
    updated = f"{before}{START}\n{groups}\n{END}{after}"
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        print("wrote", path.relative_to(ROOT))


if __name__ == "__main__":
    render(ROOT / "index.html", "en")
    render(ROOT / "ko/index.html", "ko")
