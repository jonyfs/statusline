"""Proof sheet for specs/045-separators-layout.

Each separator style is drawn from FiraCode Nerd Font Mono between three
chips, the way `renderRow` joins them, so the picture is the evidence that the
glyph draws the shape the style claims, not a codepoint name.

    python3 specs/045-separators-layout/separator-sheet.py specs/045-separators-layout/separator-evidence.png
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"
big = ImageFont.truetype(FONT, 30)
small = ImageFont.truetype(FONT, 14)

BASE, A, B, C, TEXT, CRUST = "#1e1e2e", "#b4befe", "#45475a", "#f38ba8", "#cdd6f4", "#11111b"
CELL, CHIP = 24, 78


def run(d, y, parts):
    x = 150
    for kind, value, fg, bg in parts:
        w = CELL if kind == "sep" else CHIP
        d.rectangle([x, y, x + w, y + 36], fill=bg)
        d.text((x + (0 if kind == "sep" else 8), y), value, font=big, fill=fg)
        x += w


ROWS = [
    ("arrow  E0B0", [("c", "one", CRUST, A), ("sep", "", A, B), ("c", "two", TEXT, B), ("sep", "", B, C), ("c", "tri", CRUST, C), ("sep", "", C, BASE)]),
    ("slant  E0BC", [("c", "one", CRUST, A), ("sep", "", A, B), ("c", "two", TEXT, B), ("sep", "", B, C), ("c", "tri", CRUST, C), ("sep", "", C, BASE)]),
    ("round  E0B6 E0B4", [("sep", "", A, BASE), ("c", "one", CRUST, A), ("sep", "", A, BASE), ("sep", " ", TEXT, BASE), ("sep", "", B, BASE), ("c", "two", TEXT, B), ("sep", "", B, BASE)]),
    ("round, same E0B5", [("sep", "", A, BASE), ("c", "one", CRUST, A), ("sep", "", CRUST, A), ("c", "two", CRUST, A), ("sep", "", A, BASE)]),
    ("thin   E0B1", [("c", "one", CRUST, A), ("sep", "", CRUST, B), ("c", "two", TEXT, B), ("sep", "", TEXT, C), ("c", "tri", CRUST, C)]),
    ("same bg E0B1", [("c", "one", CRUST, A), ("sep", "", CRUST, A), ("c", "two", CRUST, A), ("sep", "", A, BASE)]),
]

img = Image.new("RGB", (760, 40 + 52 * len(ROWS)), BASE)
d = ImageDraw.Draw(img)
d.text((12, 8), "specs/045-separators-layout: separator styles, rendered from FiraCode Nerd Font Mono", font=small, fill=TEXT)
for i, (label, parts) in enumerate(ROWS):
    y = 40 + i * 52
    d.text((12, y + 10), label, font=small, fill=TEXT)
    run(d, y, parts)
img.save(sys.argv[1] if len(sys.argv) > 1 else "separator-evidence.png")
print("wrote", sys.argv[1] if len(sys.argv) > 1 else "separator-evidence.png")
