"""Proof sheet for specs/048-state-feedback: the state glyphs.

Every new nerd codepoint is drawn from FiraCode Nerd Font Mono, the font the
bar is used with here, beside the glyph it replaces and its plain substitute.
The plain substitute is drawn from the first font in the chain a terminal on
this machine would use for it. East Asian Width comes from unicodedata.

    python3 specs/048-state-feedback/glyph-sheet.py specs/048-state-feedback/glyph-evidence.png
"""
import sys
import unicodedata
from PIL import Image, ImageDraw, ImageFont

NERD = "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"
PLAIN_CHAIN = [
    NERD,
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Apple Symbols.ttf",
    "/System/Library/Fonts/Supplemental/STIXTwoMath.otf",
]

# key, new nerd codepoint, old nerd codepoint or None, plain substitute
ROWS = [
    ("workingFrame0", 0xEE06, None, "|"),
    ("workingFrame1", 0xEE07, None, "/"),
    ("workingFrame2", 0xEE09, None, "-"),
    ("workingFrame3", 0xEE0A, None, "\\"),
    ("sleeping", 0xF04B2, 0xF0176, "\u25CC"),
    ("yourTurn", 0xF476, None, "!"),
    ("updateDone", 0xF12CC, 0xF0737, "\u2912"),
    ("unavailable", 0xF00E8, None, "!"),
    ("clean", 0xF4A4, None, "\u2713"),
]

BG, FG, DIM, OLD, NEW = "#1e1e2e", "#cdd6f4", "#a6adc8", "#f38ba8", "#a6e3a1"
SIZE = 30
label = ImageFont.truetype(NERD, 15)
big = ImageFont.truetype(NERD, SIZE)


def has_glyph(font, ch):
    """True when the font draws something other than its missing-glyph box."""
    def pixels(c):
        im = Image.new("L", (60, 60), 0)
        ImageDraw.Draw(im).text((8, 8), c, font=font, fill=255)
        return im.tobytes()
    return pixels(ch) != pixels("\U0010FFFF") and any(pixels(ch))


def plain_font(ch):
    for path in PLAIN_CHAIN:
        font = ImageFont.truetype(path, SIZE)
        if has_glyph(font, ch):
            return font, path.rsplit("/", 1)[-1]
    return big, "none"


def short(name):
    return "FiraCode NF" if name.startswith("FiraCodeNerd") else name


W, ROW_H, TOP = 980, 56, 60
img = Image.new("RGB", (W, TOP + ROW_H * len(ROWS) + 20), BG)
d = ImageDraw.Draw(img)
d.text((16, 16), "specs/048-state-feedback: the state glyphs, rendered from FiraCode Nerd Font Mono", font=label, fill=FG)
for x, head in [(16, "key"), (230, "old"), (310, "new"), (390, "codepoint"), (520, "plain"), (600, "plain font"), (800, "width")]:
    d.text((x, 38), head, font=label, fill=DIM)

for i, (key, new, old, plain) in enumerate(ROWS):
    y = TOP + i * ROW_H
    d.text((16, y + 12), key, font=label, fill=FG)
    if old is not None:
        d.text((230, y + 6), chr(old), font=big, fill=OLD)
    d.text((310, y + 6), chr(new), font=big, fill=NEW)
    d.text((390, y + 12), f"U+{new:04X}", font=label, fill=FG)
    pf, name = plain_font(plain)
    d.text((520, y + 6), plain, font=pf, fill=FG)
    d.text((600, y + 12), short(name), font=label, fill=DIM)
    d.text((800, y + 12), f"plain EAW {unicodedata.east_asian_width(plain)}", font=label, fill=DIM)

img.save(sys.argv[1] if len(sys.argv) > 1 else "glyph-evidence.png")
print("wrote", sys.argv[1] if len(sys.argv) > 1 else "glyph-evidence.png")
