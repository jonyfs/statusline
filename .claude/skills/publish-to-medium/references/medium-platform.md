# The Medium Platform

What the skill needs to know about medium.com to place a story correctly. Medium changes its
product and its monetization rules often — where a rule below carries a date, treat it as a
starting point and verify before relying on it.

## Objects

- **Story** — the unit of publishing. Draft and published are states of the same object, so
  publishing does not create a new URL and editing a published story keeps its URL, its
  responses, and its stats.
- **Draft** — a story not yet published. Drafts are private but shareable by link.
- **Publication** — a shared surface with its own editors. A story can be submitted to one for
  review; publications may accept drafts, already-published stories, or both. Editors decide.
  A story added to a publication keeps its URL.
- **Profile** — the author account. `medium.com/@handle`.
- **Response** — a comment, which is itself a story attached to another one.

## Story Metadata

| Field | Where | Notes |
|---|---|---|
| Title | First large-title line in the editor | Also the default SEO title and social title. |
| Subtitle | Small-title line directly under the title | Feeds the preview and the default SEO description. |
| Kicker | Small-title line directly *above* the title | Optional label above the headline. |
| Tags | Publish dialog | **Maximum 5.** They drive topic distribution; order matters, the first is the most weighted. |
| Preview image and text | More settings → story preview | What the card shows on Medium. |
| SEO title / description | More settings | Overrides title/subtitle for search engines. Search results truncate the title around 60 characters. |
| Canonical link | More settings → advanced | Marks the story as originally published elsewhere. |
| Custom slug | Story URL | Derived from the title plus a hash suffix. Changing the title after publishing does not clean the old slug. |

Tags are the main lever the author controls over reach. Pick five that a reader would actually
browse, mixing one broad topic with more specific ones. Invented tags reach nobody.

## Canonical Links

Set a canonical link when the same article already exists on a site the operator owns, so
search engines credit the original. Do **not** invent one, and do not point it at a repository
or any URL the reader cannot open — see [privacy-and-redaction.md](privacy-and-redaction.md).
If the article is written for Medium first, there is no canonical link to set.

## Paywall, Friend Links, Distribution

- Stories can be published free or **member-only** (behind Medium's paywall), which is what
  makes them eligible to earn through the Partner Program.
- A **friend link** lets anyone read a member-only story without a membership. It is the link
  to share outside Medium.
- Distribution tiers, in ascending reach: **Network Only** (followers), **General**
  (algorithmic), **Boost** (human curators select stories for the homepage, emails and apps).
  Boost nomination has an eligibility window measured from the original publication date —
  roughly six months — so re-publishing an old story does not reset it.
- Paywall status does not affect Boost selection.

Whether to paywall is the operator's call, and it interacts with the AI policy below. Ask;
never default to member-only.

## AI Content Policy — Read Before Publishing

Medium distinguishes AI *assistance* from AI *generation*:

- Outlining, fact-checking, grammar and editing help are assistance and need no disclosure.
- Text where an AI produced the bulk of the writing with light editing counts as AI-generated
  and must be disclosed, conventionally with a sentence in the first two paragraphs. AI images
  are disclosed in the caption.
- Since 1 May 2024, AI-generated writing is not allowed behind the Partner Program paywall,
  disclosed or not. Undisclosed AI-generated writing gets Network Only distribution; disclosed
  AI-generated writing is capped at General distribution.

The skill's position: it drafts from the project's real material, and the operator is expected
to review, rewrite where it does not sound like them, and take authorship. Where the result is
substantially the skill's prose rather than the operator's, say so plainly and let the operator
choose disclosure and paywall accordingly. **Never help conceal AI generation from the
platform** — that risks the operator's account, which is a far worse outcome than a disclosure
line. Writing that does not read as machine-produced is a quality goal, not a way around a
policy. See [writing-standard.md](writing-standard.md).

## Length and Shape

Medium shows a read-time estimate; most well-performing technical stories land in the four to
eight minute range, which is roughly 900 to 2,000 words. Long stories are fine when the
argument needs them, but padding is visible: the read time rises and the completion rate falls.
Choose the length the thesis needs and cut the rest.
