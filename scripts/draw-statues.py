#!/usr/bin/env python3
"""Tanrı heykellerini (ayakta, mermer, nişte) düz renkli SVG olarak üretir.
Kullanım: python3 scripts/draw-statues.py  ->  assets/img/tanrilar/*.svg
Not: Yer tutucu vektör çizimlerdir; gerçek illüstrasyonla değiştirilebilir (data/hub.json)."""
import math, os

L, M, S, D = '#ece4cf', '#d7ccb2', '#b3a98e', '#7c735b'     # mermer: vurgu, açık, gölge, çizgi
K, G, R = '#101010', '#b08a3e', '#8b0d0d'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'tanrilar')


def pol(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def limb(points, w, fill=M):
    """Kalın, yuvarlak uçlu çizgiyle kol/bacak/sopa: dış çizgi + dolgu + gölge şeridi."""
    d = 'M' + ' L'.join(f'{x} {y}' for x, y in points)
    return (f'<path d="{d}" fill="none" stroke="{D}" stroke-width="{w+2}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{D}" stroke-opacity=".18" stroke-width="{w*0.35:.1f}" stroke-linecap="round" stroke-linejoin="round" transform="translate({w*0.22:.1f} 0)"/>')


def curl(x, y, r, fill=M):
    return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" stroke="{D}" stroke-width="1"/>'
            f'<path d="M{x-r*0.5:.1f} {y+r*0.1:.1f}a{r*0.5:.1f} {r*0.5:.1f} 0 1 1 {r*0.9:.1f} {r*0.35:.1f}" fill="none" stroke="{D}" stroke-width=".8" stroke-linecap="round"/>')


def leaf(x, y, rot, size, fill=M):
    return (f'<path transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({size})" '
            f'd="M0 0C3-5 8-5 11 0 8 5 3 5 0 0Z" fill="{fill}" stroke="{D}" stroke-width="{.9/size:.2f}"/>')


