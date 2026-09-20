# WyteLab bug fix — 2026-09-20 (3): Vercel build failure — "Issue" is not exported by lucide-react

## Symptom (from the real Vercel build log)

```
error during build:
src/pages/GitHubHub.jsx (2:34): "Issue" is not exported by
"node_modules/lucide-react/dist/esm/lucide-react.js", imported by
"src/pages/GitHubHub.jsx".
```

## Root cause

`src/pages/GitHubHub.jsx` imported an icon named `Issue` from `lucide-react`
and used it purely decoratively on the "Issues" quick-work card. `lucide-react`
has never exported an icon called `Issue` — no version of the package does.
This is exactly the kind of bug that couldn't be caught by anything run in
this sandbox: a syntax-level parse (`esbuild.transformSync`) happily accepts
`import {Issue} from "lucide-react"` because it's syntactically valid — it's
only a real build, with the actual package installed, that resolves named
imports against what the module really exports (Rollup, which Vite uses,
does this at bundle time). No amount of static source review here would have
caught it without either network access to install the real dependency or
seeing the real build log — which is what surfaced it.

## Fix

Replaced the import and its one usage with `CircleDot` — lucide's actual,
long-standing icon for exactly this "issue / pending" concept (it's tagged
`issue`, `pending`, `version control` in Lucide's own icon metadata, and has
existed since a very old Lucide release, well before the `^0.468.0` pinned in
`package.json`).

- `src/pages/GitHubHub.jsx`: `import {..., Issue, ...} from "lucide-react"` →
  `import {..., CircleDot, ...} from "lucide-react"`
- `<Issue size={18}/>` → `<CircleDot size={18}/>` on the Issues quick-work
  card

## Checked for the same mistake elsewhere

Every other `lucide-react` import in `src/` (57 other distinct icon names —
`TriangleAlert`, `FileArchive`, `Stethoscope`, `Workflow`, `CheckCircle2`,
`Clock3`, `BookMarked`, `Merge`, `GitFork`, `GitPullRequest`, `GitCompare`,
etc.) was checked against Lucide's real icon set. `Issue` was the only one
that doesn't exist — everything else is a genuine, current lucide-react
export.

## Regression guard added

`scripts/check-build.mjs` now cross-checks every
`import {...} from "lucide-react"` in `src/` against the actual named exports
of the installed `lucide-react` package (once `npm install` has run — in this
sandbox, with no network access, it degrades to a clear warning instead of a
false pass, exactly like the existing esbuild syntax check does). Verified
this guard actually works, not just that it's present:

- Built a temporary stub `lucide-react` locally containing exactly the 59
  icon names currently used across `src/` → check script: **PASS**
- Reintroduced the original bug (`Issue` instead of `CircleDot`, so the stub
  no longer had a matching export) → check script: **FAILED**, reporting the
  exact file and name, matching the real Vercel error
- Restored the fix and removed the temporary stub → check script: **PASS**
  again

This means the next time a nonexistent icon name (or, more generally, any
nonexistent named import from `lucide-react`) is introduced, `npm run check`
in CI/Vercel will catch it before the Rollup build does, with a clearer error
message pointing at the exact file and name.

## Verified after the fix

- `node --check api/index.js` — PASS
- `node scripts/check-build.mjs` — PASS
- All 46 `src/**/*.{js,jsx}` files re-parsed with esbuild — PASS, no syntax
  errors
- `grep -n "Issue" src/pages/GitHubHub.jsx` — no remaining references to the
  removed icon name (only unrelated English words: "Quick issue", "New
  issue", `createIssue`, etc.)
