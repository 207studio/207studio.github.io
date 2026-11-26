#!/usr/bin/env python3
"""Structural checks for the redesigned pages (no browser). Run from the repo root.

  python3 _products/tools/check-pages.py [--all]      # default: the pages that already carry the chrome markers; --all: every page

For each checked page: exactly one <h1>; heading levels never skip down by more than one; unique ids; every <img> has alt;
every link with target=_blank has rel containing noopener; every <a> has an href; <html lang> matches the path (/ko/ -> ko);
a skip link to #main comes first and <main id="main"> exists; the three chrome marker pairs exist once; no <style> and no
style="" attribute (the look lives in assets/site*.css); only the new stylesheets are linked (site-tokens, site, site-home /
site-project / site-read, fonts/pretendard) and none of the old ones; <title>, meta description, canonical, viewport exist;
hreflang pairs point at each other; every local stylesheet, script and image the page names exists.
Exit code 1 on any failure.
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP = {".git", "docs", "tools", "_products", "_blog", "_cloudflare", "node_modules", ".github", "assets"}
OLD_CSS = {"home.min.css", "home.css", "pages.css", "pairy.css", "project-hubs.css", "constellation-video.css", "products.css", "blog.css"}   # by file name, not suffix: site-home.css is new
NEW_CSS = {"site-tokens.css", "site.css", "site-home.css", "site-project.css", "site-read.css", "pretendard.css"}
MARKERS = ("chrome:head", "chrome:top", "chrome:foot")


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.h = []
        self.ids = []
        self.errors = []
        self.imgs_no_alt = 0
        self.blank_no_rel = 0
        self.a_no_href = 0
        self.lang = None
        self.title = False
        self.desc = False
        self.canonical = None
        self.viewport = False
        self.alt = {}
        self.styles = 0
        self.style_attr = 0
        self.css = []
        self.scripts = []
        self.imgs = []
        self.main_id = False
        self.first_link = None
        self.sums_open = False   # <p data-tt-windows-sums hidden>: its <a> gets its href from script on purpose
        self.body_seen = False
        self.skip_first = False

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "body":
            self.body_seen = True
        if tag == "title":
            self.title = True
        if tag == "meta" and a.get("name") == "description" and a.get("content"):
            self.desc = True
        if tag == "meta" and a.get("name") == "viewport":
            self.viewport = True
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "link" and a.get("rel") == "alternate" and a.get("hreflang"):
            self.alt[a["hreflang"]] = a.get("href")
        if tag == "link" and a.get("rel") == "stylesheet":
            self.css.append(a.get("href", ""))
        if tag == "script" and a.get("src"):
            self.scripts.append(a["src"])
        if tag == "style":
            self.styles += 1
        if "style" in a:
            self.style_attr += 1
        if re.fullmatch(r"h[1-6]", tag):
            self.h.append(int(tag[1]))
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "main" and a.get("id") == "main":
            self.main_id = True
        if tag == "img":
            self.imgs.append(a.get("src", ""))
            if "alt" not in a:
                self.imgs_no_alt += 1
        if "data-tt-windows-sums" in a:
            self.sums_open = True
        if tag == "a":
            if "href" not in a and not self.sums_open:
                self.a_no_href += 1
            elif self.body_seen and self.first_link is None:
                self.first_link = a["href"]
            if a.get("target") == "_blank" and "noopener" not in (a.get("rel") or ""):
                self.blank_no_rel += 1


    def handle_endtag(self, tag):
        if tag == "p":
            self.sums_open = False


def pages(all_pages: bool):
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.split("/")[0] in SKIP or rel.startswith("google"):
            continue
        text = p.read_text(encoding="utf-8")
        if not all_pages and "<!-- chrome:head:start -->" not in text:
            continue
        if 'http-equiv="refresh"' in text:  # a redirect stub is not a page to restyle
            continue
        yield rel, text


def exists(ref: str) -> bool:
    path = ref.split("#")[0].split("?")[0]
    if not path.startswith("/") or path.startswith("//"):
        return True
    f = ROOT / path.lstrip("/")
    return f.is_file() or (f.is_dir() and (f / "index.html").is_file())


def main() -> int:
    fails = []
    count = 0
    alts = {}
    for rel, text in pages("--all" in sys.argv):
        count += 1
        pr = P()
        pr.feed(text)
        def bad(msg):
            fails.append(f"{rel}: {msg}")
        if pr.h.count(1) != 1:
            bad(f"{pr.h.count(1)} <h1> (needs exactly one)")
        for prev, cur in zip(pr.h, pr.h[1:]):
            if cur - prev > 1:
                bad(f"heading level jumps from h{prev} to h{cur}")
                break
        dup = {i for i in pr.ids if pr.ids.count(i) > 1}
        if dup:
            bad(f"duplicate ids {sorted(dup)}")
        if pr.imgs_no_alt:
            bad(f"{pr.imgs_no_alt} <img> without alt")
        if pr.blank_no_rel:
            bad(f"{pr.blank_no_rel} target=_blank link(s) without rel=noopener")
        if pr.a_no_href:
            bad(f"{pr.a_no_href} <a> without href")
        want = "ko" if rel.startswith("ko/") else "en"
        if pr.lang != want:
            bad(f"<html lang={pr.lang!r}> but the path says {want!r}")
        if not pr.main_id:
            bad('no <main id="main">')
        if pr.first_link != "#main":
            bad(f"the first link is {pr.first_link!r}, not the skip link to #main")
        for m in MARKERS:
            if text.count(f"<!-- {m}:start -->") != 1 or text.count(f"<!-- {m}:end -->") != 1:
                bad(f"marker pair {m} must appear exactly once")
        if pr.styles or pr.style_attr:
            bad(f"{pr.styles} <style> and {pr.style_attr} style attribute(s): the look belongs in assets/site*.css")
        names = {c.split("/")[-1] for c in pr.css}
        old = [c for c in pr.css if c.split("?")[0].rsplit("/", 1)[-1] in OLD_CSS or c.split("?")[0].endswith("stonewars/style.css")]
        if old:
            bad(f"old stylesheet(s) linked: {old}")
        for need in ("site-tokens.css", "site.css", "pretendard.css"):
            if need not in names:
                bad(f"stylesheet {need} is not linked")
        if not names & {"site-home.css", "site-project.css", "site-read.css"}:
            bad("no page stylesheet (site-home, site-project or site-read) is linked")
        if "look.js" not in {s.split("/")[-1] for s in pr.scripts}:
            bad("assets/look.js is not loaded")
        need_canon = rel != "404.html"   # the 404 page has no canonical on purpose (the guard keeps it that way)
        if not (pr.title and pr.desc and (pr.canonical or not need_canon) and pr.viewport):
            bad("title, meta description, canonical and viewport are all required")
        for ref in pr.css + pr.scripts + pr.imgs:
            if not exists(ref):
                bad(f"missing file {ref}")
        own = "/" + (rel[: -len("index.html")] if rel.endswith("index.html") else rel)
        if pr.canonical and pr.canonical.endswith(own):  # a redirect stub names another page as canonical; leave it out
            alts[rel] = (pr.canonical, pr.alt)
    # hreflang reciprocity: A names B -> B names A
    by_canon = {c: (rel, alt) for rel, (c, alt) in alts.items() if c}
    for rel, (canon, alt) in alts.items():
        for lang, href in alt.items():
            if lang == "x-default" or href == canon:
                continue
            other = by_canon.get(href)
            if other and canon not in other[1].values():
                fails.append(f"{rel}: hreflang {lang} -> {href}, which does not point back")
    print(f"checked {count} page(s)")
    for f in fails:
        print("FAIL", f)
    print("PASS" if not fails else f"{len(fails)} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
