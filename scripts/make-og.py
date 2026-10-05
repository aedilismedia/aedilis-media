"""Paylaşım önizleme görsellerini (1200x630) üretir: assets/img/og/*.jpg
Önce `npm run build` çalışmış olmalı (dist/ içindeki yazı tiplerini kullanır).
Kullanım: python3 scripts/make-og.py"""
import json, pathlib, subprocess, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
OUT = ROOT / 'assets/img/og'
OUT.mkdir(parents=True, exist_ok=True)
rel = json.load(open(ROOT / 'data/releases.json'))
dzs = json.load(open(ROOT / 'data/dzs.json'))
TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
def fmt(d):
    y, m, dd = d.split('-'); return f'{int(dd)} {TR_MONTHS[int(m)-1]} {y}'

BASE = '''<!doctype html><html lang="tr"><meta charset="utf-8"><link rel="stylesheet" href="/assets/css/fonts.css">
<style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:radial-gradient(ellipse at 30% 20%,#1d1810,#0a0a0a 65%);color:#D7CCB2;font-family:Montserrat,sans-serif;display:flex;align-items:center;overflow:hidden;position:relative}
body::after{content:'';position:absolute;inset:18px;border:1px solid #B08A3E;pointer-events:none}
.c img{mix-blend-mode:lighten}
.c{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;gap:22px;text-align:center}
.t{font-family:Cinzel,serif;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
.g{color:#B08A3E;letter-spacing:.3em;font-size:22px;text-transform:uppercase;font-family:Cinzel,serif}
.rel{display:flex;align-items:center;gap:56px;padding:0 80px;width:100%}
.rel img.cv{width:470px;height:470px;object-fit:cover;border:1px solid #B08A3E;box-shadow:0 0 60px rgba(228,176,64,.18)}
.rel .tx{display:flex;flex-direction:column;gap:18px;min-width:0}
.rel h1{font-family:Cinzel,serif;font-weight:800;font-size:68px;line-height:1.05;letter-spacing:.04em;text-transform:uppercase;color:#D7CCB2;word-break:normal}
.rel h1.long{font-size:52px}
.rel p{font-size:26px;color:#a99f88}
.rel .lg{height:84px;width:auto;align-self:flex-start}
</style>'''

def page(body): return BASE + body

jobs = {}
jobs['home'] = page('<div class="c"><img src="/assets/img/aedilis-media.webp" height="360"><div class="t" style="font-size:46px">Aedilis Media</div><div class="g">Geçmişten ilham, geleceğe etki</div></div>')
jobs['muzik'] = page('<div class="c"><img src="/assets/img/aedilis-media-music.webp" height="360"><div class="t" style="font-size:46px">Aedilis Media Music</div><div class="g">DZS · Demonium Nihil</div></div>')
jobs['dzs'] = page(f'<div class="c"><img src="/assets/img/dzs-logo.webp" height="340"><div class="g">{dzs["tagline"]}</div><div style="font-size:24px;color:#a99f88">{dzs["secondary"]}</div></div>')
dn = json.load(open(ROOT / 'data/dn.json'))
jobs['dn'] = page(f'<div class="c"><img src="/{dn["logo"]}" height="340"><div class="g" style="color:#d94a4a">{dn["tagline"]}</div><div style="font-size:24px;color:#a99f88">Gotik industrial · karanlık synthwave</div></div>')
for r in rel:
    if not r.get('cover'): continue
    logo = '/assets/img/dzs-logo.webp' if r['project'] == 'dzs' else '/' + dn['logo']
    when = fmt(r['date']) if len(r['date']) > 4 else r['date']
    kind = f'{r["type"]} · {when}'
    jobs[r['slug']] = page(f'<div class="rel"><img class="cv" src="/{r["cover"]}"><div class="tx"><img class="lg" src="{logo}"><h1 class="{'long' if len(r['title'])>14 else ''}">{r["title"]}</h1><p>{kind} · {len(r["tracks"])} parça</p></div></div>')

srv = subprocess.Popen(['python3', '-m', 'http.server', '4181', '-d', str(DIST)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for name, html in jobs.items():
            (DIST / '_og.html').write_text(html, encoding='utf-8')
            pg.goto('http://localhost:4181/_og.html', wait_until='networkidle')
            pg.evaluate('document.fonts.ready')
            pg.wait_for_timeout(400)
            pg.screenshot(path=str(OUT / f'{name}.jpg'), type='jpeg', quality=88)
            print('og', name)
        b.close()
    (DIST / '_og.html').unlink(missing_ok=True)
finally:
    srv.terminate()
