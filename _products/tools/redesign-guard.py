#!/usr/bin/env python3
"""Keep-list guard for the 207studio.dev redesign: what must not change while every page is restyled.

  python3 _products/tools/redesign-guard.py --baseline origin/main          # compare the working tree with a git ref
  python3 _products/tools/redesign-guard.py --baseline-dir /path/to/old     # or with a checked-out folder

It reads both trees with the standard library only and reports every difference in these groups; exit code 1 if any:
  routes      every page of the baseline still exists (redirect stubs too) with the same canonical, hreflang pairs, robots meta,
              <html lang> and meta refresh target; JSON-LD blocks are not fewer
  downloads   every external link (https:, mailto:) and every local downloadable file link (.hwpx .pdf .zip .dmg .exe .mp4 .vtt .txt
              .png of the compare pages) of the baseline is still linked somewhere on the site; on the pages that carry release
              downloads (ttoryeot, pairy, their KO pages) each page keeps its own
  anchors     every id that a link, a script or a discovery file points at still exists on the same page
  hooks       the data-tt-* and data-compare* attributes the scripts read are still on the same pages
  files       CNAME, robots.txt, app-ads.txt, google*.html, llms.txt, llms-full.txt, favicon.ico, apple-touch-icon.png are
              byte-identical unless named with --allow; sitemap.xml keeps the same set of URLs
  served      every other non-HTML file the baseline serves (assets/*, blog/blog.css, products/products.css, images, fonts,
              downloads) still exists and is byte-identical unless named with --allow: the pairy and stonewars repos and old
              links load them (live /pairy/ loads /assets/pages.css and /assets/pairy.css from this repo)
  refs        in the new tree every local href/src/srcset/url() resolves to a file or a page (paths served by other repos are skipped)
  motion      the effects of the live site stay: the home walk (data-walk, the same data-stop count and data-say lines as the baseline, walk.js
              linked, Mimi's sprite, reduced-motion handling), and the apps' star parallax (every redesigned page carries the five sky tiles;
              site.js moves them; the depth shares in the tokens are above 0)
  privacy     no e-mail address other than support@207studio.dev appears in any page or text file
Pass --allow NAME (repeatable) to accept a named file change, --allow-link URL for a link that is meant to go.
"""
import argparse
import re
import subprocess
import sys
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", "docs", "tools", "_products", "_blog", "_cloudflare", "node_modules", ".github"}
DOWNLOAD_EXT = (".hwpx", ".pdf", ".zip", ".dmg", ".exe", ".mp4", ".webm", ".vtt", ".txt", ".png", ".json")
BYTE_FILES = ["CNAME", "robots.txt", "app-ads.txt", "llms.txt", "llms-full.txt", "favicon.ico", "apple-touch-icon.png"]
OTHER_REPO_PREFIXES = ("/stonewars/", "/pairy/support.html", "/pairy/privacy.html", "/paddleway-support/", "/pairy/mac/")
DOWNLOAD_PAGES = ("/ttoryeot/", "/ko/ttoryeot/", "/pairy/", "/ko/pairy/")
EMAIL_OK = {"support@207studio.dev"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None
        self.canonical = None
        self.alternates = {}
        self.robots = None
        self.refresh = None
        self.ids = set()
        self.hrefs = []
        self.refs = []          # local references: href, src, srcset, poster, url()
        self.data_hooks = set()
        self.jsonld = 0
        self._in_jsonld = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "link" and a.get("rel") == "alternate" and a.get("hreflang"):
            self.alternates[a["hreflang"]] = a.get("href")
        if tag == "meta" and (a.get("name") or "").lower() == "robots":
            self.robots = a.get("content")
        if tag == "meta" and (a.get("http-equiv") or "").lower() == "refresh":
            self.refresh = a.get("content")
        if tag == "script" and a.get("type") == "application/ld+json":
            self.jsonld += 1
        if a.get("id"):
            self.ids.add(a["id"])
        for k in a:
            if k.startswith("data-tt") or k.startswith("data-compare"):
                self.data_hooks.add(k)
        for k in ("href", "src", "poster", "data-src"):
            if a.get(k):
                self.refs.append(a[k])
                if k == "href":
                    self.hrefs.append(a[k])
        if a.get("srcset") or a.get("imagesrcset"):
            for part in (a.get("srcset") or a.get("imagesrcset")).split(","):
                if part.strip():
                    self.refs.append(part.strip().split()[0])
        if a.get("style"):
            self.refs += re.findall(r"url\(['\"]?([^)'\"]+)", a["style"])


def page_url(rel: str) -> str:
    if rel.endswith("index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def collect(root: Path) -> dict:
    out = {"pages": {}, "bytes": {}, "sitemap": set(), "root": root, "emails": {}}
    for p in sorted(root.rglob("*.html")):
        rel = p.relative_to(root).as_posix()
        if rel.split("/")[0] in SKIP_DIRS:
            continue
        pg = Page()
        text = p.read_text(encoding="utf-8", errors="replace")
        pg.feed(text)
        pg.css_refs = re.findall(r"url\(['\"]?([^)'\"]+)", text)
        out["pages"][page_url(rel)] = pg
    for name in BYTE_FILES + [f.name for f in root.glob("google*.html")]:
        f = root / name
        out["bytes"][name] = f.read_bytes() if f.exists() else None
    sm = root / "sitemap.xml"
    if sm.exists():
        out["sitemap"] = set(re.findall(r"<loc>([^<]+)</loc>", sm.read_text(encoding="utf-8")))
    for p in list(root.rglob("*.html")) + list(root.rglob("*.txt")) + [root / "sitemap.xml"]:
        if not p.exists() or p.relative_to(root).parts[0] in SKIP_DIRS or p.parent.name == "pretendard":
            continue
        for m in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", p.read_text(encoding="utf-8", errors="replace")):
            if not re.search(r"\.(png|jpg|webp|avif|svg|woff2?)$", m):
                out["emails"].setdefault(m.lower(), set()).add(p.relative_to(root).as_posix())
    return out


def external(h: str) -> bool:
    return h.startswith(("https://", "http://", "mailto:"))


def local_download(h: str) -> bool:
    path = h.split("#")[0].split("?")[0]
    return path.startswith("/") and path.lower().endswith(DOWNLOAD_EXT) and not path.startswith("/assets/fonts/")


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--baseline")
    g.add_argument("--baseline-dir")
    ap.add_argument("--allow", action="append", default=[])
    ap.add_argument("--allow-link", action="append", default=[])
    args = ap.parse_args()

    tmp = None
    if args.baseline:
        tmp = tempfile.mkdtemp(prefix="guard-base-")
        tar = subprocess.run(["git", "-C", str(ROOT), "archive", args.baseline], capture_output=True, check=True).stdout
        subprocess.run(["tar", "-x", "-C", tmp], input=tar, check=True)
        base_root = Path(tmp)
    else:
        base_root = Path(args.baseline_dir)
    old, new = collect(base_root), collect(ROOT)
    fails = []

    # routes
    for url, o in old["pages"].items():
        n = new["pages"].get(url)
        if n is None:
            fails.append(f"routes: page missing: {url}")
            continue
        if o.canonical != n.canonical:
            fails.append(f"routes: {url} canonical {o.canonical} -> {n.canonical}")
        if o.alternates != n.alternates:
            fails.append(f"routes: {url} hreflang changed: {o.alternates} -> {n.alternates}")
        if o.robots != n.robots:
            fails.append(f"routes: {url} robots meta {o.robots!r} -> {n.robots!r}")
        if o.lang != n.lang:
            fails.append(f"routes: {url} <html lang> {o.lang!r} -> {n.lang!r}")
        if o.refresh != n.refresh:
            fails.append(f"routes: {url} meta refresh {o.refresh!r} -> {n.refresh!r}")
        if n.jsonld < o.jsonld:
            fails.append(f"routes: {url} JSON-LD blocks {o.jsonld} -> {n.jsonld}")
    # downloads
    def links(site):
        s = set()
        for pg in site["pages"].values():
            s |= {h for h in pg.hrefs if external(h) or local_download(h)}
        return s
    old_links, new_links = links(old), links(new)
    for h in sorted(old_links - new_links):
        if h not in args.allow_link:
            fails.append(f"downloads: link gone from the whole site: {h}")
    for url in DOWNLOAD_PAGES:
        if url in old["pages"] and url in new["pages"]:
            keep = {h for h in old["pages"][url].hrefs if ("releases/" in h or local_download(h))}
            have = set(new["pages"][url].hrefs)
            for h in sorted(keep - have):
                if h not in args.allow_link:
                    fails.append(f"downloads: {url} lost its link {h}")
    # anchors: ids that something points at
    targets = {}
    for url, pg in old["pages"].items():
        for h in pg.hrefs:
            if "#" in h and len(h.split("#")[1]) > 0 and not external(h):
                path, frag = h.split("#", 1)
                tgt = page_url(path.lstrip("/") + "index.html") if path.startswith("/") and path.endswith("/") else (url if path == "" else None)
                if tgt:
                    targets.setdefault(tgt, set()).add(frag)
    js_text = ""
    for js in (base_root / "assets").glob("*.js"):
        js_text += js.read_text(encoding="utf-8", errors="replace")
    for text_name in ("llms.txt", "llms-full.txt"):
        f = base_root / text_name
        if f.exists():
            for m in re.finditer(r"https://207studio\.dev(/[^\s)#]*)#([\w-]+)", f.read_text(encoding="utf-8")):
                targets.setdefault(m.group(1), set()).add(m.group(2))
    for m in re.finditer(r"'#([\w-]+)':\s*'(/[^'#]*)/?#?([\w-]*)'", js_text):
        targets.setdefault("/", set()).add(m.group(1))
        targets.setdefault("/ko/", set()).add(m.group(1))
    for url, frags in sorted(targets.items()):
        o, n = old["pages"].get(url), new["pages"].get(url)
        if not o or not n:
            continue
        for frag in sorted(frags):
            if frag in o.ids and frag not in n.ids:
                fails.append(f"anchors: {url} lost id #{frag}, which a link or a script uses")
    # hooks
    for url, o in old["pages"].items():
        n = new["pages"].get(url)
        if n:
            for hook in sorted(o.data_hooks - n.data_hooks):
                fails.append(f"hooks: {url} lost {hook}")
    # files
    for name, data in old["bytes"].items():
        if name in args.allow:
            continue
        if data != new["bytes"].get(name):
            fails.append(f"files: {name} changed or went missing")
    if old["sitemap"] != new["sitemap"]:
        for u in sorted(old["sitemap"] - new["sitemap"]):
            fails.append(f"files: sitemap lost {u}")
    # served files: every non-HTML file the baseline serves (old stylesheets and scripts that the pairy and stonewars repos and old
    # links still load, images, fonts, downloads) stays and stays byte-identical, until a coordinated clean-up says otherwise
    import hashlib
    def served(root):
        out = {}
        for f in root.rglob("*"):
            if not f.is_file() or f.suffix == ".html":
                continue
            rel = f.relative_to(root).as_posix()
            if rel.split("/")[0] in SKIP_DIRS or rel in ("sitemap.xml", "README.md", ".gitignore"):
                continue
            out[rel] = hashlib.sha256(f.read_bytes()).hexdigest()
        return out
    sold, snew = served(base_root), served(ROOT)
    for rel, digest in sorted(sold.items()):
        if rel in args.allow:
            continue
        if rel not in snew:
            fails.append(f"served: {rel} is gone (another repo or an old link may still load it)")
        elif snew[rel] != digest:
            fails.append(f"served: {rel} changed; old pages still load it, add a new file instead")
    # refs: the new tree must not point at a file that is not there
    def exists(path: str) -> bool:
        path = path.split("#")[0].split("?")[0]
        if not path or path.startswith(OTHER_REPO_PREFIXES):
            return True
        p = ROOT / path.lstrip("/")
        return p.is_file() or (p.is_dir() and (p / "index.html").is_file())
    seen = set()
    for url, pg in new["pages"].items():
        for r in pg.refs + pg.css_refs:
            if r.startswith("/") and not r.startswith("//") and not exists(r) and (url, r) not in seen:
                seen.add((url, r))
                fails.append(f"refs: {url} points at a missing file {r}")
    for css in (ROOT / "assets").glob("site*.css"):
        for r in re.findall(r"url\(['\"]?(/[^)'\"#]+)", css.read_text(encoding="utf-8")):
            if not r.startswith("data:") and not exists(r):
                fails.append(f"refs: {css.name} points at a missing file {r}")
    # motion: the live site's effects are carried into the new look (owner order 2026-11-26: keep every effect)
    def say_lines(root, rel):
        t = (root / rel).read_text(encoding="utf-8")
        return t.count("data-stop"), re.findall(r'data-say="([^"]*)"', t), t
    for rel in ("index.html", "ko/index.html"):
        n_old, say_old, _ = say_lines(base_root, rel)
        n_new, say_new, text = say_lines(ROOT, rel)
        if n_new != n_old or sorted(say_new) != sorted(say_old):
            fails.append(f"motion: {rel} must keep {n_old} walk stops with the baseline's Mimi lines (found {n_new})")
        for need in ("data-walk", "data-walk-scroller", "data-walk-stage", "data-walk-track", 'src="/assets/walk.js"'):
            if need not in text:
                fails.append(f"motion: {rel} lost {need}")
    css_home = (ROOT / "assets/site-home.css").read_text(encoding="utf-8")
    for need in ("/assets/mimi-walk-front.webp", "mimi-walk", "perspective", "position: sticky", "prefers-reduced-motion"):
        if need not in css_home:
            fails.append(f"motion: assets/site-home.css lost {need}")
    walk_js = (ROOT / "assets/walk.js").read_text(encoding="utf-8")
    for need in ("prefers-reduced-motion", "IntersectionObserver", "data-say", "focusin"):
        if need not in walk_js:
            fails.append(f"motion: assets/walk.js lost {need}")
    site_js = (ROOT / "assets/site.js").read_text(encoding="utf-8")
    for need in ("sky-tile", "prefers-reduced-motion", "translate3d"):
        if need not in site_js:
            fails.append(f"motion: assets/site.js lost the star parallax ({need})")
    if "sky-tile { transform: none" not in (ROOT / "assets/site.css").read_text(encoding="utf-8"):
        fails.append("motion: assets/site.css lost the reduced-motion rule for the sky tiles")
    tokens = (ROOT / "assets/site-tokens.css").read_text(encoding="utf-8")
    for name in ("still", "a", "b"):
        m = re.search(r"--sky-depth-" + name + r":\s*([0-9.]+)", tokens)
        if not m or float(m.group(1)) <= 0:
            fails.append(f"motion: --sky-depth-{name} must stay above 0 (the star parallax)")
    for url, pg in new["pages"].items():
        f = ROOT / (url.lstrip("/") + ("index.html" if url.endswith("/") else ""))
        if f.is_file() and "chrome:head:start" in f.read_text(encoding="utf-8"):
            if f.read_text(encoding="utf-8").count('class="sky-tile') != 5:
                fails.append(f"motion: {url} must carry the five sky tiles")
    # privacy
    for mail, where in new["emails"].items():
        if mail not in EMAIL_OK and mail not in old["emails"]:
            fails.append(f"privacy: new e-mail address {mail} in {sorted(where)[:3]}")
        elif mail not in EMAIL_OK:
            fails.append(f"privacy: e-mail address {mail} is still in {sorted(where)[:3]} (only {sorted(EMAIL_OK)} may appear)")

    print(f"baseline: {len(old['pages'])} pages, {len(old_links)} external or downloadable links; new tree: {len(new['pages'])} pages, {len(new_links)} links")
    for f in fails:
        print("FAIL", f)
    print("PASS" if not fails else f"{len(fails)} difference(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
