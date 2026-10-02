#!/usr/bin/env python3
"""Tanrı büstlerini (mermer heykel stili, düz renk) SVG olarak üretir.
Kullanım: python3 scripts/draw-statues.py  ->  assets/img/tanrilar/*.svg
Not: Bunlar yer tutucu çizimlerdir; yerlerine gerçek illüstrasyon konulabilir (data/hub.json)."""
import math, os

M, L, S, D = '#d7ccb2', '#ece4cf', '#b3a98e', '#7c735b'   # mermer açık, en açık, gölge, çizgi
K, G, R = '#101010', '#b08a3e', '#8b0d0d'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img', 'tanrilar')

def pol(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)

def curl(x, y, r, fill=M):
    """Tek bir saç lülesi: daire + içinde kıvrım."""
    return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}" stroke="{D}" stroke-width="1.4"/>'
            f'<path d="M{x-r*0.5:.1f} {y+r*0.1:.1f}a{r*0.5:.1f} {r*0.5:.1f} 0 1 1 {r*0.9:.1f} {r*0.35:.1f}" fill="none" stroke="{D}" stroke-width="1.1" stroke-linecap="round"/>')

def leaf(x, y, rot, size, fill=G):
    return (f'<path transform="translate({x:.1f} {y:.1f}) rotate({rot:.1f}) scale({size})" '
            f'd="M0 0C4-6 11-6 15 0 11 6 4 6 0 0Z" fill="{fill}" stroke="{D}" stroke-width="{1.1/size:.2f}"/>')

def frame_open(label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="{label}">'
            f'<defs><clipPath id="c"><circle cx="120" cy="120" r="113"/></clipPath></defs>'
            f'<circle cx="120" cy="120" r="114" fill="{K}"/><g clip-path="url(#c)">')

def frame_close():
    return (f'</g><circle cx="120" cy="120" r="114" fill="none" stroke="{G}" stroke-width="2.4"/>'
            f'<circle cx="120" cy="120" r="107" fill="none" stroke="{G}" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="1.5 7" stroke-linecap="round"/></svg>')

FACE_Y = 'M89 90C89 67 103 55 120 55S151 67 151 90C151 112 141 134 120 142 99 134 89 112 89 90Z'
FACE_O = 'M91 90C91 68 104 57 120 57S149 68 149 90C149 110 140 132 120 140 100 132 91 110 91 90Z'  # daha ince (kadın)

def shoulders(drape=True):
    s = (f'<path d="M26 240V216C30 192 62 180 94 173H146C178 180 210 192 214 216V240Z" fill="{M}" stroke="{D}" stroke-width="1.6"/>'
         f'<path d="M120 173H146C178 180 210 192 214 216V240H120Z" fill="{D}" opacity=".22"/>')
    if drape:
        s += (f'<path d="M94 173 120 210 146 173" fill="none" stroke="{D}" stroke-width="2.4" stroke-linejoin="round"/>'
              f'<path d="M64 192C74 208 84 222 88 240M176 192C166 208 156 222 152 240M100 188C104 206 108 222 110 240M140 188C136 206 132 222 130 240" fill="none" stroke="{D}" stroke-width="1.6" stroke-linecap="round"/>')
    return s

def neck():
    return (f'<path d="M103 126V178C112 184 128 184 137 178V126Z" fill="{M}" stroke="{D}" stroke-width="1.6"/>'
            f'<path d="M120 126H137V178C131 181 125 183 120 183Z" fill="{D}" opacity=".22"/>'
            f'<path d="M103 144C112 156 128 156 137 144V160C128 170 112 170 103 160Z" fill="{D}" opacity=".18"/>')

def face(path, beard=False, female=False):
    f = (f'<path d="{path}" fill="{M}" stroke="{D}" stroke-width="1.6"/>'
         f'<path d="{path}" fill="{D}" opacity="0" />'
         f'<clipPath id="fc"><path d="{path}"/></clipPath>'
         f'<rect x="120" y="50" width="40" height="100" fill="{D}" opacity=".2" clip-path="url(#fc)"/>')
    by = 87
    # kaşlar
    f += f'<path d="M98 {by}Q108 {by-6} 117 {by-1}M123 {by-1}Q132 {by-6} 142 {by}" fill="none" stroke="{D}" stroke-width="3" stroke-linecap="round"/>'
    # boş (heykel) gözler
    f += (f'<path d="M100 {by+8}Q108 {by+3} 116 {by+8}Q108 {by+12} 100 {by+8}Z" fill="{L}" stroke="{D}" stroke-width="1.4"/>'
          f'<path d="M124 {by+8}Q132 {by+3} 140 {by+8}Q132 {by+12} 124 {by+8}Z" fill="{L}" stroke="{D}" stroke-width="1.4"/>')
    # burun
    f += (f'<path d="M120 {by+6}L117 112Q112 118 118 120Q120 121 122 120Q128 118 123 112Z" fill="none" stroke="{D}" stroke-width="1.8" stroke-linejoin="round"/>'
          f'<path d="M123 {by+8}L123 112" stroke="{D}" stroke-width="2.4" opacity=".25"/>')
    # ağız
    if not beard:
        f += (f'<path d="M110 127Q120 {131 if female else 130} 130 127" fill="none" stroke="{D}" stroke-width="2.2" stroke-linecap="round"/>'
              f'<path d="M113 131Q120 134 127 131" fill="none" stroke="{D}" stroke-width="1.2" stroke-linecap="round"/>')
    return f

