#!/usr/bin/env python3
"""Check assets/site-tokens.css (the website's design values).

  python3 tools/check-tokens.py            # run from the repo root

1. The night role block exists twice (the attribute rule and the prefers-color-scheme rule). They must be identical.
2. Every pair of colours a page puts words on is measured in both looks (WCAG relative luminance contrast) and must pass.
3. No page stylesheet writes its own colour: every #hex / rgb() / hsl() outside site-tokens.css is listed (see --colours).

Exit code 1 on any failure. No dependencies beyond the standard library.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "assets" / "site-tokens.css"


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def blocks(css: str):
    """Yield (selector, body) for each top-level rule and, for @media, the inner rules prefixed with the @media condition."""
    css = strip_comments(css)
    i = 0
    out = []
    while i < len(css):
        j = css.find("{", i)
        if j < 0:
            break
        sel = css[i:j].strip()
        depth, k = 1, j + 1
        in_str = None
        while k < len(css) and depth:
            c = css[k]
            if in_str:
                if c == in_str:
                    in_str = None
            elif c in "\"'":
                in_str = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            k += 1
        body = css[j + 1 : k - 1]
        if sel.startswith("@media"):
            for isel, ibody in blocks(body):
                out.append((sel + " :: " + isel, ibody))
        elif not sel.startswith("@font-face"):
            out.append((sel, body))
        i = k
    return out


def declarations(body: str) -> dict:
    decl = {}
    depth = 0
    cur = ""
    in_str = None
    parts = []
    for c in body:
        if in_str:
            cur += c
            if c == in_str:
                in_str = None
            continue
        if c in "\"'":
            in_str = c
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if c == ";" and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += c
    if cur.strip():
        parts.append(cur)
    for p in parts:
        if ":" in p:
            k, v = p.split(":", 1)
            k = k.strip()
            if k.startswith("--"):
                decl[k] = " ".join(v.split())
    return decl


# ── colour maths ─────────────────────────────────────────────────────────────────────────────
def split_args(s: str):
    args, depth, cur = [], 0, ""
    for c in s:
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        if c == "," and depth == 0:
            args.append(cur.strip())
            cur = ""
        else:
            cur += c
    args.append(cur.strip())
    return args


def parse_color(expr: str):
    """Return (r, g, b, a) with r,g,b in 0..255 and a in 0..1."""
    e = expr.strip()
    if e == "transparent":
        return (0.0, 0.0, 0.0, 0.0)
    m = re.fullmatch(r"#([0-9a-fA-F]{6})", e)
    if m:
        h = m.group(1)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0)
    m = re.fullmatch(r"rgba?\((.*)\)", e)
    if m:
        inner = m.group(1).replace("/", " ").replace(",", " ").split()
        r, g, b = (float(x) for x in inner[:3])
        a = float(inner[3]) if len(inner) > 3 else 1.0
        return (r, g, b, a)
    m = re.fullmatch(r"color-mix\(in srgb,(.*)\)", e)
    if m:
        a1, a2 = split_args(m.group(1))[0:2]

        def part(x):
            mm = re.fullmatch(r"(.*?)(?:\s+([\d.]+)%)?", x.strip())
            return mm.group(1).strip(), (float(mm.group(2)) if mm.group(2) else None)

        c1, p1 = part(a1)
        c2, p2 = part(a2)
        if p1 is None and p2 is None:
            p1 = p2 = 50.0
        elif p1 is None:
            p1 = 100.0 - p2
        elif p2 is None:
            p2 = 100.0 - p1
        total = p1 + p2
        w1, w2 = p1 / total, p2 / total
        r1 = parse_color(c1)
        r2 = parse_color(c2)
        alpha = r1[3] * w1 + r2[3] * w2
        if alpha == 0:
            return (0.0, 0.0, 0.0, 0.0)
        ch = [(r1[i] * r1[3] * w1 + r2[i] * r2[3] * w2) / alpha for i in range(3)]
        return (ch[0], ch[1], ch[2], alpha * (total / 100.0 if total < 100 else 1.0))
    raise ValueError("cannot parse colour: " + expr)


def expand(env: dict, value: str, depth=0) -> str:
    if depth > 30:
        raise ValueError("var cycle: " + value)

    def sub(m):
        name = m.group(1)
        if name not in env:
            raise KeyError(name)
        return expand(env, env[name], depth + 1)

    return re.sub(r"var\((--[\w-]+)\)", sub, value)


def over(fg, bg):
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3)) + (1.0,)


def lum(c):
    def f(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])


def ratio(c1, c2):
    l1, l2 = lum(c1), lum(c2)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


# ── pairs ────────────────────────────────────────────────────────────────────────────────────
# (words colour, ground colour, minimum). Grounds are what words sit on in the design (the redesign spec, section 4).
PAIRS = [
    ("--ink", "--bg", 7.0), ("--ink", "--side", 7.0), ("--ink", "--bot-bubble", 7.0), ("--ink", "--card-quiet", 7.0),
    ("--ink", "--raised", 7.0), ("--ink", "--code", 7.0), ("--ink", "--selected", 4.5),
    ("--muted", "--bg", 4.5), ("--muted", "--side", 4.5), ("--muted", "--bot-bubble", 4.5), ("--muted", "--card-quiet", 4.5),
    ("--muted", "--code", 4.5),
    # --hint, --danger and --ok words stand on the page grounds and on --bot-bubble (a page's cards), never on --card-quiet,
    # the lighter ground for things set inside a card: at night they fall under 4.5 there.
    ("--hint", "--bg", 4.5), ("--hint", "--side", 4.5), ("--hint", "--bot-bubble", 4.5),
    ("--accent-ink", "--bg", 4.5), ("--accent-ink", "--side", 4.5), ("--accent-ink", "--bot-bubble", 4.5), ("--accent-ink", "--card-quiet", 4.5),
    ("--on-accent", "--accent", 7.0),
    ("--danger", "--bg", 4.5), ("--danger", "--side", 4.5), ("--danger", "--bot-bubble", 4.5),
    ("--ok", "--bg", 4.5), ("--ok", "--side", 4.5), ("--ok", "--bot-bubble", 4.5),
    ("--on-danger", "--danger", 4.5),
]
# Non-text: what must be seen as a shape (focus ring, the star, a status dot) against the page: 3 : 1.
SHAPES = [("--ink", "--bg", 3.0), ("--star", "--bg", 1.0), ("--working", "--bg", 3.0)]


def main() -> int:
    css = TOKENS.read_text(encoding="utf-8")
    rules = blocks(css)
    failures = []

    # 1. the night block, twice
    attr = [d for s, d in rules if s == ':root[data-look="night"]']
    media = [d for s, d in rules if s.startswith("@media (prefers-color-scheme: dark) ::") and ":root:not([data-look])" in s]
    if len(attr) != 1 or len(media) != 1:
        failures.append("the night block must exist once as :root[data-look=\"night\"] and once inside @media (prefers-color-scheme: dark)")
    else:
        a, m = declarations(attr[0]), declarations(media[0])
        a.pop("color-scheme", None)
        if a != m:
            diff = sorted(set(a.items()) ^ set(m.items()))
            failures.append("the two night blocks differ: " + "; ".join(f"{k}: {v}" for k, v in diff[:6]))
        else:
            print(f"ok: the two night blocks are identical ({len(a)} roles)")

    # base env: all plain :root blocks in order
    base = {}
    for s, d in rules:
        if s == ":root":
            base.update(declarations(d))
    looks = {"paper": dict(base), "night": dict(base)}
    if attr:
        looks["night"].update(declarations(attr[0]))

    for look, env in looks.items():
        results = []
        for fg_name, bg_name, need in PAIRS:
            fg = parse_color(expand(env, env[fg_name]))
            bg_raw = parse_color(expand(env, env[bg_name]))
            page = parse_color(expand(env, env["--bg"]))
            bg = over(bg_raw, over(page, (255, 255, 255, 1)))
            c = ratio(over(fg, bg), bg)
            results.append((fg_name, bg_name, c, need))
            if c < need:
                failures.append(f"{look}: {fg_name} on {bg_name} is {c:.2f} : 1, needs {need}")
        for fg_name, bg_name, need in SHAPES:
            fg = parse_color(expand(env, env[fg_name]))
            bg = over(parse_color(expand(env, env[bg_name])), (255, 255, 255, 1))
            c = ratio(over(fg, bg), bg)
            if c < need:
                failures.append(f"{look}: {fg_name} against {bg_name} is {c:.2f} : 1, needs {need}")
        worst = min(results, key=lambda r: r[2] / r[3])
        print(f"{look}: {len(results)} text pairs measured; tightest {worst[0]} on {worst[1]} = {worst[2]:.2f} : 1 (needs {worst[3]})")

    # 3. colours outside the tokens file
    if "--colours" in sys.argv:
        pat = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(")
        count = 0
        for p in sorted((ROOT / "assets").glob("site*.css")):
            if p.name == "site-tokens.css":
                continue
            for n, line in enumerate(strip_comments(p.read_text(encoding="utf-8")).splitlines(), 1):
                for m in pat.finditer(line):
                    if "var(--" in line[max(0, m.start() - 6): m.start()]:
                        continue
                    count += 1
                    print(f"colour outside tokens: {p.name}:{n}: {line.strip()[:90]}")
        if count:
            failures.append(f"{count} colour(s) written outside site-tokens.css")

    for f in failures:
        print("FAIL:", f)
    print("PASS" if not failures else f"{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
