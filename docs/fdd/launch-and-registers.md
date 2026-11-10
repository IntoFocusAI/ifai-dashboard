# 15. Launch readiness and acceptance

| **Ready to show** | **Say this in the room** |
|---|---|
| Hub map and six spokes | Balanced view is the Fender pilot picture. |
| Buy Box / Featured Offer readings | Withheld split and freshness are live. On the 7.4 build, primary copy says Buy Box and the tooltip says Amazon also calls it the Featured Offer. Published Pages still says Featured Offer until that build deploys. |
| MAP price gaps | Exposure today is price gap, not lost revenue. |
| AI rates on the Oct 18 partial run | Useful directionally; failed engines must not be sold as results (A-09). |
| +\$680K / +\$38–62M | Analyst estimates until Opportunity trails exist. |
| Out of stock lost sales | Analyst estimate on the Out of Stock tab (R-17). A missing estimate reads Not estimated, never \$0. The no-Buy-Box figure is an upper bound and stays out of the total. The 80% suppression dollar remains R-06. |
| AI Consensus, AI Foundation, and AI Commerce | Live on Summary Performance. AI Commerce is also on Retail Overview. Placeholder inputs are marked. A score under 40 is red, 40 through 70 is amber, and above 70 is green. AI Actuation is not included. |

| **Not ready to claim** | **Why** |
|---|---|
| AI Actuation | Not included. There is no owner, evidence, or dated record yet (SC-03 TARGET). |
| 80% suppression dollars | Formula and revenue source order approved; not deployed (R-06). |
| Catalog Health, Summary, Opportunity, and Run Details labels | Desktop-verified on the 7.4 build (PR 43). Not on the published site until that branch deploys. |
| Done-Together / Need help? | Approved; not in build (N-07). |
| Deep dive density | Direction approved; depth LATER. |

# 16. DECISION register

| **ID** | **Decision** | **Suggested default if unanswered** |
|---|---|---|
| S-03 | Omit Strategy Roadmap for launch? | Decided 9 Nov 2026: keep, one tab, 30-60-90 Days (S-02). |
| R-16 | Catalog/MAP upload placement? | Decided 9 Nov 2026: LATER. |
| N-09 | Ask IntoFocus capabilities? | Decided 9 Nov 2026: LATER. |
| X-29 | Which unimplemented security controls to list? | Decided 4 Nov 2026: real constraints only; others marked not decided; no fees line. |
| D-03 / X-18 | Final wording of headings Brian has not renamed? | Decided 9 Nov 2026: the rename list in X-18. |
| R-02 | How each seller model is drawn? | Decided 9 Nov 2026: label only. |
| R-13 | Bundle population on screen? | Decided 4 Nov 2026: bundles with a live offer, and the screen says so. |
| A-04 | Raw/canonical URLs inline or drawer? | Drawer only. |
| A-07 | Model-column hover copy? | “not recorded” is enough. |
| D-05 | Required marketplace specs by category? | Decided 9 Nov 2026: guitar list for Fender, lighting fields for Ledlenser, both marked placeholder. |
| D-06 | A+ source and dollar effect? | Content shares are on screen. Keep the sales effect unestimated until the source is chosen. |
| N-03 | Client-editable assumptions later? | Decided 9 Nov 2026: LATER. |
| X-02 | Satellite click? | Decided 9 Nov 2026: open the tab. |

| PM24-1 | No hover tooltips on the AI Search Visibility and Competitive Radar map bubbles; the API-engine detail is clear once the view is open. | Done. Worker 24.8, PR 158 (main 77e4c7e), merged 10 Nov 2026: the AI Search Visibility and Competitive Radar map bubbles have no hover tooltip. |
|---|---|---|
| PM24-2 | Competitive Radar disagrees with itself: the map bubble says “Yamaha leads Acoustics” while Category Battlecards shows Taylor as the top Acoustics rival. Find the cause (likely two populations or two rules for “leads”) before changing anything. | Done, option A (decision 40). Cause: two populations. The bubble now reads the Battlecards rows for the date-pill window with the tab's category-lead function; Fender reads “Taylor leads Acoustics”. Worker 24.8, PR 158 (main 77e4c7e). The longer bubble load (about 32 s Fender, 16 s Ledlenser) is accepted for now (decision 41). |
| PM24-3 | Product Fact Checks: put the accuracy figure to the right of the “catalog products checked” figure, not below it. | Done (decision 42). The lead is one row: catalog figure, accuracy, then the question, its sentence and the contradictions badge; no lower box. Worker 24.8, PR 158 (main 77e4c7e). |

# 17. LATER register