def halo(extra=''):
    return f'<circle cx="120" cy="92" r="68" fill="{R}"/>' + extra

def bust(inner):
    # büstü biraz büyütüp alta sabitler
    return f'<g transform="translate(120 252) scale(1.15) translate(-120 -238)">{inner}</g>'

# ---------------------------------------------------------------- DIONYSOS
def dionysos():
    o = frame_open('Dionysos: sarmaşık taçlı, sakallı mermer büst') + halo()
    inner = ''
    # saç alt zemini (gölgeli mermer) + omuzlara dökülen lüleler
    inner += f'<path d="M86 70C70 80 66 120 74 152L100 130V76ZM154 70C170 80 174 120 166 152L140 130V76Z" fill="{S}" stroke="{D}" stroke-width="1.4"/>'
    back = [(80, 78), (156 - 1, 78), (76, 94), (160, 94), (74, 110), (162, 110), (76, 126), (160, 126), (80, 142), (156, 142), (86, 154), (150, 154)]
    inner += ''.join(curl(x, y, 10.5) for x, y in back)
    inner += shoulders() + neck()
    inner += face(FACE_Y, beard=True)
    # sakal: dolgun gövde + kenarında lüleler + tel çizgileri
    inner += (f'<path d="M90 102C88 130 96 150 108 162Q112 170 120 172Q128 170 132 162C144 150 152 130 150 102C144 120 132 126 120 125C108 126 96 120 90 102Z" fill="{M}" stroke="{D}" stroke-width="1.6" stroke-linejoin="round"/>'
              f'<path d="M120 125V170" stroke="{D}" stroke-width="1.2" opacity=".6"/>'
              f'<path d="M150 102C152 130 144 150 132 162Q128 170 120 172V125C132 126 144 120 150 102Z" fill="{D}" opacity=".2"/>'
              f'<path d="M98 132C104 142 108 152 112 164M142 132C136 142 132 152 128 164M104 128C108 136 112 142 114 150M136 128C132 136 128 142 126 150" fill="none" stroke="{D}" stroke-width="1.1" stroke-linecap="round"/>')
    for (x, y) in [(94, 114), (146, 114), (96, 128), (144, 128), (102, 144), (138, 144), (110, 160), (130, 160), (120, 168)]:
        inner += curl(x, y, 6.5)
    # bıyık + ağız
    inner += (f'<path d="M103 121Q112 116 120 122Q128 116 137 121Q129 128 120 125Q111 128 103 121Z" fill="{M}" stroke="{D}" stroke-width="1.5" stroke-linejoin="round"/>'
              f'<path d="M114 131Q120 134 126 131" fill="none" stroke="{D}" stroke-width="1.6" stroke-linecap="round"/>')
    # alın lüleleri
    for x in range(97, 146, 9):
        inner += curl(x + (x % 3), 66 + abs(x - 120) * 0.13, 7.5)
    # sarmaşık tacı
    for deg in range(196, 345, 12):
        x, y = pol(120, 88, 40, deg)
        inner += leaf(x, y, deg + 90 + (10 if deg % 24 else -10), 1.0)
    # şakaklarda üzüm salkımı
    for sx in (-1, 1):
        for (dx, dy) in [(0, 0), (9, 0), (4.5, 8), (13, 8), (9, 16)]:
            x = 120 + sx * (39 + dx)
            inner += f'<circle cx="{x:.1f}" cy="{98 + dy}" r="5" fill="{R}" stroke="{L}" stroke-width="1.1"/>'
    return o + bust(inner) + frame_close()

# ---------------------------------------------------------------- HERMES
def hermes():
    o = frame_open('Hermes: kanatlı şapkalı genç mermer büst') + halo()
    inner = ''
    for sx in (-1, 1):
        for (dx, y) in [(30, 88), (32, 102), (31, 116), (27, 128)]:
            inner += curl(120 + sx * dx, y, 9)
    inner += shoulders() + neck() + face(FACE_Y)
    for x in range(100, 142, 9):
        inner += curl(x, 75 + abs(x - 120) * 0.15, 7)
    wing = (f'<path d="M92 64C74 52 54 52 36 62 52 63 64 68 72 74 58 76 48 82 40 92 58 87 74 85 90 85Z" fill="{M}" stroke="{D}" stroke-width="1.6" stroke-linejoin="round"/>'
            f'<path d="M84 66C72 61 60 60 50 63M82 74C72 72 62 73 54 77M86 82C76 82 66 84 58 88" fill="none" stroke="{D}" stroke-width="1.3"/>')
    inner += wing + f'<g transform="translate(240 0) scale(-1 1)">{wing}</g>'
    inner += (f'<path d="M86 75C84 41 156 41 154 75C140 67 100 67 86 75Z" fill="{G}" stroke="{D}" stroke-width="1.6" stroke-linejoin="round"/>'
              f'<path d="M154 75C156 41 120 41 120 41V69C134 69 146 71 154 75Z" fill="{D}" opacity=".25"/>'
              f'<path d="M88 75C100 69 140 69 152 75" fill="none" stroke="{D}" stroke-width="1.6"/>')
    return o + bust(inner) + frame_close()

