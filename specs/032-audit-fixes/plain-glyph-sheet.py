"""Proof sheet for the plain-glyph replacements (specs/032-audit-fixes).

Each candidate is drawn from the first font in the chain a terminal on this
machine would use for it: FiraCode Nerd Font Mono, then Menlo, then Apple
Symbols, then STIX Two Math. Its East Asian Width comes from unicodedata.
"""
import sys
import unicodedata
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

CHAIN = [
    ("FiraCode Nerd Font Mono", "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf", 0),
    ("Menlo", "/System/Library/Fonts/Menlo.ttc", 0),
    ("Apple Symbols", "/System/Library/Fonts/Apple Symbols.ttf", 0),
    ("STIX Two Math", "/System/Library/Fonts/Supplemental/STIXTwoMath.otf", 0),
]
CMAPS = [(n, p, i, TTFont(p, fontNumber=i).getBestCmap()) for n, p, i in CHAIN]
LABEL = ImageFont.truetype(CHAIN[0][1], 15)

# (key, the Ambiguous glyph it replaces, candidates, the one adopted)
ROWS = [
    ("calendar", 0x25A4, [0x2338, 0x25F0], 0x25F0),
    ("working", 0x25CE, [0x29BF, 0x229B], 0x29BF),
    ("skills", 0x25C8, [0x2756, 0x2742], 0x2756),
    ("model", 0x25C7, [0x2B26, 0x25CA, 0x2662], 0x25CA),
    ("context", 0x25A6, [0x229E, 0x25EB], 0x229E),
]

BG, FG, DIM, OLD, NEW = "#1e1e2e", "#cdd6f4", "#a6adc8", "#f38ba8", "#a6e3a1"
CELL_W, CELL_H, LEFT = 270, 150, 110


def font_for(cp):
    for name, path, idx, cmap in CMAPS:
        if cp in cmap:
            return name, path, idx
    return None, None, None


def cell(draw, x, y, cp, colour):
    name, path, idx = font_for(cp)
    if path is None:
        draw.text((x, y), "no font", fill=OLD, font=LABEL)
        return
    big = ImageFont.truetype(path, 56, index=idx)
    small = ImageFont.truetype(path, 16, index=idx)
    ch = chr(cp)
    draw.text((x, y), ch, fill=colour, font=big)
    draw.text((x + 80, y + 24), ch, fill=FG, font=small)
    eaw = unicodedata.east_asian_width(ch)
    draw.text((x, y + 72), f"U+{cp:04X}  EAW {eaw}", fill=OLD if eaw == "A" else FG, font=LABEL)
    draw.text((x, y + 92), unicodedata.name(ch).lower()[:30], fill=DIM, font=LABEL)
    draw.text((x, y + 112), name, fill=DIM, font=LABEL)


def main(out):
    cols = 1 + max(len(r[2]) for r in ROWS)
    img = Image.new("RGB", (LEFT + cols * CELL_W, 40 + len(ROWS) * CELL_H), BG)
    d = ImageDraw.Draw(img)
    d.text((LEFT, 10), "was (Ambiguous)", fill=OLD, font=LABEL)
    d.text((LEFT + CELL_W, 10), "Narrow candidates", fill=NEW, font=LABEL)
    for r, (key, old, cands, chosen) in enumerate(ROWS):
        y = 40 + r * CELL_H
        d.text((12, y + 24), key, fill=FG, font=LABEL)
        cell(d, LEFT, y, old, OLD)
        for c, cp in enumerate(cands):
            x = LEFT + (c + 1) * CELL_W
            cell(d, x, y, cp, NEW)
            if cp == chosen:
                d.text((x + 130, y + 24), "adopted", fill=NEW, font=LABEL)
    img.save(out)


if __name__ == "__main__":
    main(sys.argv[1])
