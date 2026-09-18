"""Pull the actual palette and saturation profile out of the style references.

Run from the repo root:  python3 references/analyse.py
Kept in the repo so the design tokens can be re-derived if the references change.
"""

import colorsys
import pathlib

from PIL import Image

REFS = sorted(pathlib.Path(__file__).parent.glob("*.jpg"))


def hex_of(rgb):
    return "#{:02x}{:02x}{:02x}".format(*rgb)


for path in REFS:
    img = Image.open(path).convert("RGB")
    small = img.resize((200, 112))

    # Dominant colours by simple quantisation.
    quant = small.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = quant.getpalette()
    counts = sorted(quant.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)

    dominant = []
    for count, idx in counts:
        rgb = tuple(palette[idx * 3 : idx * 3 + 3])
        dominant.append((hex_of(rgb), round(100 * count / total)))

    # Saturation + value distribution over every pixel.
    sats, vals = [], []
    for r, g, b in small.getdata():
        _, _, s = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        h, _, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        sats.append(s)
        vals.append(v)

    sats.sort()
    vals.sort()
    n = len(sats)

    def pct(seq, p):
        return round(seq[int(p * (n - 1))], 2)

    print(f"\n=== {path.name}  ({img.width}x{img.height}, {img.width / img.height:.2f}:1)")
    print("  dominant:", "  ".join(f"{h} {p}%" for h, p in dominant))
    print(
        f"  saturation  median {pct(sats, 0.5)}  p90 {pct(sats, 0.9)}  p99 {pct(sats, 0.99)}"
    )
    print(f"  value       median {pct(vals, 0.5)}  p10 {pct(vals, 0.1)}  p90 {pct(vals, 0.9)}")
