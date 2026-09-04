# Contract: `gh pr view --json` label field

## Command

```
gh pr view --json number,state,isDraft,url,labels
```

(`labels` added to the existing field list in `probePrResult`, `src/git.js:328`.)

## Expected response shape (relevant field only)

```json
{
  "number": 123,
  "state": "OPEN",
  "isDraft": false,
  "url": "https://github.com/owner/repo/pull/123",
  "labels": [
    { "id": "...", "name": "bug", "description": "...", "color": "..." },
    { "id": "...", "name": "priority-high", "description": "...", "color": "..." }
  ]
}
```

## This project's contract with that response

- Only `labels[].name` is read; every other field on a label object is ignored (data-model.md).
- `labels` absent or empty → treated as zero labels, not an error.
- Command failure (auth, network, timeout) → the whole PR lookup fails as it does today; `labels` is simply not part of a failed lookup's cached value.

## Payload-sourced path (GitLab MRs, or PR data supplied by Claude Code's statusLine payload)

```json
{ "number": 45, "url": "...", "review_state": "approved", "kind": "mr", "labels": ["needs-review"] }
```

`normalizePr()` reads `raw.labels` when present and passes it through as an array of strings; no shape conversion needed since the payload already sends plain names.
