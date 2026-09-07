# Quickstart: Explaining a segment

## What to check by hand

The part no test can assert is what a terminal does on hover. iTerm2, WezTerm
and Kitty preview a link target; Terminal.app does not.

```bash
echo '{"session_id":"x","cwd":"'"$PWD"'","workspace":{"current_dir":"'"$PWD"'"},
      "model":{"display_name":"Opus 5"},"effort":{"level":"high"},
      "context_window":{"used_percentage":62}}' \
  | COLUMNS=140 node bin/cli.js render
```

Hover the context figure. The terminal should reveal the README anchor for
`#reading-a-level-at-a-glance`, and a click should open that section.

Then hover the branch. It should still show the branch on GitHub, not
documentation — that is invariant 3.

## What the suite asserts

```bash
npm test
```

- every segment is either help-linked or already linked
- every anchor in the map matches a heading in README.md
- `dir`, `branch` and `pr` keep their own targets
- line widths are identical with the links on and off
- `CLAUDE_STATUSLINE_NO_HELP_LINKS=1` leaves only the three real links

## What must not change

```bash
npm run previews && npm run composer && git status --short
```

Both regenerate to no diff. A link is not a pixel, and the SVG converter parses
OSC 8 into a field rather than into text — measured in research.md, not assumed.
