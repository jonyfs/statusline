"""Draws the bar's own ANSI output to PNG, or to an animated GIF.

    python3 scripts/rasterise-ansi.py out.png frame.ansi
    python3 scripts/rasterise-ansi.py out.gif frame1.ansi frame2.ansi ... --delay 700

Called by scripts/generate-images.js. The text is what `renderPayload`
printed; this only paints it, with the installed FiraCode Nerd Font Mono
(override with STATUSLINE_NERD_FONT). It reads SGR truecolor, bold, underline
and reset, and OSC 8 links are dropped. Not byte-reproducible: the output
depends on the font on the machine, which is why `docs/images/` is not
checked for staleness the way `docs/previews/` is.
"""
import os
import re
import sys
import unicodedata
from PIL import Image, ImageDraw, ImageFont

FONT = os.environ.get("STATUSLINE_NERD_FONT", "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf")
BOLD = os.environ.get("STATUSLINE_NERD_FONT_BOLD", FONT.replace("Regular", "Bold"))
SIZE = 22
BASE = (30, 30, 46)
DEFAULT_FG = (205, 214, 244)

regular = ImageFont.truetype(FONT, SIZE)
bold = ImageFont.truetype(BOLD, SIZE) if os.path.exists(BOLD) else regular
CELL_W = int(regular.getlength("M"))
CELL_H = SIZE + 10

TOKEN = re.compile(r"\x1b\[([0-9;:]*)m|\x1b\]8;;[^\x07]*\x07|([^\x1b]+)")


def width(ch):
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1


def parse(text):
    """Lines of (char, fg, bg, bold, underline) cells."""
    fg, bg, b, u = DEFAULT_FG, None, False, False
    lines = [[]]
    for m in TOKEN.finditer(text):
        if m.group(2) is not None:
            for ch in m.group(2):
                if ch == "\n":
                    lines.append([])
                else:
                    lines[-1].append((ch, fg, bg, b, u))
        elif m.group(1) is not None:
            codes = m.group(1).split(";")
            i = 0
            while i < len(codes):
                c = codes[i]
                if c in ("", "0"):
                    fg, bg, b, u = DEFAULT_FG, None, False, False
                elif c == "1":
                    b = True
                elif c == "22":
                    b = False
                elif c == "4" or c.startswith("4:"):
                    u = c != "4:0"
                elif c == "24":
                    u = False
                elif c == "39":
                    fg = DEFAULT_FG
                elif c == "49":
                    bg = None
                elif c in ("38", "48") and i + 1 < len(codes) and codes[i + 1] == "2" and i + 4 < len(codes):
                    rgb = tuple(int(x) for x in codes[i + 2 : i + 5])
                    if c == "38":
                        fg = rgb
                    else:
                        bg = rgb
                    i += 4
                i += 1
    return lines


def draw(lines):
    cols = max((sum(width(c[0]) for c in l) for l in lines), default=1)
    img = Image.new("RGB", ((cols + 2) * CELL_W, len(lines) * CELL_H + 20), BASE)
    d = ImageDraw.Draw(img)
    for row, cells in enumerate(lines):
        x = CELL_W
        y = 10 + row * CELL_H
        for ch, fg, bg, b, u in cells:
            w = width(ch)
            if bg:
                d.rectangle([x, y, x + w * CELL_W, y + CELL_H], fill=bg)
            if ch.strip():
                d.text((x, y + 3), ch, font=bold if b else regular, fill=fg)
            if u:
                d.line([x, y + CELL_H - 3, x + w * CELL_W, y + CELL_H - 3], fill=fg, width=1)
            x += w * CELL_W
    return img


def main(argv):
    delay = 700
    if "--delay" in argv:
        i = argv.index("--delay")
        delay = int(argv[i + 1])
        argv = argv[:i] + argv[i + 2 :]
    out, *inputs = argv
    frames = [draw(parse(open(p, encoding="utf8").read())) for p in inputs]
    if out.endswith(".gif"):
        size = (max(f.width for f in frames), max(f.height for f in frames))
        padded = []
        for f in frames:
            canvas = Image.new("RGB", size, BASE)
            canvas.paste(f, (0, 0))
            padded.append(canvas.convert("P", palette=Image.ADAPTIVE, colors=256))
        padded[0].save(out, save_all=True, append_images=padded[1:], duration=delay, loop=0, optimize=True)
    else:
        frames[0].save(out)
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1:])
