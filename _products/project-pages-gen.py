"""Generate the project homes from apps.json, keeping homepage cards concise.
Run this after source edits; it also regenerates the details, comparison and index.
"""
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APPS = json.loads((ROOT / '_products/apps.json').read_text())['apps']

def page(app, lang, body):
    ko = lang == 'ko'
    route = app['page']['href_ko' if ko else 'href']
    en = app['page']['href']; kr = app['page']['href_ko']
    name = escape(app['name'][lang]); desc = escape(app['line'][lang], quote=True)
    icon = app.get('icon')
    tile = f'<img src="{escape(icon)}" alt="">' if icon else escape(app['name'][lang][0])
    actions = ''
    if app['id'] == 'ttoryeot':
        download = '내려받기 ↓' if ko else 'Download ↓'
        actions = f'<div class="actions"><a class="btn btn-primary" href="#ttoryeot">{download}</a></div>'
    return f'''<!doctype html>
<html lang="{lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{name} | 207 Studio</title><meta name="description" content="{desc}">
<link rel="canonical" href="https://207studio.dev{route}">
<link rel="alternate" hreflang="en" href="https://207studio.dev{en}">
<link rel="alternate" hreflang="ko" href="https://207studio.dev{kr}">
<link rel="alternate" hreflang="x-default" href="https://207studio.dev{en}">
<meta property="og:title" content="{name} | 207 Studio"><meta property="og:description" content="{desc}"><meta property="og:type" content="website"><meta property="og:url" content="https://207studio.dev{route}">
<link rel="icon" href="/favicon.ico">
<!-- chrome:head:start -->
<!-- chrome:head:end -->
</head>
<body class="project">
<!-- chrome:top:start -->
<!-- chrome:top:end -->
<main id="main"><header class="project-hero wrap has-tile"><span class="tile" aria-hidden="true">{tile}</span><div><p class="eyebrow">{escape(app['tag'][lang])}</p><h1>{name}</h1><p>{desc}</p>{actions}</div></header>
{body}
</main>
<!-- chrome:foot:start -->
<!-- chrome:foot:end -->
</body></html>
'''

for app in APPS:
    if app['id'] not in ('ttoryeot','checkyboard','kiwi','dekiduck'):
        continue
    for lang in ('en','ko'):
        if app['id']=='ttoryeot':
            ko=lang=='ko'
            nav='<nav class="project-sections wrap" aria-label="'+('또렷 메뉴' if ko else 'Ttoryeot sections')+'"><a href="#ttoryeot">'+('데스크톱' if ko else 'Desktop')+'</a><a href="#cli-mcp">CLI · MCP</a><a href="#toss">'+('토스' if ko else 'Toss')+'</a><a href="#compare">'+('한글과 비교' if ko else 'Document comparison')+'</a></nav>\n'
            body=('  <!-- ttoryeot:start -->\n  <!-- ttoryeot:end -->\n'
                  + '<section class="project-content wrap" id="toss"><div class="card"><h2>'+('토스에서 쓰기' if ko else 'Use it in Toss')+'</h2><p>'
                  + ('휴대폰에서는 토스 앱에서 ‘한글 뷰어 또렷’을 검색해 이용할 수 있어요.' if ko else 'On a phone, search for 한글 뷰어 또렷 in the Toss app.')+'</p></div></section>\n'
                  + '  <!-- compare:start -->\n  <!-- compare:end -->')
            overview='<section class="project-content wrap" id="engine"><div class="card"><h2>'+('엔진' if ko else 'Engine')+'</h2><p>'+escape(app['what'][lang])+'</p><p>'+('대상: ' if ko else 'For: ')+escape(app['for'][lang])+'</p><ul>'+''.join('<li>'+escape(x)+'</li>' for x in app['points'][lang])+'</ul></div></section>\n'
            body=nav+overview+body
        else:
            text=escape(app.get('what',app['line'])[lang])
            body=f'<section class="project-content wrap"><div class="card"><h2>{"소개" if lang=="ko" else "About"}</h2><p>{text}</p>'
            if app.get('for'):
                body+=f'<p>{"대상" if lang=="ko" else "For"}: {escape(app["for"][lang])}</p>'
            if app.get('points'):
                body+='<ul>'+''.join('<li>'+escape(x)+'</li>' for x in app['points'][lang])+'</ul>'
            body+='</div></section>'
        route=app['page'].get('href_'+lang,app['page']['href'])
        dest=ROOT / route.lstrip('/') / 'index.html'
        dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(page(app,lang,body))
        print('wrote',dest.relative_to(ROOT))

# Generate all dependent sections after writing their page scaffolds.
import subprocess
import sys
for script in ("ttoryeot-gen.py", "compare-gen.py", "walk-gen.py"):
    subprocess.run([sys.executable, str(ROOT / "_products" / script)], check=True)
subprocess.run([sys.executable, str(ROOT / "_products" / "chrome-gen.py")], check=True)
