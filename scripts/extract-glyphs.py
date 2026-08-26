#!/usr/bin/env python3
"""Extract the handful of Nerd Font glyph outlines the previews need as SVG
path data, so generated SVGs render everywhere without shipping a font
binary (no OFL redistribution obligations) and without depending on the
viewer having a Nerd Font installed.

Run via the dev venv:
    /tmp/statusline-venv/bin/python scripts/extract-glyphs.py > src/preview/glyphs.json

Emoji are deliberately NOT extracted: they're normal Unicode and every
platform's system emoji font covers them, in color.
"""

import json
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"

# Only the Nerd Font private-use glyphs the statusline actually emits.
WANTED = {
    "E0B0": 0xE0B0,  # powerline right-pointing separator
    "F418": 0xF418,  # nf-oct-git_branch
    "F43A": 0xF43A,  # nf-oct-clock
    "F407": 0xF407,  # nf-oct-git_pull_request
    "F455": 0xF455,  # nf-oct-calendar (blank grid, no baked-in date)
    # GitHub's own diff and sync vocabulary. Each was rendered and checked
    # by eye before being adopted: several plausibly-named codepoints draw
    # something else entirely (F433 "repo_push" is a DOWN arrow, F45D
    # "arrow_up" is a signpost), so the name in a Nerd Font cheat sheet is
    # not evidence of what the glyph looks like.
    "F459": 0xF459,  # nf-oct-diff_modified: boxed dot, GitHub's modified marker
    "F457": 0xF457,  # nf-oct-diff_added: boxed plus, GitHub's added marker
    "F40A": 0xF40A,  # nf-oct-cloud_upload: commits waiting to be pushed
    "F409": 0xF409,  # nf-oct-cloud_download: commits waiting to be pulled
    "F417": 0xF417,  # nf-oct-git_commit: a detached HEAD, which is not a branch
}


def main():
    font = TTFont(FONT)
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    upem = font["head"].unitsPerEm

    out = {"unitsPerEm": upem, "glyphs": {}}

    for name, cp in WANTED.items():
        glyph_name = cmap.get(cp)
        if glyph_name is None:
            print(f"missing codepoint U+{name}", file=sys.stderr)
            sys.exit(1)
        pen = SVGPathPen(glyph_set)
        glyph_set[glyph_name].draw(pen)
        out["glyphs"][name] = {
            "path": pen.getCommands(),
            "advance": font["hmtx"][glyph_name][0],
        }

    json.dump(out, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
