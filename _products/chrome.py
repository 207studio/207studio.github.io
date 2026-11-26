"""Build the shared head assets, navigation and footer for redesigned pages."""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPS = json.loads((ROOT / "_products/apps.json").read_text(encoding="utf-8"))["apps"]
POSTS = json.loads((ROOT / "_blog/posts.json").read_text(encoding="utf-8"))

PAGES = {
    "/": {"kind": "home", "scripts": ["walk.js"]},
    "/ko/": {"kind": "home", "scripts": ["walk.js"]},
    "/404.html": {"kind": "read", "scripts": []},
    "/legal/privacy/": {"kind": "read", "scripts": []},
    "/legal/terms/": {"kind": "read", "scripts": []},
    "/legal/refunds/": {"kind": "read", "scripts": []},
    "/pairy/support.html": {"kind": "read", "scripts": []},
    "/pairy/privacy.html": {"kind": "read", "scripts": []},
    "/stonewars/": {"kind": "project", "scripts": []},
    "/stonewars/support.html": {"kind": "read", "scripts": []},
    "/stonewars/privacy.html": {"kind": "read", "scripts": []},
}
PAGES.update({
    f"{prefix}/{section}/": {"kind": "read", "scripts": []}
    for prefix in ("", "/ko")
    for section in ("about", "blog")
})
PAGES.update({
    f"/blog/{post['slug']}/": {"kind": "read", "scripts": []}
    for post in POSTS
})

STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 1c.4 5.6 2.6 8 11 11-8.4 3-10.6 5.4-11 11-.4-5.6-2.6-8-11-11 8.4-3 10.6-5.4 11-11z"/></svg>'
MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14"/></svg>'
S = {
    "en": dict(
        home="/", work="Work", writing="Writing", about="About", menu="Menu",
        main="Main navigation", skip="Skip to content", other_label="한국어",
        other_lang="ko", other_href="/ko/", look="Look", system="System", light="Light",
        night="Night", studio="Studio", support="Support", legal="Legal",
        privacy="Privacy Policy", terms="Terms of Use", refunds="Refund Policy",
        tagline="Software for making and teaching.", copy="© 2026 207 Studio · South Korea",
    ),
    "ko": dict(
        home="/ko/", work="작업", writing="글", about="소개", menu="메뉴",
        main="주 메뉴", skip="본문으로 건너뛰기", other_label="English",
        other_lang="en", other_href="/", look="화면", system="시스템", light="밝게",
        night="어둡게", studio="스튜디오", support="지원", legal="법적 고지",
        privacy="개인정보 처리방침", terms="이용약관", refunds="환불 정책",
        tagline="만들고 가르치는 일을 위한 소프트웨어.", copy="© 2026 207 Studio · 대한민국",
    ),
}


def href_for(target, lang):
    return target.get("href_" + lang, target["href"])


def link_attrs(href):
    external = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
    return f' href="{escape(href)}"{external}'


for app in APPS:
    if app["id"] == "chalkieboard":
        continue
    for lang in S:
        if app["id"] == "stonewars" and lang == "en":
            continue
        route = href_for(app["page"], lang)
        if "#" in route:
            continue  # the row links into a home section; it has no page of its own
        scripts = ["compare.js", "tt-download.js"] if app["id"] == "ttoryeot" else []
        PAGES[route] = {"kind": "project", "scripts": scripts}


def head(kind, route):
    if PAGES[route]["kind"] != kind:
        raise ValueError(f"{route}: unexpected page kind {kind}")
    return f'''<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0d1333" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#fdfcf8" media="(prefers-color-scheme: light)">
<link rel="preload" href="/assets/fonts/dm-sans-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<script src="/assets/look.js"></script>
<link rel="stylesheet" href="/assets/fonts/pretendard.css">
<link rel="stylesheet" href="/assets/site-tokens.css">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/site-{kind}.css">'''


def language_link(strings, alternate=None, css_class=""):
    href = escape(alternate or strings["other_href"])
    other = strings["other_lang"]
    return f'<a{css_class} href="{href}" lang="{other}" hreflang="{other}">{strings["other_label"]}</a>'


def studio_links(strings):
    return f'<a href="mailto:support@207studio.dev">{strings["support"]}</a><a href="/llms.txt">llms.txt</a>'


def legal_links(strings):
    return "".join(
        f'<a href="/legal/{key}/">{strings[key]}</a>'
        for key in ("privacy", "terms", "refunds")
    )


def top(lang, route, alternate):
    s = S[lang]
    home = s["home"]
    links = (
        (home + "#work", s["work"]),
        (home + "blog/", s["writing"]),
        (home + "about/", s["about"]),
    )
    nav = []
    menu_nav = []
    for href, label in links:
        current = route == href or (href.endswith("/blog/") and route.startswith(href))
        attrs = ' aria-current="page"' if current else ""
        nav.append(f'<a href="{href}"{attrs}>{label}</a>')
        menu_nav.append(f'<a href="{href}">{label}</a>')
    language = language_link(s, alternate, ' class="pill"')
    return f'''<a class="skip" href="#main">{s['skip']}</a>
<div class="sky" aria-hidden="true"><b class="sky-tile sky-still"></b><i class="sky-a"><b class="sky-tile sky-star"></b><b class="sky-tile sky-dots"></b></i><i class="sky-b"><b class="sky-tile sky-star"></b><b class="sky-tile sky-dots"></b></i></div>
<header class="head" data-head><div class="head-in">
<a class="pill brand" href="{home}" aria-label="207 Studio"><span class="brand-star">{STAR}</span><span class="brand-word">207 Studio</span></a>
<nav class="pill head-nav" aria-label="{s['main']}">{"".join(nav)}</nav>
<span class="head-gap"></span>
{language}
<details class="menu" data-menu><summary class="round" aria-label="{s['menu']}">{MENU}</summary>
<div class="menu-pop">
<div class="menu-nav-only">{"".join(menu_nav)}</div>
<p class="menu-label js-only">{s['look']}</p>
<div class="seg js-only" role="group" aria-label="{s['look']}"><button type="button" data-look-set="system" aria-pressed="false">{s['system']}</button><button type="button" data-look-set="paper" aria-pressed="false">{s['light']}</button><button type="button" data-look-set="night" aria-pressed="false">{s['night']}</button></div>
<p class="menu-label">{s['studio']}</p>
{studio_links(s)}
<p class="menu-label">{s['legal']}</p>
{legal_links(s)}
</div></details></div></header>'''


def foot(lang, route, kind):
    s = S[lang]
    home = s["home"]
    work = "".join(
        f'<a{link_attrs(href_for(app["page"], lang))}>{escape(app["name"][lang])}</a>'
        for app in APPS
    )
    scripts = "\n".join(
        f'<script src="/assets/{name}" defer></script>'
        for name in ("site.js", *PAGES[route]["scripts"])
    )
    return f'''<footer class="foot"><div class="wrap"><div class="foot-grid">
<div class="foot-brand"><a href="{home}">{STAR}207 Studio</a><p>{s['tagline']}</p></div>
<nav class="foot-work" aria-label="{s['work']}"><h2>{s['work']}</h2>{work}</nav>
<nav aria-label="{s['studio']}"><h2>{s['studio']}</h2><a href="{home}about/">{s['about']}</a><a href="{home}blog/">{s['writing']}</a>{studio_links(s)}</nav>
<nav aria-label="{s['legal']}"><h2>{s['legal']}</h2>{legal_links(s)}</nav>
</div><div class="foot-bottom"><span>{s['copy']}</span>{language_link(s)}</div></div></footer>
{scripts}'''
