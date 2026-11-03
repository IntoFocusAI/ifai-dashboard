<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# IntoFocus AI — product context (durable)

Keep this section **outside** the Next.js block above. Cursor agents also load `.cursor/rules/product-context.mdc` (`alwaysApply`). Both should stay aligned. This applies to every contributor and every agent session on this repo (including Brian Magazu and Brian Watson), not only one local chat.

## Company and stakeholders

- **Company:** IntoFocus AI (IntoFocus)
- **COO:** Brian Magazu — product and commercial direction for this dashboard
- Session memory is not enough; treat this file and `.cursor/rules/product-context.mdc` as source of truth

## Clients

- **Intended clients:** product companies (brands that sell products)
- **Example in this repo:** Fender Musical Instruments Corporation (FMIC) — pilot / example briefing
- **Offer:** explain how **ecommerce performance affects AEO success**, and partner to improve AEO from all useful angles

## Audience

- Executives / sponsors and day-to-day operators, **equally**
- Write for an e-commerce or marketing operator, not an engineer

## Dashboard intent

1. Show clearly how the brand is performing on ecommerce and AEO
2. Show clearly how ecommerce issues change brand performance in AI search
3. Give clear next steps to improve overall results
4. Drill to foundational data: external listings/pages **and** IntoFocus measurements / assumption chains (e.g. a $680K uplift estimate must open to sniff-testable inputs and plain explanations; a suppressed Amazon listing must link to the Walmart listing causing it when that is the cause)
5. **Delegation / paid tiers — parked.** Do not design or build DIY / Done-with-You / Done-for-You workflows unless explicitly asked. Future awareness only: DIY (client/agents act), Done-with-You (shared ownership indicators), Done-for-You (IntoFocus owns actions)

## Implementation priority

Prefer clarity of the ecommerce ↔ AEO story and evidence trails over generic analytics chrome. Every headline metric should have a path to source assumptions and raw inputs.

## Let the data speak

Do not put qualifiers on screen that say what a figure is not, such as "not a random sample" or "not proof of cause." Show the figure with its N of M and let it speak. If a caveat is truly needed, put it in the figure's tooltip. Required labels stay visible: "analyst estimate," "Not available*," and the asterisk on a partial or filtered figure.

## Database changes

The live dashboard reads the production Supabase database (`SUPABASE_DB_URL` points at it). Every database change starts as a migration file in `supabase/migrations`, committed with its pull request, so there is a log to revert from. Each file says what it changes and how to undo it.

- **Additive changes** (a new view, table, column, or function that leaves existing objects and data as they are) may be applied to production by an agent after Brian Magazu approves. The pull request records when the change was applied and by whom.
- **Anything that alters or deletes existing data, tables, columns, views, or permissions** waits for Brian Watson, who applies it.
- Never run other writes against the production database.

## Client commercial terms

The client portal never discusses IntoFocus fees, retainers, monthly charges, or whether the brand's estimated lift justifies IntoFocus's price. Do not show a service-fee multiple.

## Parked follow-up

Phase 1 and full-enterprise dollar figures stay labeled as analyst estimates. Opening each figure to its inputs and formula is a later pass. Do not invent that formula, and do not hold other fixes for it.
