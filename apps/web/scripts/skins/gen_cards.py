"""標準スキンのカード（案A：1枚 = ダーツ1本）を作る。すべて自作の SVG

  python3 apps/web/scripts/skins/gen_cards.py

数字は src/standard-digits の 7 セグメントの数字（得点表と同じ書体）を上に載せ、
その下に羽根がボードの色（赤・緑）のダーツを1本描く。角の丸みは幅の約5%。
"""
import math, os, re

ROOT = os.path.join(os.path.dirname(__file__), "../../public/skins/standard")
W, H = 44, 112
R = round(W * 0.05, 2)
S = 4  # 書き出す画素の倍率
RED, GREEN, INK = "#d93a3a", "#2fa36b", "#1d2027"
# ボードの並び（20 から時計回り）で、20 が赤・1 が緑…と交互になる。その数字の帯の色を羽根の色にする
ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
FLIGHT = {n: RED if ORDER.index(n) % 2 == 0 else GREEN for n in range(15, 21)}


def svg(body, w=W, h=H):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * S}" height="{h * S}">{body}</svg>'


def dart(cx, top, length, flight):
    """先を下に向けたダーツ。羽根は後ろ（上）が広く、シャフトに向かって細くなる"""
    fl, sh, br, tp = length * 0.3, length * 0.2, length * 0.32, length * 0.18
    y = top
    half = lambda d: (
        f'M{cx} {y + fl} L{cx} {y} L{cx + d * 9.5} {y + 1.5} '
        f'L{cx + d * 10.5} {y + fl * 0.5} Q{cx + d * 6} {y + fl * 0.8} {cx} {y + fl} Z'
    )
    out = [
        f'<path d="{half(1)}" fill="{flight}"/>',
        f'<path d="{half(-1)}" fill="{flight}"/>',
        f'<path d="{half(-1)}" fill="#000" opacity="0.14"/>',
        f'<line x1="{cx}" y1="{y}" x2="{cx}" y2="{y + fl}" stroke="{INK}" stroke-width="0.9"/>',
    ]
    y += fl
    out.append(f'<rect x="{cx - 1.1}" y="{y - 1}" width="2.2" height="{sh + 1}" rx="0.6" fill="#3a3f4a"/>')
    y += sh
    out.append(f'<rect x="{cx - 2.9}" y="{y}" width="5.8" height="{br}" rx="2.2" fill="#9aa1ad"/>')
    out.append(f'<rect x="{cx - 2.9}" y="{y}" width="2" height="{br}" rx="1" fill="#ffffff" opacity="0.35"/>')
    for k in range(1, 7):
        yy = y + br * k / 7
        out.append(f'<line x1="{cx - 2.7}" y1="{yy:.2f}" x2="{cx + 2.7}" y2="{yy:.2f}" stroke="#5d636e" stroke-width="0.6"/>')
    y += br
    out.append(f'<path d="M{cx - 1} {y} L{cx + 1} {y} L{cx} {y + tp} Z" fill="#c9ced6" stroke="#5d636e" stroke-width="0.35"/>')
    return "".join(out)


def inner(path):
    """既存の SVG の中身と viewBox を取り出す"""
    text = open(path).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', text).group(1).split()]
    body = re.sub(r"^<svg[^>]*>|</svg>$", "", text)
    return vb, body


def place(path, x, y, w):
    (_, _, vw, vh), body = inner(path)
    k = w / vw
    return f'<g transform="translate({x} {y}) scale({k:.4f})">{body}</g>', vh * k


def write(name, text):
    with open(os.path.join(ROOT, name), "w") as f:
        f.write(text)


# 表の地：白に細い縁
write("card-face.svg", svg(
    f'<rect x="0.4" y="0.4" width="{W - 0.8}" height="{H - 0.8}" rx="{R}" fill="#fbfbf9" stroke="#c8ccd3" stroke-width="0.8"/>'))

# 数字のカード：上に数字、下にダーツ
DIGITS = os.path.join(os.path.dirname(__file__), "src/standard-digits")
for n in range(15, 21):
    num, h = place(os.path.join(DIGITS, f"{n}.svg"), 3, 5, W - 6)
    write(f"glyphs/{n}.svg", svg(num + dart(W / 2, 5 + h + 4, H - (5 + h + 4) - 4, FLIGHT[n])))

# ブル：上にブルの印と BULL の字、下にダーツ（羽根は赤）
bull_mark = (f'<circle cx="22" cy="20" r="13" fill="{INK}"/><circle cx="22" cy="20" r="11.2" fill="{GREEN}"/>'
             f'<circle cx="22" cy="20" r="5" fill="{RED}"/>'
             f'<circle cx="22" cy="20" r="11.2" fill="none" stroke="#c9ced8" stroke-width="0.7"/>'
             f'<circle cx="22" cy="20" r="5" fill="none" stroke="#c9ced8" stroke-width="0.7"/>'
             f'<ellipse cx="19.5" cy="16.5" rx="2.2" ry="1.1" fill="#fff" opacity="0.35" transform="rotate(-35 19.5 16.5)"/>')
write("glyphs/bull.svg", svg(bull_mark + dart(W / 2, 40, H - 44, RED)))

# 裏：紺のダーツボード柄に金の縁
segs = []
for i in range(20):
    a0, a1 = math.radians(-9 + i * 18), math.radians(9 + i * 18)
    p = lambda a, r: (22 + r * math.sin(a), 56 - r * math.cos(a))
    (x0, y0), (x1, y1) = p(a0, 34), p(a1, 34)
    segs.append(f'<path d="M22 56 L{x0:.2f} {y0:.2f} A34 34 0 0 1 {x1:.2f} {y1:.2f} Z" fill="{"#1d2433" if i % 2 else "#141a26"}"/>')
write("card-back.svg", svg(
    f'<defs><clipPath id="c"><rect x="2.5" y="2.5" width="{W - 5}" height="{H - 5}" rx="{R}"/></clipPath></defs>'
    f'<rect x="0.4" y="0.4" width="{W - 0.8}" height="{H - 0.8}" rx="{R}" fill="#101520" stroke="#c8ccd3" stroke-width="0.8"/>'
    f'<g clip-path="url(#c)">{"".join(segs)}'
    f'<circle cx="22" cy="56" r="33" fill="none" stroke="{RED}" stroke-width="1.8"/>'
    f'<circle cx="22" cy="56" r="20" fill="none" stroke="{GREEN}" stroke-width="1.8"/></g>'
    f'<circle cx="22" cy="56" r="5" fill="{GREEN}"/><circle cx="22" cy="56" r="2.2" fill="{RED}"/>'
    f'<rect x="2.5" y="2.5" width="{W - 5}" height="{H - 5}" rx="{R}" fill="none" stroke="#c9a64a" stroke-width="0.8"/>'))
print("ok")
