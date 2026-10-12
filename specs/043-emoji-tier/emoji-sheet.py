"""Proof sheet for specs/043-emoji-tier: every entry of the emoji column.

Each emoji is drawn from the system colour emoji font at the one size its
bitmaps carry (160 px on macOS) and scaled down, beside the glyph key it fills
and its codepoint. The point is the one Principle X makes: an emoji is
inspected before it is adopted, and the picture is kept with the change.

    python3 specs/043-emoji-tier/emoji-sheet.py specs/043-emoji-tier/glyph-evidence.png
"""
import json
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

EMOJI_FONT = "/System/Library/Fonts/Apple Color Emoji.ttc"
LABEL_FONT = "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"

# The column, read from the table itself so the sheet cannot drift from it.
SCRIPT = (
    "import('./src/render.js').then(m=>console.log(JSON.stringify(m.GLYPHS.emoji)))"
)
table = json.loads(subprocess.check_output(["node", "-e", SCRIPT], text=True))

big = ImageFont.truetype(EMOJI_FONT, 160)
label = ImageFont.truetype(LABEL_FONT, 13)
head = ImageFont.truetype(LABEL_FONT, 15)

CELL_W, CELL_H, SIZE, COLS = 150, 96, 56, 6
BG, FG, DIM = "#1e1e2e", "#cdd6f4", "#a6adc8"


def picture(ch):
    tile = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(tile).text((0, 0), ch, font=big, embedded_color=True)
    box = tile.getbbox()
    if not box:
        return None
    return tile.crop(box).resize((SIZE, SIZE), Image.LANCZOS)


rows = (len(table) + COLS - 1) // COLS
img = Image.new("RGB", (COLS * CELL_W + 20, rows * CELL_H + 50), BG)
d = ImageDraw.Draw(img)
d.text((12, 12), "specs/043-emoji-tier: the emoji column, rendered from Apple Color Emoji", font=head, fill=FG)
missing = []
for n, (key, ch) in enumerate(table.items()):
    x = 10 + (n % COLS) * CELL_W
    y = 44 + (n // COLS) * CELL_H
    pic = picture(ch)
    if pic is None:
        missing.append(key)
    else:
        img.paste(pic, (x + 8, y), pic)
    d.text((x + 72, y + 6), key, font=label, fill=FG)
    d.text((x + 72, y + 26), "U+" + "+".join(f"{ord(c):04X}" for c in ch), font=label, fill=DIM)

img.save(sys.argv[1] if len(sys.argv) > 1 else "glyph-evidence.png")
print("wrote", sys.argv[1] if len(sys.argv) > 1 else "glyph-evidence.png", "missing:", missing)
