---
name: publish-to-medium
description: >
  Use when a Medium article should be written, created, or updated from the project the
  session is running in — the user says "publish this to Medium", "write a Medium post about
  this project", "update my Medium story", "post this on medium.com", "escreve um artigo no
  Medium sobre esse projeto", "atualiza meu post no Medium", or asks for a Medium draft,
  title, subtitle, tags, or SEO settings for work that lives in this repository. Detects
  whether the story already exists (update) or must be created from scratch, keeps every
  project reference and draft artifact local — never pushed to GitHub or any other online
  repository — and writes in a professional human voice rather than obvious AI prose.
---

# Publish to Medium

Turns the project in the current working directory into a Medium story, then creates it or
updates the existing one. Two things separate this from "write me a blog post":

1. **It knows the state.** Before writing a word it determines whether this project already
   has a story on Medium, and never creates a duplicate of one that exists.
2. **It leaks nothing.** Draft artifacts stay on the local machine, and the published text
   carries no reference that would force the project to be made public. A repository the
   operator already publishes is the one thing that may be linked, once, at the end. Both rules
   are defined in [references/privacy-and-redaction.md](references/privacy-and-redaction.md).

## When to Use

- "Publish / write / draft a Medium article about this project"
- "Update my Medium story with what changed"
- "Give me the title, subtitle, tags and SEO description for Medium"
- Any request to move work from this repository onto medium.com

**Not for**: writing the project's own docs or README (use `document-generate`); publishing
anywhere other than Medium; anything that involves pushing project material to a public
repository — that is prohibited here, see the privacy reference.

## Authority Boundary

Local work — reading the repo, writing drafts into the workspace, rewriting, redacting — needs
no permission. **Every write to medium.com is outward-facing and requires explicit operator
authorization for that specific action**: creating a draft, saving edits to an existing story,
publishing, unpublishing, or deleting. Absent or ambiguous authorization means not granted:
finish the draft locally, report exactly what remains, and stop. Never publish a story the
operator has not read.

## Workflow

1. **Frame the request.** Establish intent (new story vs. update), audience, language of the
   article, target account or publication, and whether the operator wants the story only
   drafted or actually pushed to Medium. Ask only what you cannot infer.
2. **Open the local workspace and arm the privacy guard.** Create the workspace directory,
   confirm it is ignored by git, and halt if any of it is already tracked. Procedure and
   defaults: [references/privacy-and-redaction.md](references/privacy-and-redaction.md).
3. **Resolve identity: create or update.** Read the local ledger, then verify against Medium
   itself before concluding a story does not exist. Adopt an existing story rather than
   creating a second one. Rules and the exact decision table:
   [references/state-and-lifecycle.md](references/state-and-lifecycle.md).
4. **Mine the project for real material.** Read what the repository actually contains — code,
   specs, commits, tests, decisions — and build the article on facts you can point at.
   Method: [references/project-mining.md](references/project-mining.md).
5. **Pick one thesis.** One claim the article defends, one reader it is written for, one thing
   they can do differently afterwards. Articles that cover a project exhaustively land as
   documentation, not as stories.
6. **Draft into the workspace** using [templates/article-draft.md](templates/article-draft.md),
   in the subset of Markdown that survives the transfer to Medium's editor —
   [references/medium-authoring.md](references/medium-authoring.md).
7. **Redact, then decide the closing link.** Scrub project references, internal paths, private
   URLs, hostnames, credentials and anything that identifies systems the reader has no access
   to. Then check whether the project has a public repository: if it does, propose ending the
   article with a single link to it. Both rules live in
   [references/privacy-and-redaction.md](references/privacy-and-redaction.md).
8. **Fix the voice.** Apply [references/writing-standard.md](references/writing-standard.md),
   then run the `humanizer` skill over the draft and save the result back. A draft that reads
   as machine-produced fails this step regardless of its accuracy.
9. **Verify every claim.** Numbers, benchmarks, version numbers, API names and quotes must
   trace to something in the repository or a source you checked. Delete what you cannot
   substantiate — do not soften it into a vague claim.
10. **Choose the transfer path and get authorization.** Paths, their trade-offs and the
    current state of Medium's API: [references/publishing-paths.md](references/publishing-paths.md).
    Confirm the specific remote action with the operator before performing it.
11. **Apply story metadata on Medium**: title, subtitle, up to five tags, SEO title and
    description, canonical link, publication target, paywall choice. Field-by-field:
    [references/medium-platform.md](references/medium-platform.md).
12. **Record state and report.** Update the ledger and the local snapshot, then report the
    story URL, whether it was created or updated, what was redacted, and what still needs a
    human (images, the publish button, publication submission).

## Pre-Delivery Checks

- [ ] Create-vs-update decided from the ledger **and** a check against Medium, not from a guess
- [ ] No second story created for a project that already has one
- [ ] Workspace exists, is git-ignored, and nothing in it is tracked or staged
- [ ] No repository URL, internal path, hostname, ticket ID, customer name or credential in the text
- [ ] Code samples are self-contained and inline, with no gist and no link into a file tree
- [ ] Repository link: included only if the remote is confirmed public and the operator agreed;
      root URL only, at the end, once
- [ ] Every number and factual claim traces to the repository or a checked source
- [ ] Title, subtitle, tags (≤5), SEO description prepared; canonical link decided
- [ ] `humanizer` applied to the final draft; the writing-standard anti-patterns are absent
- [ ] Medium's AI-disclosure policy assessed and the operator's decision recorded
- [ ] No remote write performed without explicit authorization for that action
- [ ] Ledger and snapshot updated; report states what a human still has to do

## References

- [references/medium-platform.md](references/medium-platform.md) — how Medium works: stories,
  drafts, story settings, tags, SEO and canonical links, publications, paywall and friend
  links, distribution, and the AI-content policy.
- [references/medium-authoring.md](references/medium-authoring.md) — what the Medium editor
  can and cannot represent, the Markdown subset that survives transfer, code blocks, images,
  embeds, and the shortcuts used to apply structure.
- [references/publishing-paths.md](references/publishing-paths.md) — API status, the import
  tool, assisted browser transfer, manual transfer; how to choose and what each costs.
- [references/state-and-lifecycle.md](references/state-and-lifecycle.md) — the local ledger,
  create-vs-update detection, divergence handling, and how an update is written.
- [references/privacy-and-redaction.md](references/privacy-and-redaction.md) — the
  never-leaves-the-machine rule, workspace setup, the redaction pass, the scrub checklist, and
  when a public repository may be linked at the end of the article.
- [references/project-mining.md](references/project-mining.md) — reading a repository for
  article material and turning it into evidence-backed claims.
- [references/writing-standard.md](references/writing-standard.md) — the professional voice,
  structure that holds attention, and the AI-prose patterns to strip.
- [templates/article-draft.md](templates/article-draft.md) — draft skeleton with the metadata
  block Medium needs.
- [templates/state.example.json](templates/state.example.json) — ledger schema.
