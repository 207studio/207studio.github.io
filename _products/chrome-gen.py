"""Fill the shared chrome markers on every redesigned HTML page."""

import argparse
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

sys.dont_write_bytecode = True
from chrome import PAGES, ROOT, S, foot, head, top


class PageHead(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.lang = None
        self.alternates = {}
        self.feed(text)
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "link" and attrs.get("rel") == "alternate" and attrs.get("hreflang"):
            self.alternates[attrs["hreflang"]] = attrs["href"]


def marker(section, edge):
    return f"<!-- chrome:{section}:{edge} -->"


def fill(text, section, block):
    start, end = marker(section, "start"), marker(section, "end")
    if text.count(start) != 1 or text.count(end) != 1:
        raise ValueError(f"expected one chrome:{section} marker pair")
    before, _, after_start = text.partition(start)
    _, found, after = after_start.partition(end)
    if not found:
        raise ValueError(f"chrome:{section} end marker precedes its start")
    return f"{before}{start}\n{block}\n{end}{after}"


def local_href(href):
    parts = urlsplit(href)
    if parts.scheme == "https" and parts.netloc == "207studio.dev":
        return urlunsplit(("", "", parts.path or "/", parts.query, parts.fragment))
    return href


def render(route, text):
    if route not in PAGES:
        raise ValueError(f"unknown redesigned route {route}")
    kind = PAGES[route]["kind"]
    page = PageHead(text.split("</head>", 1)[0])
    if page.lang not in S:
        raise ValueError(f"unsupported <html lang>: {page.lang!r}")

    alternate = page.alternates.get(S[page.lang]["other_lang"])
    text = fill(text, "head", head(kind, route))
    text = fill(text, "top", top(page.lang, route, local_href(alternate) if alternate else None))
    return fill(text, "foot", foot(page.lang, route, kind))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--external", nargs=2, metavar=("ROOT", "PREFIX"))
    args = parser.parse_args()
    root, prefix = ROOT, "/"
    if args.external:
        directory, prefix = args.external
        root = Path(directory).resolve()
        if not root.is_dir():
            parser.error(f"not a directory: {directory}")
        if not prefix.startswith("/") or not prefix.endswith("/"):
            parser.error("PREFIX must start and end with /")

    for path in sorted(root.rglob("*.html")):
        text = path.read_text(encoding="utf-8")
        if marker("head", "start") not in text:
            continue
        rel = path.relative_to(root).as_posix()
        route = prefix + (rel.removesuffix("index.html") if path.name == "index.html" else rel)
        try:
            updated = render(route, text)
        except ValueError as error:
            raise SystemExit(f"{rel}: {error}") from error
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            print("wrote chrome", rel)


if __name__ == "__main__":
    main()
