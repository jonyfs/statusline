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
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = os.environ.get(
    "STATUSLINE_NERD_FONT",
    "/Users/jony/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf",
)

# Only the Nerd Font private-use glyphs the statusline actually emits.
WANTED = {
    "E0B0": 0xE0B0,  # powerline right-pointing separator
    "E0B2": 0xE0B2,  # powerline left-pointing separator, for a right-aligned group
    "E0B1": 0xE0B1,  # powerline thin right-pointing, the no-Nerd-Font fallback
    "E0B3": 0xE0B3,  # powerline thin left-pointing, its mirror
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
    "F413": 0xF413,  # nf-oct-file_directory: the working directory
    "F421": 0xF421,  # nf-oct-alert: unmerged paths
    "F42E": 0xF42E,  # nf-oct-check: the CI run passed
    "F467": 0xF467,  # nf-oct-x: the CI run failed
    "F4A0": 0xF4A0,  # nf-oct-tasklist: the todo list. F0BE is listed as
                     # "checklist" and draws the App Store logo
    # Material Design and Devicon, for the segments GitHub has no vocabulary
    # for. These replaced emoji on 2026-09-01: an emoji costs two columns
    # where a private-use glyph costs one, on a bar already short of width.
    "F004D": 0xF004D,  # nf-md-arrow_left: what a directory or worktree came from
    "F0997": 0xF0997,  # nf-md-progress_clock: the CI run is still going
    "F0765": 0xF0765,  # nf-md-circle: working
    "F0766": 0xF0766,  # nf-md-circle_outline: idle
    "F0431": 0xF0431,  # nf-md-puzzle: the active skills
    "F06A9": 0xF06A9,  # nf-md-robot: the model
    "F0E7": 0xF0E7,    # nf-fa-bolt: the effort level
    "F035B": 0xF035B,  # nf-md-memory: the context window. F09DA is listed as
                       # "brain" and draws a boxed chevron
    "F051B": 0xF051B,  # nf-md-timer: the 5-hour window. F44E is listed as
                       # "stopwatch" and draws three flat bars
    "F252": 0xF252,    # nf-fa-hourglass_half: session duration
    "F0238": 0xF0238,  # nf-md-fire: how fast the window is being spent
    "E7A8": 0xE7A8,    # nf-dev-rust: rtk is a Rust binary
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
