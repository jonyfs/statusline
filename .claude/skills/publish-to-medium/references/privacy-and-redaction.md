# Privacy and Redaction

This is the skill's hard constraint. Every other rule in this skill gives way to it.

## The Rule

**Project material this skill produces or consumes never reaches an online repository or any
other public host.** That covers GitHub, GitLab, Bitbucket, gists, pastebins, CI artifact
stores, file-sharing links, and any "publish this so Medium can import it" workaround. The only
thing that ever leaves the machine is the finished article text, and only after the redaction
pass below.

Two consequences follow, and neither is negotiable:

- **Draft artifacts stay local.** They live in the workspace, which is git-ignored and never
  committed, staged, or pushed.
- **The published text stands alone.** A reader with no access to the project must be able to
  follow the article end to end. If a sentence only makes sense to someone who can open the
  repository, rewrite the sentence.

The rule is about not *creating* public exposure. It does not forbid pointing at a repository
the operator already publishes, which is covered next.

## Workspace Setup

Default directory: `.medium/` at the repository root. Override with the `MEDIUM_WORKDIR`
environment variable, or with a path the operator gives. Layout:

```text
.medium/
├── state.json                 # the ledger — see state-and-lifecycle.md
├── drafts/<slug>.md           # working draft
└── published/<slug>.md        # snapshot of what was last transferred to Medium
```

Before writing anything into it:

1. Create the directory.
2. Ensure `.gitignore` contains a line for it. Append the line if it is missing; say that you
   appended it.
3. Run `git check-ignore -q <workdir>` and `git ls-files --error-unmatch <workdir>` to confirm
   the path is ignored and untracked.
4. **If any file under the workspace is already tracked, stop.** Report the tracked paths and
   ask the operator how to proceed. Do not `git rm` history on your own — the material may
   already be on a remote, which is a disclosure the operator needs to know about, not a
   problem to quietly clean up.

If the project is not a git repository, skip the ignore checks and say so.

Never `git add`, `git commit`, or `git push` anything under the workspace, and never include it
in a commit made for another reason. If the operator explicitly asks to commit a draft, warn
that it defeats this skill's purpose and get a second confirmation before doing it.

## The Redaction Pass

Run over the finished draft, before any transfer. Every hit is either removed, generalized, or
replaced with a self-contained equivalent.

| Category | Examples | What to do |
|---|---|---|
| Repository references | Branch names, PR, issue, commit and file/line links, `org/repo` used mid-sentence | Remove. Describe the change in prose instead. One exception: the closing repository link, below. |
| Local paths | `/Users/...`, `C:\Users\...`, `~/work/...`, deep `src/...` trees | Replace with a generic filename or drop the path. |
| Infrastructure | Internal hostnames, private IPs, cluster and bucket names, queue and topic names, database names | Replace with a neutral placeholder. |
| Identity | Employer, client and product names, colleague names, ticket IDs, Slack channels | Remove unless the operator confirms each one is public and cleared. |
| Secrets | Keys, tokens, connection strings, `.env` values, sample credentials that look real | Remove. Never publish a redacted-looking key — publish no key. |
| Data | Real user records, logs with identifiers, screenshots of internal tools | Replace with synthetic data you author. |
| Metrics | Internal dashboards, revenue, headcount, incident counts | Only with explicit clearance; otherwise cut. |

Code samples get the same treatment and one extra rule: **they are inlined in the article, not
linked.** No gist, no "full source here" pointing into a file tree. Rewrite each sample so it
stands on its own, with names invented for the article rather than copied from the codebase.
A reader who wants the whole thing follows the closing repository link, if there is one.

Screenshots and diagrams are attachments the operator supplies or approves. Check every image
for window titles, browser tabs, file trees, and terminal prompts before it goes up.

## The Closing Repository Link

When the project already has a **public** repository, the article should normally end with a
single line pointing to it. That link costs nothing to publish, since the code is public
already, and it is what a reader who liked the article wants next.

Detection, in order:

1. Is there a remote at all? `git remote -v`, or `git remote get-url origin`. No remote means no
   link, and nothing to ask about.
2. Normalize the remote to a browsable URL. Strip `.git`, convert `git@host:owner/repo` to
   `https://host/owner/repo`, and ignore anything that is not a hosting URL, such as a local
   path or a file remote.
3. **Establish visibility.** `gh repo view <owner/repo> --json visibility` for GitHub, or the
   host's equivalent. If the CLI is unavailable or unauthenticated, ask the operator instead of
   fetching the URL to see what happens.
4. Decide:

| Visibility | Action |
|---|---|
| Public, confirmed | Propose the link and include it once the operator agrees |
| Private or internal | **No link.** Do not name the repository, the host, or the owner either |
| Unknown, and cannot be determined | **No link.** Unknown is not permission |
| Several remotes (fork, mirror) | Ask which one is canonical. Never guess between a fork and its upstream |

Shape of the link:

- The repository root only. No branch, no commit SHA, no file path, no line anchor, no PR or
  issue number. Those go stale and they expose how the work was actually done.
- One line at the end of the article, in the operator's own words. "The code is on GitHub" with
  the URL is enough. It is not a call to action, and it is not a star request.
- Never in the opening, never repeated through the body.
- The repository README is the reader's landing page. If it is empty or embarrassing, say so and
  suggest fixing it before the link goes out, rather than linking anyway.

Record the URL in the ledger as `repoLink`, so an update reuses the same link instead of
re-deriving it, and re-check visibility on each update. A repository that was public when the
article was published may not be public now.

Everything else in this document still applies to the article body. The closing link is one
approved URL, not a licence to reference the repository throughout the text.

## Why the Import Tool Is Off Limits

Medium's import feature builds a story from a public URL. Using it means putting the article —
and often the project material behind it — somewhere publicly reachable first. That is exactly
what this rule forbids. Use it only if the operator already has a public site of their own that
carries the article, and says so. See [publishing-paths.md](publishing-paths.md).

## Reporting

The final report lists what was redacted, by category and count — "3 repository links, 2
internal hostnames, 1 client name" — so the operator can check the judgment calls. If something
was cut that materially weakened the article, say which and offer a replacement.
