# State and Lifecycle: Create or Update

The skill must never guess whether a story exists. It reads a local ledger, then confirms
against Medium.

## The Ledger

`<workdir>/state.json`, schema in [../templates/state.example.json](../templates/state.example.json).
One entry per article, keyed by `id` (a stable slug derived from the first published title).
Fields that carry weight:

| Field | Meaning |
|---|---|
| `id` | Stable key. Never changes, even when the title does. |
| `title` | Current title on Medium. |
| `mediumUrl` | Canonical story URL. Absent means never transferred. |
| `status` | `draft` on Medium, `published`, or `local` (never transferred). |
| `publishedAt` / `updatedAt` | ISO dates of the last remote write this skill performed. |
| `snapshotHash` | Hash of `<workdir>/published/<slug>.md` — what was last sent. |
| `sourceRef` | Commit the article was written from, for the next update's diff. |
| `publication` | Publication the story lives in, if any. |
| `repoLink` | Public repository URL printed at the end of the article, or `null`. Visibility is re-checked on every update. |
| `account` | The Medium handle that owns it, so a shared machine cannot cross accounts. |

The ledger is a cache of Medium's state rather than the truth. When the two disagree, Medium
wins.

## Decision Table

| Ledger | Medium check | Action |
|---|---|---|
| No entry | No matching story or draft found | **Create.** New draft. |
| No entry | A story or draft with the same title/subject exists | **Adopt, then update.** Write the entry from the remote story; never create a second one. |
| Entry with `mediumUrl` | URL resolves, owned by the expected account | **Update** in place. The URL and its stats are preserved. |
| Entry with `mediumUrl` | URL 404s or is not reachable | Report it. Ask before creating a replacement — the story may be unpublished or deleted rather than gone. |
| Entry, `status: local` | — | **Create**, then fill in `mediumUrl`. |
| Ambiguous match (several similar stories) | — | Stop and ask which one. Never pick for the operator. |

The "Medium check" means actually looking: the account's stories and drafts list at
`medium.com/me/stories/drafts` and `/public`, or the profile page. If no path to Medium is
available in this session, say the check could not be run and treat the result as unknown
rather than as "does not exist".

## Matching Heuristics

A remote story matches the local article when any of these hold:

- Same `id`/slug recorded in the ledger.
- Title match, exact or near-exact after normalization.
- Same canonical link.
- Subtitle and opening paragraph clearly describe the same project and thesis.

Title drift is normal, and a renamed story is still the same story. Weigh the canonical link
and the ledger `id` above the title.

## Writing an Update

1. **Read the live story first.** The operator may have edited it on Medium after the last
   transfer.
2. **Detect divergence.** Compare the live text against `<workdir>/published/<slug>.md`. If it
   diverges, stop and show what changed. Overwriting a human's edits is a destructive act —
   proceed only with explicit approval, or merge their changes into the new draft.
3. **Update in place.** Keep the same story: the URL, claps, responses, and its position in
   publications all live on that URL. Never replace a story by publishing a new one and
   deleting the old.
4. **Scope the edit.** Change the sections the project actually changed. A full rewrite is a
   decision the operator makes, not a default.
5. **Mark what is new** when the change is substantive — a short "Updated <month year>" note
   near the top, or a clearly labelled section. Silent rewrites of a published argument are
   dishonest to anyone who already read it.
6. **Re-run redaction and the voice pass on the whole article**, not only the new paragraphs.
   Re-check the closing repository link too: a repository can be made private after publication,
   and the article should not keep pointing at a 404.
7. **Refresh the snapshot and ledger** after the write succeeds — never before, and never if
   the write was refused or failed.

## Failure Handling

If a remote write fails halfway — the draft was created but settings did not apply, or the
editor lost the tail of a long paste — record what actually landed in the ledger with a
`partial` note, tell the operator precisely which parts are missing, and never report the
transfer as complete.
