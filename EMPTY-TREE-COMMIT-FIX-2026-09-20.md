# WyteLab bug fix — 2026-09-20 (2): "Not Found" when committing after deleting every file

## Symptom

Delete every file in a repository in WyteLab, then try to commit and push:
GitHub rejects it with a bare "Not Found" error.

## Root cause

`api/index.js`'s commit endpoint has a dedicated code path for a commit that
deletes every file WyteLab had loaded for the repo (`allDeletions`). That path
did **not** ask GitHub to create an empty tree — it skipped tree creation
entirely and referenced Git's well-known empty-tree object hash
(`4b825dc642cb6eb9a060e54bf8d69288fbee4904`) directly, on the assumption that
because the hash is a universal constant, it must already exist in every
repository.

It doesn't. GitHub's Git Data API stores tree/blob/commit objects **per
repository** — an object only "exists" there once something has actually
created it in that repo's object database, regardless of whether an object
with the same content hash already exists elsewhere. `POST /git/commits`
referencing a tree SHA that was never created in that specific repo returns
`{"message":"Not Found"}` — exactly the error reported. (This matches a
documented GitHub API quirk: even *reading* the tree of a commit with a
genuinely empty tree can 404, per GitHub's own community forum, because these
objects aren't materialized the way one might expect.)

The code's own comment claimed this exact SHA "doesn't need to be created,"
which is the incorrect assumption that caused the bug.

## Fix

`api/index.js`, the `allDeletions` branch now calls
`POST /repos/{owner}/{repo}/git/trees` with `{"tree": []}` and no
`base_tree` — which is GitHub's documented way to create a new, empty tree
object in that specific repository, returning that same well-known SHA once
it actually exists there. That returned SHA is then used for the commit, so
nothing is referenced before it's created.

## Other actions affected by the same class of bug

Two more code paths read the tree of an arbitrary commit with no fallback for
GitHub's "empty tree can 404 on read" quirk, and would have thrown the same
raw "Not Found" in the right circumstances:

- **Revert to a previous commit** (`/github/repos/:owner/:repo/revert`) —
  reads both the target commit's tree and the branch's current tree to check
  whether either touches `.github/workflows/`. If either commit happens to
  have an empty tree (e.g. reverting to/from the point the repo had zero
  files), this would throw uncaught.
- **The push-conflict check** that runs when the remote branch moved while
  you had local edits open — reads the latest remote commit's tree to look
  for real conflicts. If the remote's latest commit has an empty tree, this
  would throw uncaught and block a push that had no real conflict at all.

Added a shared `readTreeOrEmpty()` helper that treats a 404 on these
tree-of-a-specific-commit reads as a legitimate empty tree (`{tree: []}`)
instead of an error, and used it in both spots above.

## Verified after the fix

- `node --check api/index.js` — PASS
- `node scripts/check-build.mjs` — PASS, now with a regression guard that
  fails the build if `api/index.js` ever references the empty-tree SHA
  directly instead of creating it first
- All 46 `src/**/*.{js,jsx}` files re-parsed with esbuild — PASS, no syntax
  errors
