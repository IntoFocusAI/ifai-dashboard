# Toolbelt wrench drafts

Source for Toolbelt wrench versions that are written but **not yet active**. Toolbelt keeps the live
code; these files exist so a reviewer can read a change before it ships and so the draft isn't lost.
Once a version is activated in Toolbelt, delete its file here in the same PR that records it.

None pending. The last drafts (Fender Walmart v15, Fender MF v18, Ledlenser Walmart v7, PR #244) were
activated on 23 Nov 2026 and removed from here.

Activate with `wrench_update` (scriptContent = the file, setActive true), then run each once with `dryRun: true` on a few ASINs.

## Rollback copies

- `r15_price_match_search.v8.js`: R-15 search before the marketplace condition check (Fender workspace 558a63f3 v8 = Ledlenser 1a08597d v2). Active now: Fender v10, Ledlenser v3. To roll back, re-save this file (without its 3-line header) as a new version in each workspace.
