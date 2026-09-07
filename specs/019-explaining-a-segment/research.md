# Research: Explaining a segment

Three assumptions the plan rests on, checked rather than believed.

## 1. A link costs no display columns

**Decision**: attach OSC 8 to every segment; the bar keeps its width.

**Measured**:

```
sem link: 6 | com link: 6 | iguais: true
```

`displayWidth` strips both SGR and OSC 8 before counting, so a segment with a
link and one without occupy the same room. Nothing on the bar moves, and the
priority table decides exactly what it decided before.

## 2. The SVG converter drops the sequence

**Decision**: previews need no change and must regenerate to no diff.

**Measured**: rendered a linked run through `createAnsiToSvg` and asked whether
either the escape or the URL reached the output.

```
escape cru vazou para o SVG: false
a URL vazou como texto: false
```

`src/preview/ansiToSvg.js` parses OSC 8 into a `url` field on each styled run
rather than passing it through as text. Principle VIII is safe: the generated
images stay byte-identical, because a link is not a pixel.

## 3. Every anchor exists

**Decision**: point the seven groups at seven existing README headings rather
than inventing headings for twenty-two segments.

**Measured**: slugified every `##` heading in README.md the way GitHub does
(lowercase, punctuation dropped, spaces to hyphens) and checked the seven the
map needs:

```
OK  #git-and-github-status        OK  #model-and-effort
OK  #what-it-knows-about-the-work OK  #what-line-3-can-tell-you
OK  #reading-a-level-at-a-glance  OK  #where-the-numbers-come-from
OK  #where-a-number-is-heading
```

All seven exist today. They will not necessarily exist tomorrow, which is why
the map is tested against the file rather than trusted: a renamed heading must
fail the suite instead of shipping a dead link.

## Alternatives considered

**A heading per segment.** Twenty-two anchors, each landing on the exact
sentence. Rejected: it would mean writing twenty-two headings into a README
that is already 880 lines, for a gain a reader gets anyway from landing in the
right section.

**Linking to the source instead of the README.** Rejected: a reader asking what
a segment means is not asking to read a render function.

**A `file://` link to the installed README.** Rejected: it opens raw markdown
in most browsers, and the installed copy can be older than the repository. The
public repository is how this project is distributed (Principle IV), so it is
the honest target.
