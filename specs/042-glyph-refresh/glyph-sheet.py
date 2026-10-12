"""Proof sheet for specs/042-glyph-refresh.

Every new nerd codepoint is drawn from FiraCode Nerd Font Mono, the font the
bar is used with here, beside the glyph it replaces and its plain substitute.
The plain substitute is drawn from the first font in the chain a terminal on
this machine would use for it. East Asian Width comes from unicodedata.

    python3 specs/042-glyph-refresh/glyph-sheet.py specs/042-glyph-refresh/glyph-evidence.png
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
    ("dir", 0xF4D4, 0xF413, "⌂"),
    ("home", 0xF02DC, None, "⌂"),
    ("repo", 0xF401, None, "⊡"),
    ("worktree", 0xE5FB, None, "⎇"),
    ("removed", 0xF458, None, "-"),
    ("prDraft", 0xF4DD, None, "⇄"),
    ("prMerged", 0xF419, None, "⇄"),
    ("prClosed", 0xF4DC, None, "⇄"),
    ("reviewApproved", 0xF4A4, None, "✓"),
    ("reviewComments", 0xF442, None, "✉"),
    ("reviewRequested", 0xF441, None, "⊛"),
    ("effortLow", 0xF0875, 0xF0E7, "↯"),
    ("effortMedium", 0xF029A, 0xF0E7, "↯"),
    ("effortHigh", 0xF0874, 0xF0E7, "↯"),
    ("fast", 0xF140B, 0xF04C5, "⇶"),
    ("timer (5h)", 0xF051F, 0xF051B, "◷"),
    ("duration", 0xF520, 0xF252, "◔"),
    ("rtk", 0xF1679, 0xE7A8, "▾"),
    ("push", 0xF431, 0xF40A, "⇑"),
    ("pull", 0xF433, 0xF409, "⇓"),
    ("conflict", 0xF40C, 0xF421, "✖"),
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
d.text((16, 16), "specs/042-glyph-refresh: every new codepoint, rendered from FiraCode Nerd Font Mono", font=label, fill=FG)
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
