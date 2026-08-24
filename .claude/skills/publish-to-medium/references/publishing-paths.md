# Publishing Paths

How the finished text actually gets to Medium. Choose the path first — it changes how the draft
is prepared — and state which one is in use in the final report.

## The API Is Effectively Closed

Medium's Publishing API (`api.medium.com`, integration tokens from the account settings) stopped
accepting new integrations on 1 January 2025. Medium no longer issues integration tokens and no
longer approves new integrations; tokens issued before that date were not revoked and continue
to work.

So there are two cases:

- **The operator already holds a pre-2025 integration token.** The API can create a post under
  their account, with title, tags, publish status and canonical link. Read the token from an
  environment variable, never from a file in the repository, never echo it, and never write it
  into the ledger or a draft.
- **Everyone else.** There is no supported programmatic path. Do not tell the operator to
  "generate a token in settings" — that option is gone. Use one of the paths below.

## Path A — Assisted Browser Transfer

Drive the editor in the operator's own logged-in browser. This is the default when browser
automation is available and the operator authorizes it.

Sequence: open `medium.com/new-story` for a new story, or the existing story's edit URL for an
update. Type or paste the title line, then the subtitle line, then the body. Apply block
structure that paste did not carry — code blocks especially. Open story settings for the SEO
fields and the canonical link. Stop at the publish dialog: fill the tags, then hand control back
for the operator to press publish, unless publishing was explicitly authorized.

Rules: never accept a login prompt on the operator's behalf, never touch another story, and
never trigger a browser dialog inside the editor. Verify after the transfer with the checklist
in [medium-authoring.md](medium-authoring.md).

## Path B — Manual Transfer with a Prepared Draft

The fallback, and the right choice when the operator wants to keep hands on the keyboard.
Deliver the draft plus a short transfer sheet: the title line, the subtitle line, the body, the
five tags in order, the SEO title and description, the canonical link decision, and a list of
the blocks that must be re-applied by hand after pasting. The operator pastes it once and fixes
the structure from the sheet. Nothing is sent anywhere.

## Path C — Import from a URL

Medium's import tool builds a story from a public URL and sets the canonical link back to it
automatically. **This path is off by default**, because it requires the article to be publicly
hosted first, which the privacy rule forbids —
[privacy-and-redaction.md](privacy-and-redaction.md). It is available only when the operator
already publishes the article on their own site and asks for it. Note that the importer does not
carry images across and that formatting usually needs cleanup afterwards.

## Choosing

| Situation | Path |
|---|---|
| Pre-2025 API token in the environment | API, then verify in the editor |
| Browser automation available and authorized | A |
| No browser access, or operator prefers to do it | B |
| Article already lives on the operator's own public site | C, with the canonical link |

When the chosen path is unavailable mid-flight, fall back to Path B and say so. Do not
substitute a path that sends content somewhere the operator did not approve.
