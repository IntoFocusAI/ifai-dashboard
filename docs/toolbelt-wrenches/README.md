# Toolbelt wrench drafts

Source for Toolbelt wrench versions that are written but **not yet active**. Toolbelt keeps the live
code; these files exist so a reviewer can read a change before it ships and so the draft isn't lost.
Once a version is activated in Toolbelt, delete its file here in the same PR that records it.

None pending. The last drafts (Fender Walmart v15, Fender MF v18, Ledlenser Walmart v7, PR #244) were
activated on 23 Nov 2026 and removed from here.

Activate with `wrench_update` (scriptContent = the file, setActive true), then run each once with `dryRun: true` on a few ASINs.

## Rollback copies and shared source (23 Nov 2026, R-15 decision (a))

- `buybox_seller_harvester.js`: the live code of `fender_buybox_seller_harvester` v7 (Fender workspace) and
  `ledlenser_buybox_seller_harvester` v2 (Ledlenser workspace). The two saves differ only in `DEFAULT_CLIENT`.
  Change this file and re-save both.
- `fender_buybox_seller_harvester.v6.js`, `ledlenser_buybox_seller_harvester.v1.js`: the versions before, kept
  for rollback (re-save with `wrench_update`). Delete them once v7 / v2 have run cleanly for a week.
- `r15_price_match_search.v8.js`: R-15 search before the marketplace condition check (Fender workspace 558a63f3 v8 = Ledlenser 1a08597d v2). Active now: Fender v10, Ledlenser v3. To roll back, re-save this file (without its 3-line header) as a new version in each workspace.
