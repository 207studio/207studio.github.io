"""Render the studio's concise project index from apps.json."""
import json,re
from html import escape
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
APPS=json.loads((ROOT/'_products/apps.json').read_text())['apps']
for lang,path in [('en',ROOT/'index.html'),('ko',ROOT/'ko/index.html')]:
    items=[]
    for app in APPS:
        target=app['page'].get('href_'+lang,app['page']['href'])
        icon=(f'<img src="{app["icon"]}" width="64" height="64" alt="" loading="lazy">' if app.get('icon') else '')
        items.append(f'<li class="project-card">{icon}<p class="project-status">{escape(app["tag"][lang])}</p><h3>{escape(app["name"][lang])}</h3><p>{escape(app["line"][lang])}</p><a href="{escape(target)}">{escape(app["page"][lang])} <span aria-hidden="true">→</span></a></li>')
    s,n=re.subn(r'(<ol class="project-list" data-project-list>\n).*?(</ol>)',lambda m:m[1]+'\n'.join(items)+'\n'+m[2],path.read_text(),flags=re.S)
    assert n==1,path
    path.write_text(s);print('wrote',path.relative_to(ROOT))
