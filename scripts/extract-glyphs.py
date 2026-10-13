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
    "E0B4": 0xE0B4,  # powerline round right cap, the end of a pill (specs/045)
    "E0B5": 0xE0B5,  # powerline round thin, between chips on one background
    "E0B6": 0xE0B6,  # powerline round left cap, the start of a pill
    "E0BC": 0xE0BC,  # powerline slant, the joint of the slant style
    "F418": 0xF418,  # nf-oct-git_branch
    "F407": 0xF407,  # nf-oct-git_pull_request
    # GitHub's own diff and sync vocabulary. Each was rendered and checked
    # by eye before being adopted: several plausibly-named codepoints draw
    # something else entirely (F433 "repo_push" is a DOWN arrow, F45D
    # "arrow_up" is a signpost), so the name in a Nerd Font cheat sheet is
    # not evidence of what the glyph looks like.
    "F459": 0xF459,  # nf-oct-diff_modified: boxed dot, GitHub's modified marker
    "F457": 0xF457,  # nf-oct-diff_added: boxed plus, GitHub's added marker
    "F417": 0xF417,  # nf-oct-git_commit: a detached HEAD, which is not a branch
    "F4A4": 0xF4A4,  # nf-oct-check_circle_fill: CI passed (guide 5.3)
    "F530": 0xF530,  # nf-oct-x_circle_fill: CI failed
    "F517": 0xF517,  # nf-oct-skip: CI skipped or cancelled
    "F52E": 0xF52E,  # nf-oct-workflow: a gate is running
    "F0394": 0xF0394,  # nf-md-new_box: an update is waiting
    "F0756": 0xF0756,  # nf-md-format_list_checks: todos
    "F09D1": 0xF09D1,  # nf-md-brain: context
    "F167A": 0xF167A,  # nf-md-robot_outline: model
    # specs/042-glyph-refresh: the icons whose picture said another thing.
    # Each was rendered from the installed FiraCode Nerd Font Mono and kept on
    # specs/042-glyph-refresh/glyph-evidence.png before it was adopted.
    "F4D4": 0xF4D4,    # directory
    "F02DC": 0xF02DC,  # the directory when it is $HOME
    "F401": 0xF401,    # the repository
    "E5FB": 0xE5FB,    # a linked worktree
    "F458": 0xF458,    # removed files
    "F4DD": 0xF4DD,    # pull request: draft
    "F419": 0xF419,    # pull request: merged
    "F4DC": 0xF4DC,    # pull request: closed
    "F4A4": 0xF4A4,    # review: approved
    "F442": 0xF442,    # review: comments
    "F441": 0xF441,    # review: requested
    "EE06": 0xEE06,    # spinner frame (specs/048)
    "EE07": 0xEE07,    # spinner frame
    "EE09": 0xEE09,    # spinner frame
    "EE0A": 0xEE0A,    # spinner frame
    "F04B2": 0xF04B2,  # a session asleep
    "F476": 0xF476,    # your turn
    "F12CC": 0xF12CC,  # updated this session
    "F00E8": 0xF00E8,  # the bar could not run
    "F04E6": 0xF04E6,  # a reset: the window comes back (specs/047)
    "F078C": 0xF078C,  # a warm cache with most of its life left
    "F06AD": 0xF06AD,  # a warm cache in its last third
    "F0A33": 0xF0A33,  # a calendar with a week bar: the 7-day window
    "EE00": 0xEE00,    # gauge track: empty, start
    "EE01": 0xEE01,    # gauge track: empty, middle
    "EE02": 0xEE02,    # gauge track: empty, end
    "EE03": 0xEE03,    # gauge track: full, start
    "EE04": 0xEE04,    # gauge track: full, middle
    "EE05": 0xEE05,    # gauge track: full, end
    "F0875": 0xF0875,  # effort: low
    "F029A": 0xF029A,  # effort: medium
    "F0874": 0xF0874,  # effort: high
    "F140B": 0xF140B,  # fast mode
    "F051F": 0xF051F,  # the 5-hour window
    "F520": 0xF520,    # session duration
    "F1679": 0xF1679,  # rtk
    "F431": 0xF431,    # commits to push
    "F433": 0xF433,    # commits to pull
    "F40C": 0xF40C,    # merge conflicts
    # Material Design and Devicon, for the segments GitHub has no vocabulary
    # for. These replaced emoji on 2026-09-01: an emoji costs two columns
    # where a private-use glyph costs one, on a bar already short of width.
    "F004D": 0xF004D,  # nf-md-arrow_left: what a directory or worktree came from
    "F08EA": 0xF08EA,  # nf-md-hammer: working
    "F0176": 0xF0176,  # nf-md-coffee: idle
    "F0431": 0xF0431,  # nf-md-puzzle: the active skills
    "F06A9": 0xF06A9,  # nf-md-robot: the model
    # Names that lied: F09DA is listed as "brain" and draws a boxed chevron,
    # and F44E is listed as "stopwatch" and draws three flat bars.
    "F0238": 0xF0238,  # nf-md-fire: how fast the window is being spent
    "F0584": 0xF0584,  # nf-md-wallet: the spend limit. F0114 "cash" draws a
                       # banknote, and F00F6, listed as a cart, a calendar
    "F0717": 0xF0717,  # nf-md-snowflake: a cold one. F09A2, listed as a
                       # database refresh, draws a speaker
    "E62B": 0xE62B,    # nf-custom-vim: the vim mode
    "F4B8": 0xF4B8,    # nf-oct-copilot: Copilot's premium requests
    "F0996": 0xF0996,  # nf-md-progress_clock: a CI run or a gate still
                       # going. F0997, which held the CI half until
                       # 2026-10-06, draws md-progress_download
    "F097F": 0xF097F,  # nf-md-lock_clock: a git gate waiting for gates.lock
    "F099E": 0xF099E,  # nf-md-shield_off: Copilot's allow-all
    "F01DA": 0xF01DA,  # nf-md-download: an update blocked
    "F0737": 0xF0737,  # nf-md-arrow_up_bold: the statusline updated. F0CE0,
                       # listed as an up arrow in a circle, points right
    # Animation frames (feature 003). Each was rendered and looked at: the
    # md dice_1..dice_6 range draws a boxed division sign, a list, a building
    # and a download arrow, "space_invaders" draws a crossed-out television,
    # F0BA9 "puzzle_outline" draws a comb, and robot_excited and its siblings
    # draw bookmarks. None of those are here for that reason.
    "F0765": 0xF0765,  # nf-md-circle: the full disc a Pac-Man frame closes to
    "F0A9E": 0xF0A9E,  # nf-md-circle_slice_1: a quarter disc
    "F0AA0": 0xF0AA0,  # nf-md-circle_slice_3: a half disc
    "F0AA2": 0xF0AA2,  # nf-md-circle_slice_5: a three-quarter disc
    "F0AA5": 0xF0AA5,  # nf-md-circle_slice_8: a full disc
    "F0BAF": 0xF0BAF,  # nf-md-pac_man: a disc with a wedge cut out
    "F1427": 0xF1427,  # nf-md-puzzle_outline: an outlined puzzle piece
    "F1426": 0xF1426,  # nf-md-puzzle_check: a puzzle piece with a tick
    "F167A": 0xF167A,  # a second robot head, for the model's blink
    "F04D2": 0xF04D2,  # nf-md-star_outline
    "F04CE": 0xF04CE,  # nf-md-star
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