| **ID** | **Deferred** |
|---|---|
| X-06 | Mobile layout; fullscreen/native shell. |
| X-30 | Google and TikTok Shop as default commerce sources (high priority). |
| C-05 | Competitor-specific comparison beyond the question battery (high priority). |
| C-06 | Battlecard avatars / podium. |
| N-06 | Gamification. |
| X-26 | Removing PM/Worker versioning from the title. |
| — | Guided viewing order after the six home answers are solid. |
| — | User-editable assumptions. |
| — | Whether seller type should change scores rather than scoring against the assigned model. |
| Deep dive | Durvet-style density beyond approved direction. |

| — | A chart of how much of the estimated gap has closed since tracking began (Action Items). |
|---|---|

| X-24 | Bubble pulse when a bubble changed since the viewer's last visit (needs login). |
|---|---|
| R-16 | Catalog and MAP administrator upload. |
| N-09 | Ask IntoFocus prompt in Minimal. |
| X-10 | Excel and PDF exports. |
| S-03 | Roadmap Progress tab. |

# 18. Traceability appendix

Feature IDs are shared with the Technical Design Document. Verification reflects this revision’s checks.

| **ID** | **Status** | **Depends on** | **Verification** |
|---|---|---|---|
| X-19 | CURRENT | Copy pass | Desktop-verified on the 7.4 build. Published Pages still cfd45de until deploy. |
| H-06 / H-07 | CURRENT / REFINE | Summary IA | H-06 Summary desktop-verified. H-07 score layout is on Performance and stays REFINE until the scores are shown against a target and AI Actuation is included. |
| R-01 | CURRENT | Catalog Health rename | Catalog Health and Partner-led desktop-verified on the 7.4 build. |
| R-06 | TARGET | Revenue inputs + 80% trail | Not deployed |
| SC-01, SC-02, SC-04 | CURRENT | Coverage + components | Pull request 92, main 65e2c79. Placeholder inputs are marked. SC-03 stays TARGET. |
| R-18 | CURRENT | Partner-led authorized sellers | Live. PR 99, commits 957f768, 0a413cb, and 13d021f, main aa6f29c. |
| R-19 | TARGET | R-18 browser control | Not built. Direction recorded 2 Nov 2026. |
| N-07 | TARGET | Contract ownership model | Not deployed |
| N-05 | CURRENT | Current findings | Approved 29 Oct 2026. Pull request 80. Interactive ROI is gone. |
| A-02 | TARGET | 306-call runs | 3 repeats since 3 Nov 2026 (collector v15). API engines and the switch live: PRs 129 and 134. |
| X-20 | TARGET | PM agent practice | Change log started in v1.1 |
| S-03 | DECISION | Brian | Open |
| D-09 | REFINE | Findability cycle | Live. PR 97, commits b124a27 and 4fa1258, main 716e910. Unchecked is not generally zero. |
| D-10 | CURRENT | Findability table | Live. PR 102, commit 8d2518c, main f37a856. |
| D-11 | CURRENT | Findability table | Live. PR 103, commit 2f163be, main 32f8a47. |
| X-21 | REFINE | Minimal view | PRs 111 and 114, main 403b307. Deep dive and Ask IntoFocus wait. |
| A-05 | CURRENT | Fact-check method | PR 106, main fff5dd2. Catalog counts follow the first rotated runs. |
| A-10 | CURRENT | Citation Ecosystem | PR 107, main a1080b4. |
| C-03 | CURRENT | Category Battlecards | PR 108, main 7623bc2. |
| N-08 | CURRENT | Done and Set aside | PR 101, main a4560fe. |
| R-17 | CURRENT | Out of Stock windows | PR 100, main 799bc1b. |

| X-32 | CURRENT | Map interaction | PRs 127, 132, 135; main e0f91e3. |
|---|---|---|---|
| X-09 | CURRENT | AI Search window | PR 120, main 3828b41. |
| X-03 / X-04 | CURRENT | Figure-first audit | PR 122, main 9e83004. Action Items and Opportunity exempt. |
| X-29 | REFINE | Security page | PR 124, main 617ef7b. Ryan and Brian Watson review before launch. |
| D-04 | CURRENT | Amazon Specs | PR 119, main 796ebd2. |
| R-12, R-08, R-05, R-13, H-04 | CURRENT | Catalog Health | PR 121, main e715570. |

## Sources

> • Module 1 Optimization — https://docs.google.com/document/d/1Fq3k2JkifZdXGE_2AZ-OZpSQtDZtj-wwnAwo2fmo1Aw/edit
>
> • FDD Addendum — https://docs.google.com/document/d/18NVO3vuUbf6Ob9rNJTjYnMnhI1EAXSKPGCu7G262GLI/edit
>
> • Suppression study — https://doi.org/10.1145/3774904.3792473
>
> • Recommendation Lab example — https://github.com/geneticmarauder/aeo
>
> • Repo main cfd45de — https://github.com/brianw-ifai/ifai-dashboard
