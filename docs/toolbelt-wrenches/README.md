# Toolbelt wrench drafts

Source for Toolbelt wrench versions that are written but **not yet active**. Toolbelt keeps the live
code; these files exist so a reviewer can read a change before it ships and so the draft isn't lost.
Once a version is activated in Toolbelt, delete its file here in the same PR that records it.

| File | Wrench | Waits on |
|---|---|---|
| `fender_retail_buybox_map_audit.v15.js` | 1ecc6b76 (Fender Walmart, workflow task 37afeb74) | migration `20261118180000_retailer_match_streak_columns.sql` |
| `fender_map_checker_musiciansfriend.v18.js` | a4c64ed0 (Fender MF, task f75da59f) | same |
| `ledlenser_walmart_price_audit.v7.js` | c9e882ff (Ledlenser Walmart, workflow 6526704f) | same |

Activate with `wrench_update` (scriptContent = the file, setActive true), then run each once with `dryRun: true` on a few ASINs.
