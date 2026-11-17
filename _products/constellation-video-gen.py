"""Render the Constellation ad. Default refuses missing assets or uncleared rights.
Preview: --preview --output DIR [--preview-data JSON] [--intro-root DIR].
Preview output must be outside both site trees; no preview edits are published.
"""
import argparse,json,re
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--preview',action='store_true');p.add_argument('--output',type=Path)
p.add_argument('--preview-data',type=Path);p.add_argument('--intro-root',type=Path)
a=p.parse_args();source_root=a.intro_root or ROOT
if a.preview_data and not a.preview:p.error('preview-only data')
if a.preview and (not a.output or any(a.output.resolve().is_relative_to(r.resolve()) for r in [ROOT,source_root])):p.error('preview output must be outside site trees')
data=json.loads((a.preview_data or ROOT/'_products/constellation-video.json').read_text())
basis=data.get('publication_basis')
if not isinstance(basis,str) or not basis.strip():raise SystemExit('publication_basis is required')
for field in ['title','summary','ai_label','provenance']:
 text=data.get(field)
 if not isinstance(text,dict):raise SystemExit('localized text is required: '+field)
 for lang in ['en','ko']:
  if not isinstance(text.get(lang),str) or not text[lang].strip():raise SystemExit('localized text is required: '+field+'_'+lang)
keys={}
for lang in ['en','ko']:
 for kind,ext,limit in [('mp4','.mp4',12*1024**2),('webm','.webm',10*1024**2),('poster','.webp',180*1024),('captions','.vtt',30*1024),('transcript','.txt',30*1024)]:keys[kind+'_'+lang]=(ext,limit,kind!='webm')
missing=[]
for key,(ext,limit,required) in keys.items():
 src=data.get(key)
 if not src:
  if required:missing.append(key)
  continue
 if not src.startswith('/assets/constellation/') or '..' in Path(src).parts:raise SystemExit('invalid local asset: '+key)
 f=(a.output if a.preview else source_root)/src.lstrip('/')
 if not f.is_file() or f.suffix!=ext or f.stat().st_size>limit:raise SystemExit('missing, wrong format or oversized: '+key)
 if key.startswith('captions') and not f.read_text().startswith('WEBVTT'):raise SystemExit('invalid VTT: '+key)
if not a.preview:
 if missing:raise SystemExit('video assets missing: '+', '.join(missing))
 if not all(data.get('clearance',{}).get(k) is True for k in ['publication_authorized','ai_label','watermark']):raise SystemExit('publication clearance incomplete')
outputs=[]
for lang,route in [('en','index.html'),('ko','ko/index.html')]:
 ko=lang=='ko';url='https://constellation.207studio.dev'+('/ko/' if ko else '/')
 if data.get('mp4_'+lang):
  sources=''.join(f'<source src="{escape(data[k+"_"+lang])}" type="video/{k}">' for k in ['webm','mp4'] if data.get(k+'_'+lang))
  tracks=''.join(f'<track kind="captions" src="{escape(data["captions_"+code])}" srclang="{code}" label="{label}"'+(' default' if code==lang else '')+'>' for code,label in [('ko','한국어'),('en','English')] if data.get('captions_'+code))
  poster=f' poster="{escape(data["poster_"+lang])}"' if data.get('poster_'+lang) else ''
  media=f'<video controls playsinline preload="none" width="1280" height="720"{poster}>{sources}{tracks}</video>'
 else:media='<div class="constellation-video-placeholder">'+('영상 준비 중' if ko else 'Video pending')+'</div>'
 transcript=f'<a href="{escape(data["transcript_"+lang])}">{"대본 읽기" if ko else "Read the transcript"}</a>' if data.get('transcript_'+lang) else '<span>'+('대본 준비 중' if ko else 'Transcript pending')+'</span>'
 warning=('<p class="constellation-video-preview">'+('미리보기 전용 · 공개 권한 확인 대기' if ko else 'Preview only · publication clearance pending')+'</p>') if a.preview else ''
 about='' if a.intro_root else f'<a href="{url}">{"별채 소개" if ko else "About Constellation"} <span aria-hidden="true">→</span></a>'
 block=f'''<!-- constellation-video:start --><section class="constellation-video wrap" aria-labelledby="constellation-video-title"><h2 id="constellation-video-title">{escape(data['title'][lang])}</h2><p>{escape(data['summary'][lang])}</p>{warning}{media}<p class="constellation-video-label">{escape(data['ai_label'][lang])}</p><p class="constellation-video-label">{escape(data['provenance'][lang])}</p><p class="constellation-video-links">{transcript} {about}</p></section><!-- constellation-video:end -->'''
 source=(source_root/route).read_text()
 source=re.sub(r'<!-- constellation-video:start -->.*?<!-- constellation-video:end -->(?:\r?\n)?','',source,flags=re.S)
 if '/assets/constellation-video.css' not in source:source=source.replace('</head>','<link rel="stylesheet" href="/assets/constellation-video.css"></head>')
 anchor='</main>' if a.intro_root else '  <section class="studio"'
 assert source.count(anchor)==1
 dest=(a.output/route) if a.preview else source_root/route
 outputs.append((dest,source.replace(anchor,block+'\n'+anchor)))
for dest,html in outputs:
 dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(html);print(dest)