def open_svg(label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 200 308" role="img" aria-label="{label}">')


def niche():
    """Kemerli nis + logodaki gibi kırmızı disk."""
    return (f'<path d="M12 300V116C12 62 52 22 100 22S188 62 188 116V300Z" fill="#131313" stroke="{G}" stroke-width="2.2"/>'
            f'<path d="M20 300V118C20 68 56 30 100 30S180 68 180 118V300Z" fill="none" stroke="{G}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="1.5 6" stroke-linecap="round"/>'
            f'<circle cx="100" cy="112" r="58" fill="{R}"/>')


def plinth():
    return (f'<ellipse cx="100" cy="270" rx="62" ry="5" fill="#000" opacity=".5"/>'
            f'<path d="M44 262H156V272H44Z" fill="{M}" stroke="{D}" stroke-width="1.4"/>'
            f'<path d="M100 262H156V272H100Z" fill="{D}" opacity=".22"/>'
            f'<path d="M52 272H148V294H52Z" fill="{M}" stroke="{D}" stroke-width="1.4"/>'
            f'<path d="M100 272H148V294H100Z" fill="{D}" opacity=".22"/>'
            f'<path d="M58 284H142" stroke="{D}" stroke-width="1.2" stroke-dasharray="6 3"/>')


TONES = [L, M, L, M, S, M, S, S, S]


def pleats(top_y, hem_y, tl, tr, hl, hr, n=9, wave=3):
    """Dikey kıvrımlı etek: üstte [tl,tr], altta [hl,hr] genişlik; dönüşümlü mermer tonları."""
    out = ''
    for i in range(n):
        t0, t1 = i / n, (i + 1) / n
        xt0, xt1 = tl + (tr - tl) * t0, tl + (tr - tl) * t1
        xh0, xh1 = hl + (hr - hl) * t0, hl + (hr - hl) * t1
        sag = wave if i % 2 == 0 else -wave
        tone = TONES[int(i * len(TONES) / n)]
        out += (f'<path d="M{xt0:.1f} {top_y}L{xt1:.1f} {top_y}L{xh1:.1f} {hem_y+(sag):.1f}L{xh0:.1f} {hem_y-(sag):.1f}Z" fill="{tone}" stroke="{D}" stroke-width="1"/>')
    # hafif iç kıvrım çizgileri
    for i in range(1, n):
        t = i / n
        out += (f'<path d="M{tl+(tr-tl)*t:.1f} {top_y+6}Q{tl+(tr-tl)*t+(-1)**i*3:.1f} {(top_y+hem_y)/2:.1f} {hl+(hr-hl)*t:.1f} {hem_y-8}" '
                f'fill="none" stroke="{D}" stroke-width=".7" opacity=".55"/>')
    return out


def head(hair='short', beard=False, female=False, cx=100, cy=38):
    w = 9 if female else 10
    face = (f'<path d="M{cx-w} {cy-6}C{cx-w} {cy-14} {cx-5} {cy-18} {cx} {cy-18}S{cx+w} {cy-14} {cx+w} {cy-6}'
            f'C{cx+w} {cy+4} {cx+5} {cy+12} {cx} {cy+15}S{cx-w} {cy+4} {cx-w} {cy-6}Z" fill="{M}" stroke="{D}" stroke-width="1.1"/>'
            f'<path d="M{cx} {cy-18}C{cx+5} {cy-18} {cx+w} {cy-14} {cx+w} {cy-6}C{cx+w} {cy+4} {cx+5} {cy+12} {cx} {cy+15}Z" fill="{D}" opacity=".22"/>'
            f'<path d="M{cx-8.5} {cy-6.5}L{cx-1.5} {cy-5}M{cx+1.5} {cy-5}L{cx+8.5} {cy-6.5}" fill="none" stroke="{D}" stroke-width="1.5" stroke-linecap="round"/>'
            f'<path d="M{cx-8} {cy-1.5}H{cx-2}M{cx+2} {cy-1.5}H{cx+8}" fill="none" stroke="{D}" stroke-width="1.4" stroke-linecap="round"/>'
            f'<path d="M{cx-7} {cy-0.5}H{cx-3}M{cx+3} {cy-0.5}H{cx+7}" fill="none" stroke="{D}" stroke-opacity=".45" stroke-width="1" stroke-linecap="round"/>'
            f'<path d="M{cx} {cy-4}V{cy+4}M{cx-2.500} {cy+5.500}Q{cx} {cy+6.500} {cx+2.500} {cy+5.500}" fill="none" stroke="{D}" stroke-width="1" stroke-linecap="round"/>'
            f'<path d="M{cx-3.500} {cy+9.500}H{cx+3.500}" fill="none" stroke="{D}" stroke-width="1" stroke-linecap="round"/>')
    neck = (f'<path d="M{cx-5} {cy+12}H{cx+5}V{cy+25}H{cx-5}Z" fill="{S}" stroke="{D}" stroke-width="1"/>')
    return neck, face


def hair_back_long(cx=100, cy=38, drop=34):
    o = ''
    for i, y in enumerate(range(cy - 6, cy + drop, 7)):
        o += curl(cx - 13 - (i % 2) * 2, y, 5) + curl(cx + 13 + (i % 2) * 2, y, 5)
    return o


def hair_front(cx=100, cy=38, rows=1):
    o = ''
    for x in range(cx - 10, cx + 11, 5):
        o += curl(x, cy - 15 + abs(x - cx) * 0.2, 4.2)
    return o


def beard_curls(cx=100, cy=38):
    pts = [(-9, 6), (9, 6), (-8, 11), (8, 11), (-5, 15), (5, 15), (0, 18), (-3, 21), (3, 21), (0, 24)]
    body = (f'<path d="M{cx-10} {cy+3}C{cx-10} {cy+14} {cx-6} {cy+22} {cx} {cy+27}C{cx+6} {cy+22} {cx+10} {cy+14} {cx+10} {cy+3}'
            f'C{cx+6} {cy+9} {cx-6} {cy+9} {cx-10} {cy+3}Z" fill="{M}" stroke="{D}" stroke-width="1"/>'
            f'<path d="M{cx} {cy+9}V{cy+26}" stroke="{D}" stroke-width=".8" opacity=".6"/>')
    return body + ''.join(curl(cx + x, cy + y, 3.6) for x, y in pts) + \
        f'<path d="M{cx-6} {cy+5}Q{cx-3} {cy+3} {cx} {cy+5}Q{cx+3} {cy+3} {cx+6} {cy+5}" fill="none" stroke="{D}" stroke-width="1.1"/>'


def HEAD(inner):
    # baş, gövdeye göre biraz büyük: heykel oranı
    return f'<g transform="translate(100 54) scale(1.15) translate(-100 -54)">{inner}</g>'


def male_torso(top=64, waist=128):
    return (f'<path d="M72 {top+4}C72 {top} 82 {top-2} 94 {top-2}H106C118 {top-2} 128 {top} 128 {top+4}L122 {waist}H78Z" fill="{M}" stroke="{D}" stroke-width="1.2"/>'
            f'<path d="M100 {top-2}H106C118 {top-2} 128 {top} 128 {top+4}L122 {waist}H100Z" fill="{D}" opacity=".2"/>'
            f'<path d="M82 {top+22}Q92 {top+30} 100 {top+24}Q108 {top+30} 118 {top+22}M100 {top+24}V{waist-6}M86 {top+38}Q100 {top+44} 114 {top+38}" fill="none" stroke="{D}" stroke-width="1" opacity=".7"/>'
            f'<circle cx="100" cy="{waist-14}" r="1.4" fill="{D}"/>')


def feet(y=256):
    return (f'<ellipse cx="86" cy="{y}" rx="9" ry="3.5" fill="{M}" stroke="{D}" stroke-width="1"/>'
            f'<ellipse cx="116" cy="{y}" rx="9" ry="3.5" fill="{M}" stroke="{D}" stroke-width="1"/>')


# ------------------------------------------------------------------ DIONYSOS
def dionysos():
    o = open_svg('Dionysos: sarmaşık taçlı, sakallı, thyrsos tutan mermer heykel') + niche()
    # thyrsos (çam kozalaklı değnek) sağda
    o += '<g class="an an-thump">'
    o += limb([(152, 30), (152, 262)], 4)
    o += f'<path d="M152 8C160 16 160 28 152 36 144 28 144 16 152 8Z" fill="{M}" stroke="{D}" stroke-width="1.1"/>'
    o += f'<path d="M146 16Q152 21 158 16M145 23Q152 29 159 23M147 30Q152 34 157 30" fill="none" stroke="{D}" stroke-width=".9"/>'
    o += f'<path d="M152 38C140 44 138 56 146 64M152 38C164 44 166 56 158 64" fill="none" stroke="{D}" stroke-width="2" stroke-linecap="round"/>'
    o += '</g>'
    # etek (uzun khiton)
    o += pleats(126, 256, 78, 122, 62, 138, n=10, wave=3)
    # gövde + geyik postu (nebris) çapraz
    o += male_torso()
    o += f'<path d="M72 66L88 62L128 112L120 128L100 124Z" fill="{S}" stroke="{D}" stroke-width="1.1"/>'
    for (x, y) in [(96, 78), (106, 92), (114, 104), (92, 94), (104, 112)]:
        o += f'<circle cx="{x}" cy="{y}" r="1.6" fill="{L}" stroke="{D}" stroke-width=".6"/>'
    # sol kol: üzüm salkımı tutuyor
    o += limb([(72, 68), (62, 98), (66, 124)], 11)
    for (dx, dy) in [(0, 0), (6, 0), (3, 6), (9, 6), (6, 12), (3, 18)]:
        o += f'<circle cx="{58+dx}" cy="{128+dy}" r="3.4" fill="{M}" stroke="{D}" stroke-width=".9"/>'
    # sağ kol: thyrsos'u tutuyor
    o += limb([(128, 68), (142, 90), (150, 82)], 11)
    o += f'<g class="an an-thump"><circle cx="152" cy="82" r="4.5" fill="{M}" stroke="{D}" stroke-width="1"/></g>'
    # baş: uzun lüleli saç, sakal, sarmaşık
    neck, face = head()
    hd = hair_back_long(drop=40) + neck + face + beard_curls() + hair_front()
    for deg in range(198, 343, 12):
        x, y = pol(100, 36, 15, deg)
        hd += leaf(x, y, deg + 90 - 20, 1.0) + leaf(x, y, deg + 90 + 20, 1.0)
    o += HEAD(hd)
    o += feet() + plinth()
    # asa yere vurunca yayılan halka
    o += f'<ellipse class="an an-ripple" cx="152" cy="262" rx="8" ry="2.4" fill="none" stroke="{D}" stroke-width="1.4"/>'
    return o + '</svg>'


# ------------------------------------------------------------------ HERMES
def hermes():
    o = open_svg('Hermes: kanatlı şapkalı, kerykeion tutan mermer heykel') + niche()
    # kerykeion (kanatlı, yılanlı değnek)
    o += limb([(152, 40), (152, 262)], 4)
    o += f'<circle cx="152" cy="34" r="5" fill="{M}" stroke="{D}" stroke-width="1"/>'
    wing = f'<path d="M150 42C140 34 130 34 122 38 130 40 136 44 140 48 132 50 128 54 124 58 134 56 142 54 150 54Z" fill="{M}" stroke="{D}" stroke-width="1"/>'
    o += f'<g class="an an-wing an-o-br">{wing}</g>' + f'<g transform="translate(304 0) scale(-1 1)"><g class="an an-wing an-o-br">{wing}</g></g>'
    o += (f'<path d="M152 70C140 78 140 90 152 98S164 118 152 126M152 70C164 78 164 90 152 98S140 118 152 126" fill="none" stroke="{D}" stroke-width="2.4" stroke-linecap="round"/>'
          f'<path d="M152 70C164 78 164 90 152 98" fill="none" stroke="{M}" stroke-width="1" stroke-linecap="round"/>')
    # bacaklar (kısa tunik altından)
    o += limb([(88, 160), (86, 210), (86, 250)], 15) + limb([(114, 160), (116, 210), (116, 250)], 15)
    # kanatlı sandaletler
    for sx, cx0 in ((-1, 86), (1, 116)):
        w = (f'<path d="M{cx0} 238C{cx0+sx*12} 228 {cx0+sx*22} 230 {cx0+sx*28} 236 {cx0+sx*20} 238 {cx0+sx*14} 240 {cx0+sx*8} 244 {cx0+sx*18} 246 {cx0+sx*24} 246 {cx0+sx*28} 250 {cx0+sx*14} 252 {cx0+sx*6} 250 {cx0} 248Z" fill="{L}" stroke="{D}" stroke-width="1"/>')
        o += f'<g class="an an-wing {"an-o-r" if sx < 0 else "an-o-l"}">{w}</g>'
    o += feet(256)
    # kısa tunik
    o += pleats(126, 172, 78, 122, 70, 130, n=8, wave=2)
    o += male_torso()
    # sol omuzdan sarkan pelerin (khlamys)
    o += (f'<path d="M72 66C56 76 50 118 56 176L72 168L80 72Z" fill="{S}" stroke="{D}" stroke-width="1.1"/>'
          f'<path d="M64 84C62 110 62 140 64 168M70 76C70 110 70 140 70 164" fill="none" stroke="{D}" stroke-width=".9" opacity=".7"/>')
    o += f'<circle cx="76" cy="68" r="3" fill="{L}" stroke="{D}" stroke-width="1"/>'
    # kollar
    o += limb([(72, 68), (64, 100), (70, 126)], 11)
    o += limb([(128, 68), (142, 92), (150, 84)], 11)
    o += f'<circle cx="152" cy="84" r="4.5" fill="{M}" stroke="{D}" stroke-width="1"/>'
    # baş: kısa lüleler + kanatlı petasos
    neck, face = head()
    hd = neck + face + hair_front(rows=2)
    for x, y in [(90, 36), (110, 36), (89, 43), (111, 43)]:
        hd += curl(x, y, 4)
    hd += (f'<path d="M86 28C86 12 114 12 114 28C108 24 92 24 86 28Z" fill="{M}" stroke="{D}" stroke-width="1.1"/>'
          f'<path d="M100 12C109 12 114 18 114 28C108 24 104 24 100 24Z" fill="{D}" opacity=".22"/>'
          f'<path d="M80 29C92 24 108 24 120 29" fill="none" stroke="{D}" stroke-width="1.6" stroke-linecap="round"/>')
    pw = (f'<path d="M86 22C78 16 68 16 60 20 67 21 72 25 75 29 68 30 64 34 61 38 70 36 78 34 86 34Z" fill="{L}" stroke="{D}" stroke-width="1"/>'
          f'<path d="M84 24C76 21 70 21 65 23M84 30C76 28 70 29 66 31" fill="none" stroke="{D}" stroke-width=".7"/>')
    hd += f'<g class="an an-wing an-o-r">{pw}</g>' + f'<g transform="translate(200 0) scale(-1 1)"><g class="an an-wing an-o-r">{pw}</g></g>'
    o += HEAD(hd)
    o += plinth()
    return o + '</svg>'


# ------------------------------------------------------------------ APOLLON
def apollon():
    o = open_svg('Apollon: defne taçlı, lir tutan mermer heykel') + niche()
    # güneş halesi
    o += '<g class="an an-sun">'
    o += f'<circle cx="100" cy="38" r="30" fill="none" stroke="{M}" stroke-opacity=".5" stroke-width="1.4"/>'
    for deg in range(0, 360, 20):
        x1, y1 = pol(100, 38, 33, deg); x2, y2 = pol(100, 38, 41, deg)
        o += f'<path d="M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}" stroke="{M}" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/>'
    o += '</g>'
    # lir (sağ elde)
    o += '<g class="an an-lyre">'
    o += (f'<path d="M142 120C128 108 130 82 142 70" fill="none" stroke="{D}" stroke-width="7" stroke-linecap="round"/>'
          f'<path d="M142 120C128 108 130 82 142 70" fill="none" stroke="{M}" stroke-width="5" stroke-linecap="round"/>'
          f'<path d="M168 120C182 108 180 82 168 70" fill="none" stroke="{D}" stroke-width="7" stroke-linecap="round"/>'
          f'<path d="M168 120C182 108 180 82 168 70" fill="none" stroke="{M}" stroke-width="5" stroke-linecap="round"/>'
          f'<path d="M138 72H172" stroke="{D}" stroke-width="7" stroke-linecap="round"/><path d="M138 72H172" stroke="{S}" stroke-width="5" stroke-linecap="round"/>'
          f'<g class="an an-strings"><path d="M146 76V122M152 76V122M158 76V122M164 76V122" stroke="{D}" stroke-width="1"/></g>'
          f'<path d="M136 118C136 140 174 140 174 118Z" fill="{M}" stroke="{D}" stroke-width="1.2"/>')
    o += '</g>'
    # uzun khiton
    o += pleats(126, 256, 78, 122, 60, 140, n=11, wave=3)
    o += male_torso()
    # himation: sol omuz-üst bacak çapraz
    o += (f'<path d="M72 66L96 62L128 100L124 128H96L74 80Z" fill="{S}" stroke="{D}" stroke-width="1.1"/>'
          f'<path d="M82 76Q96 90 112 106M90 70Q104 88 118 106" fill="none" stroke="{D}" stroke-width=".9" opacity=".7"/>')
    o += limb([(72, 68), (64, 100), (70, 128)], 11)
    o += limb([(128, 68), (146, 92), (148, 116)], 11)
    o += f'<circle cx="148" cy="120" r="4.2" fill="{M}" stroke="{D}" stroke-width="1"/>'
    neck, face = head()
    hd = hair_back_long(drop=46) + neck + face + hair_front()
    for deg in range(196, 345, 11):
        x, y = pol(100, 34, 15, deg)
        hd += leaf(x, y, deg + 90 - 25, 1.0) + leaf(x, y, deg + 90 + 25, 1.0)
    o += HEAD(hd)
    o += feet() + plinth()
    return o + '</svg>'


# ------------------------------------------------------------------ IRIS
def iris():
    o = open_svg('Iris: kanatlı, uzun peplos giyen, testi tutan mermer heykel') + niche()
    # arkada geniş kanatlar
    wing = ''
    for i, (tipx, tipy) in enumerate([(14, 42), (8, 78), (10, 114), (18, 148), (32, 178)]):
        wing += (f'<path d="M78 76C60 {62+i*8} {tipx+14} {tipy-6} {tipx} {tipy} {tipx+16} {tipy+14} {52} {96+i*10} 78 {104+i*6}Z" '
                 f'fill="{TONES[min(i*2, 8)]}" stroke="{D}" stroke-width="1"/>')
    o += f'<g class="an an-wing an-o-iris">{wing}</g>' + f'<g transform="translate(200 0) scale(-1 1)"><g class="an an-wing an-o-iris">{wing}</g></g>'
    # uzun peplos
    o += pleats(112, 256, 80, 120, 62, 138, n=10, wave=3)
    # üst gövde (daha dar, kadın)
    o += (f'<path d="M76 70C76 64 86 62 94 62H106C114 62 124 64 124 70L120 112H80Z" fill="{M}" stroke="{D}" stroke-width="1.2"/>'
          f'<path d="M100 62H106C114 62 124 64 124 70L120 112H100Z" fill="{D}" opacity=".2"/>'
          f'<path d="M80 84Q100 100 120 84" fill="none" stroke="{D}" stroke-width="1"/>'
          f'<path d="M78 100H122M78 104H122" stroke="{D}" stroke-width="1.6"/>'
          f'<path d="M84 70L100 112M116 70L100 112" fill="none" stroke="{D}" stroke-width="1" opacity=".7"/>')
    # sol kol aşağıda, sağ kol testi tutuyor
    o += limb([(76, 70), (68, 98), (72, 124)], 10)
    o += limb([(124, 70), (140, 92), (150, 110)], 10)
    o += (f'<path d="M144 106C136 112 134 128 140 138 146 146 160 146 166 138 172 128 168 112 160 106 162 100 158 96 152 96 146 96 142 100 144 106Z" fill="{M}" stroke="{D}" stroke-width="1.1"/>'
          f'<path d="M152 96C158 96 162 100 160 106 168 112 172 128 166 138 160 146 152 146 152 146Z" fill="{D}" opacity=".22"/>'
          f'<path d="M166 112C176 112 178 126 168 130" fill="none" stroke="{D}" stroke-width="3" stroke-linecap="round"/>')
    # baş: saç bandı + topuz
    neck, face = head(female=True)
    hd = neck
    hd += (f'<path d="M89 40C84 22 92 14 100 14S116 22 111 40C110 28 106 22 100 22S90 28 89 40Z" fill="{M}" stroke="{D}" stroke-width="1"/>')
    hd += face
    hd += (f'<path d="M100 20C94 20 90 26 90 32 93 27 97 25 100 25Z" fill="{M}" stroke="{D}" stroke-width="1"/>'
          f'<path d="M100 20C106 20 110 26 110 32 107 27 103 25 100 25Z" fill="{M}" stroke="{D}" stroke-width="1"/>'
          f'<path d="M91 28Q100 18 109 28" fill="none" stroke="{D}" stroke-width="2.4" stroke-linecap="round"/>')
    hd += curl(100, 14, 5.5)
    o += HEAD(hd)
    o += feet() + plinth()
    return o + '</svg>'


# ------------------------------------------------------------------ HADES (Kut Mührü)
def hades():
    o = open_svg('Hades: bident ve anahtar tutan, sakallı mermer heykel') + niche()
    # bident (iki dişli mızrak)
    o += limb([(152, 44), (152, 262)], 4)
    o += (f'<path d="M142 12V32Q142 44 152 44Q162 44 162 32V12" fill="none" stroke="{D}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>'
          f'<path d="M142 12V32Q142 44 152 44Q162 44 162 32V12" fill="none" stroke="{M}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
          f'<path d="M139 16L142 6L145 16ZM159 16L162 6L165 16Z" fill="{M}" stroke="{D}" stroke-width="1"/>')
    # uzun khiton
    o += pleats(126, 256, 78, 122, 60, 140, n=11, wave=3)
    o += male_torso()
    # sol omuzdan inen ağır himation
    o += (f'<path d="M72 64C52 78 44 140 48 214L72 226L82 74Z" fill="{S}" stroke="{D}" stroke-width="1.1"/>'
          f'<path d="M62 84C58 120 56 160 58 210M70 78C68 120 66 160 66 218" fill="none" stroke="{D}" stroke-width=".9" opacity=".7"/>')
    o += f'<path d="M72 66L90 62L120 108L116 126L96 118Z" fill="{S}" stroke="{D}" stroke-width="1.1"/>'
    # sol kol: anahtar tutuyor
    o += limb([(72, 68), (62, 98), (66, 124)], 11)
    o += (f'<circle cx="62" cy="130" r="3.4" fill="none" stroke="{D}" stroke-width="1.8"/>'
          f'<circle cx="62" cy="130" r="3.4" fill="none" stroke="{M}" stroke-width=".9"/>'
          f'<path d="M62 134V156M62 148H67M62 154H66" fill="none" stroke="{D}" stroke-width="2.6" stroke-linecap="round"/>'
          f'<path d="M62 134V156M62 148H67M62 154H66" fill="none" stroke="{M}" stroke-width="1.2" stroke-linecap="round"/>')
    # sağ kol: bident'i tutuyor
    o += limb([(128, 68), (142, 90), (150, 82)], 11)
    o += f'<circle cx="152" cy="82" r="4.5" fill="{M}" stroke="{D}" stroke-width="1"/>'
    neck, face = head()
    hd = hair_back_long(drop=40) + neck + face + beard_curls() + hair_front()
    hd += f'<path d="M88 31Q100 24 112 31" fill="none" stroke="{D}" stroke-width="2.4" stroke-linecap="round"/>'
    hd += f'<path d="M88 31Q100 24 112 31" fill="none" stroke="{L}" stroke-width="1" stroke-linecap="round"/>'
    o += HEAD(hd)
    o += feet() + plinth()
    return o + '</svg>'



import re

DARK, CREAM = '#131313', '#d7ccb2'


def lineart(svg):
    """Mermer dolgulu çizimi, dolgusuz ince çizgi (line-art) stiline çevirir:
    gölge katmanlarını siler, mermer tonlarını zemin rengi yapar (üst üste binen çizgiler kapansın),
    koyu kontur rengini krem çizgi yapar."""
    # gölge/yarı saydam kat (kontur renginde dolgu + opacity) ve uzuv gölge şeritleri
    svg = re.sub(r'<(?:path|rect|ellipse|circle)[^>]*fill="#7c735b"[^>]*opacity="[^"]*"[^>]*/>', '', svg)
    svg = re.sub(r'<path[^>]*stroke-opacity="\.18"[^>]*/>', '', svg)
    # kırmızı disk: dolgu yerine ince kırmızı daire çizgisi
    svg = svg.replace(f'<circle cx="100" cy="112" r="58" fill="{R}"/>', f'<circle cx="100" cy="112" r="58" fill="none" stroke="{R}" stroke-width="2"/>')
    mapping = {M: DARK, L: DARK, S: DARK, D: CREAM}
    svg = re.sub(r'#(?:d7ccb2|ece4cf|b3a98e|7c735b)', lambda m: mapping['#' + m.group(0)[1:]], svg)
    # çizgileri incelt
    def thin(m):
        v = float(m.group(1))
        # kalın (uzuv/sopa dolgusu) çizgilere dokunma; sadece ince kontur çizgilerini incelt
        return m.group(0) if v > 3.6 else f'stroke-width="{max(0.9, v * 0.85):.2f}"'
    svg = re.sub(r'stroke-width="([0-9.]+)"', thin, svg)
    return svg


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    import sys
    solid = '--solid' in sys.argv          # eski mermer dolgulu stil
    for name, fn in [('dionysos', dionysos), ('hermes', hermes), ('apollon', apollon), ('iris', iris), ('hades', hades)]:
        svg = fn()
        open(os.path.join(OUT, f'{name}.svg'), 'w', encoding='utf8').write(svg if solid else lineart(svg))
    print('5 heykel yazıldı ->', os.path.abspath(OUT))