# ---------------------------------------------------------------- APOLLON
def apollon():
    sun = f'<circle cx="120" cy="92" r="80" fill="none" stroke="{G}" stroke-width="2"/>'
    for deg in range(0, 360, 15):
        x1, y1 = pol(120, 92, 84, deg); x2, y2 = pol(120, 92, 98 if deg % 30 == 0 else 92, deg)
        sun += f'<path d="M{x1:.1f} {y1:.1f}L{x2:.1f} {y2:.1f}" stroke="{G}" stroke-width="2" stroke-linecap="round"/>'
    o = frame_open('Apollon: defne taçlı, uzun saçlı genç mermer büst') + halo(sun)
    inner = ''
    inner += f'<path d="M88 70C70 84 64 130 70 176L100 150V76ZM152 70C170 84 176 130 170 176L140 150V76Z" fill="{S}" stroke="{D}" stroke-width="1.4"/>'
    for i, y in enumerate(range(76, 178, 12)):
        for sx in (-1, 1):
            inner += curl(120 + sx * (38 + min(i, 3) * 1.5 + (i % 2) * 4 - (2 if i > 5 else 0)), y, 10)
    inner += shoulders() + neck() + face(FACE_Y)
    for sx in (-1, 1):
        for (dx, y) in [(8, 66), (18, 67), (28, 72), (35, 82), (37, 94)]:
            inner += curl(120 + sx * dx, y, 8)
    for deg in range(194, 347, 11):
        x, y = pol(120, 90, 42, deg)
        inner += leaf(x, y, deg + 90 - 25, 1.05) + leaf(x, y, deg + 90 + 25, 1.05)
    return o + bust(inner) + frame_close()

# ---------------------------------------------------------------- IRIS
def iris():
    o = frame_open('Iris: kanatlı, gökkuşağı arkalı kadın mermer büst')
    for r, c in [(98, R), (88, G), (78, M)]:
        o += f'<path d="M{120-r} 140A{r} {r} 0 0 1 {120+r} 140" fill="none" stroke="{c}" stroke-width="7"/>'
    inner = ''
    wing = (f'<path d="M90 180C52 172 22 132 24 70 42 88 54 100 62 120 58 104 58 92 62 80 76 98 84 116 86 140Z" fill="{M}" stroke="{D}" stroke-width="1.6" stroke-linejoin="round"/>'
            f'<path d="M30 80C44 98 60 120 78 150M44 78C54 98 66 118 82 142M58 84C64 100 72 116 84 136" fill="none" stroke="{D}" stroke-width="1.3"/>'
            f'<path d="M62 120C74 128 82 140 90 180C80 178 70 174 62 168Z" fill="{D}" opacity=".16"/>')
    inner += wing + f'<g transform="translate(240 0) scale(-1 1)">{wing}</g>'
    inner += shoulders()
    inner += (f'<path d="M89 100C80 70 94 48 120 48S160 70 151 100C150 80 142 66 120 64 98 66 90 80 89 100Z" fill="{M}" stroke="{D}" stroke-width="1.5"/>'
              f'<path d="M92 92C88 140 90 152 100 164C98 142 96 122 100 104Z" fill="{M}" stroke="{D}" stroke-width="1.4"/>'
              f'<path d="M148 92C152 140 150 152 140 164C142 142 144 122 140 104Z" fill="{M}" stroke="{D}" stroke-width="1.4"/>')
    inner += neck() + face(FACE_O, female=True)
    inner += (f'<path d="M120 55C106 56 94 64 91 84 100 68 110 64 120 64Z" fill="{M}" stroke="{D}" stroke-width="1.5"/>'
              f'<path d="M120 55C134 56 146 64 149 84 140 68 130 64 120 64Z" fill="{M}" stroke="{D}" stroke-width="1.5"/>'
              f'<path d="M120 56C108 60 98 68 94 80M120 56C132 60 142 68 146 80M120 62C110 65 102 71 97 80M120 62C130 65 138 71 143 80" fill="none" stroke="{D}" stroke-width="1.2"/>')
    inner += f'<path d="M93 68Q120 50 147 68" fill="none" stroke="{G}" stroke-width="4" stroke-linecap="round"/>'
    inner += f'<path d="M120 54l3.5 6-3.5 6-3.5-6z" fill="{G}" stroke="{D}" stroke-width="1"/>'
    return o + bust(inner) + frame_close()

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('dionysos', dionysos), ('hermes', hermes), ('apollon', apollon), ('iris', iris)]:
        open(os.path.join(OUT, f'{name}.svg'), 'w', encoding='utf8').write(fn())
    print('4 büst yazıldı ->', os.path.abspath(OUT))
