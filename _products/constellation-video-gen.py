"""Generate the optional video block. Missing assets abort before any page is written.
--preview --output DIR writes non-publishable previews outside the site tree.
"""
import argparse,json,re
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--preview',action='store_true');p.add_argument('--output',type=Path)
a=p.parse_args();data=json.loads((ROOT/'_products/constellation-video.json').read_text())
if a.preview and (not a.output or a.output.resolve().is_relative_to(ROOT)):
 p.error('preview requires --output outside the site tree')
limits={'mp4':12*1024**2,'webm':10*1024**2,'poster':180*1024,'captions_en':30*1024,'captions_ko':30*1024,'transcript_en':30*1024,'transcript_ko':30*1024}
exts={'mp4':'.mp4','webm':'.webm','poster':'.webp','captions_en':'.vtt','captions_ko':'.vtt','transcript_en':'.txt','transcript_ko':'.txt'}
missing=[]
for key,limit in limits.items():
 src=data.get(key)
 if not src:
  if key!='webm':missing.append(key)
  continue
 if not src.startswith('/assets/constellation/') or '..' in Path(src).parts:raise SystemExit('invalid local asset: '+key)
 f=ROOT/src.lstrip('/')
 if not f.is_file() or f.suffix!=exts[key] or f.stat().st_size>limit:raise SystemExit('missing, wrong format or oversized: '+key)
 if key.startswith('captions') and not f.read_text().startswith('WEBVTT'):raise SystemExit('invalid VTT: '+key)
if missing and not a.preview:raise SystemExit('video assets missing: '+', '.join(missing))
for lang,route in [('en','index.html'),('ko','ko/index.html')]:
 ko=lang=='ko';url='https://constellation.207studio.dev'+('/ko/' if ko else '/')
 if missing:
  media='<div class="constellation-video-placeholder" role="img" aria-label="'+('영상·포스터 준비 중' if ko else 'Video and poster pending')+'">'+('영상 자리 · 미리보기 전용' if ko else 'Video slot · preview only')+'</div>'
 else:
  sources=(f'<source src="{escape(data["webm"])}" type="video/webm">' if data.get('webm') else '')+f'<source src="{escape(data["mp4"])}" type="video/mp4">'
  tracks=''.join(f'<track kind="captions" src="{escape(data["captions_"+code])}" srclang="{code}" label="{label}"'+(' default' if code==lang else '')+'>' for code,label in [('ko','한국어'),('en','English')])
  media=f'<video controls playsinline preload="none" width="1920" height="1080" poster="{escape(data["poster"])}">{sources}{tracks}</video>'
 transcript=('<span>'+('대본 준비 중' if ko else 'Transcript pending')+'</span>') if missing else f'<a href="{escape(data["transcript_"+lang])}">{"대본 읽기" if ko else "Read the transcript"}</a>'
 block=f'''<section class="constellation-video wrap" aria-labelledby="constellation-video-title"><link rel="stylesheet" href="/assets/constellation-video.css"><div><h2 id="constellation-video-title">{escape(data['title'][lang])}</h2><p>{escape(data['summary'][lang])}</p></div>{media}<p class="constellation-video-links">{transcript} <a href="{url}">{'별채 소개' if ko else 'About Constellation'} <span aria-hidden="true">→</span></a></p></section>'''
 source=(ROOT/route).read_text()
 source=re.sub(r'<!-- constellation-video:start -->.*?<!-- constellation-video:end -->\s*', '', source, flags=re.S)
 block='<!-- constellation-video:start -->'+block+'<!-- constellation-video:end -->'
 anchor='  <section class="studio"'
 assert source.count(anchor)==1
 output=source.replace(anchor,block+'\n\n'+anchor)
 dest=(a.output/route) if a.preview else ROOT/route
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(output)
 print(dest)
