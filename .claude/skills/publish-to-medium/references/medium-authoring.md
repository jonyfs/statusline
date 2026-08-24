# Authoring for the Medium Editor

The draft is written in Markdown locally, but Medium's editor is not a Markdown editor. Write
only in the subset that survives the transfer, and expect to apply structure by hand.

## What Medium Can Represent

| Element | In the editor |
|---|---|
| Title | Large title (the "big T"), first line of the story |
| Section heading | Small title (the "small T"); directly under the title it becomes the subtitle, directly above it becomes a kicker |
| Body text | Default paragraph |
| Bold / italic / link | ⌘B / ⌘I / ⌘K on macOS, Ctrl on Windows |
| Inline code | Backticks around the text, or select and press backtick |
| Code block | New line → `+` menu → code block |
| Blockquote and pull quote | Quote button, pressed once or twice |
| Bulleted and numbered list | `*` or `1.` at the start of a line |
| Image | `+` menu or drag onto the canvas; caption is a separate field |
| Embed | Paste a bare URL on its own line — the supported services expand into a card |
| Separator | The `+` menu's divider |

Medium's heading vocabulary is effectively two levels. A document with four nested heading
levels has to be flattened before transfer; decide the flattening yourself rather than letting
the editor decide it.

## What Medium Cannot Represent

Plan around these; do not discover them mid-transfer.

- **Tables.** No table support. Convert to a list, a short paragraph, or an image of the table
  with the content also stated in prose for readers who cannot see the image.
- **Footnotes, anchors, internal links, a table of contents.** Rewrite as inline asides.
- **Syntax highlighting.** Code blocks are monospaced and unhighlighted. Keep them short and
  explain them in the surrounding prose rather than relying on colour to carry meaning.
- **Nested lists.** They survive badly, and ordered numbering can restart unpredictably.
  Flatten to one level.
- **Arbitrary HTML.** Pasted HTML is interpreted loosely; complex structure comes out mangled.
- **Front matter.** Title, subtitle and tags are set in the editor and the publish dialog, never
  parsed from the document.

## Writing the Draft So It Transfers Cleanly

- One idea per paragraph, two to four sentences. Medium's typography punishes dense blocks.
- Keep code blocks under roughly 25 lines. Longer samples lose the reader and are harder to
  paste correctly.
- Put every image where it belongs in the flow, with a placeholder line naming the file and the
  caption, so the operator can drop it in without re-reading the article.
- Avoid characters that the editor rewrites: it converts straight quotes to curly quotes and
  some dash sequences. Inside code blocks this matters — check any sample that contains quotes
  after pasting.
- End sections with a sentence that earns the next one. Medium readers leave at headings.

## After the Transfer

Whatever path was used, walk the story in the editor once and confirm:

- Title and subtitle are the actual title and subtitle lines, not two body paragraphs.
- Code blocks are code blocks, not indented text, and no line was truncated.
- Lists survived, and no ordered list restarted its numbering.
- Links resolve, and none of them points anywhere the redaction pass forbade.
- Images are in place with captions.
- The read-time estimate matches the intended length — a wildly short estimate means content
  was lost in transfer.
