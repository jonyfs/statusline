"""Proof sheet for specs/046-gauges.

The five-cell track at 0, 10, 50, 90 and 100 percent and for an unknown
figure, then the eighth blocks an agent row's bar is built from, all drawn
from FiraCode Nerd Font Mono, so the picture is the evidence that EE00 to
EE05 join into a track and that U+2589 to U+258F step in eighths.

    python3 specs/046-gauges/gauge-sheet.py specs/046-gauges/gauge-evidence.png
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"
big = ImageFont.truetype(FONT, 30)
small = ImageFont.truetype(FONT, 14)
BASE, FG, DIM, OK, CRIT = "#1e1e2e", "#cdd6f4", "#a6adc8", "#a6e3a1", "#f38ba8"

EMPTY = ["", "", "", "", ""]
FULL = ["", "", "", "", ""]


def track(pct):
    if pct is None:
        return "".join(EMPTY)
    return "".join(FULL[i] if pct >= (i + 0.5) * 20 else EMPTY[i] for i in range(5))


def eighths(pct, cells=8):
    steps = round(pct / 100 * cells * 8)
    whole, rem = divmod(steps, 8)
    part = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"][rem]
    return "█" * whole + part + " " * (cells - whole - (1 if part else 0))


rows = [(f"{p}%", track(p), "" if p >= 85 else "") for p in (0, 10, 50, 90, 100)]
rows.append(("unknown", track(None), ""))

img = Image.new("RGB", (760, 70 + 46 * len(rows) + 60 + 46 * 4), BASE)
d = ImageDraw.Draw(img)
d.text((12, 8), "specs/046-gauges: the track (EE00 to EE05) and the eighth blocks, from FiraCode Nerd Font Mono", font=small, fill=FG)
y = 40
for label, cells, mark in rows:
    d.text((12, y + 10), label, font=small, fill=FG)
    d.text((150, y), cells, font=big, fill=OK if not mark else CRIT)
    if mark:
        d.text((340, y), mark, font=big, fill=CRIT)
    y += 46
y += 20
d.text((12, y), "agent row bar, eight cells", font=small, fill=DIM)
y += 28
for pct in (0, 12, 50, 99):
    d.text((12, y + 10), f"{pct}%", font=small, fill=FG)
    d.text((150, y), eighths(pct), font=big, fill=OK)
    y += 46
img.save(sys.argv[1] if len(sys.argv) > 1 else "gauge-evidence.png")
print("wrote", sys.argv[1] if len(sys.argv) > 1 else "gauge-evidence.png")
