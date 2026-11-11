"use client";

import "@/components/v3/live/page-found.css";
import { useMemo, useState } from "react";
import type { AmazonSpecRowsRead } from "@/components/v3/live/FenderSpecPanel";
import { formatInt } from "@/lib/fender-canvas/format";
import {
  categoryListingLabel,
  categoryRequiredTooltip,
  REQUIRED_FIELDS_PER_CATEGORY,
  requiredSpecListsByCategory,
  type CategoryRequiredList,
} from "@/lib/findability/required-spec-fields";

/** Categories named before the rest fold behind "N more categories". */
const SHOWN_CATEGORIES = 4;

function CategoryTerm({ list }: { list: CategoryRequiredList }) {
  const title = `${list.category} required fields`;
  const desc = categoryRequiredTooltip(list);
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={desc}
      data-amazon-specs-required-category={list.category}
      data-amazon-specs-required-fields={list.fields.map((fill) => fill.field).join(";")}
      tabIndex={0}
      aria-label={`${title}: ${desc}`}
    >
      {categoryListingLabel(list)}
    </span>
  );
}

/**
 * Names how Amazon Specs chose each category's required fields (D-05): the top 10 by fill rate
 * across the category's checked listings, read from the same rows as the listings table.
 */
export function AmazonSpecsRequiredFields({ read }: { read: AmazonSpecRowsRead }) {
  const [open, setOpen] = useState(false);
  const rows = read.phase === "ready" ? read.rows : null;
  const lists = useMemo(() => (rows ? requiredSpecListsByCategory(rows) : []), [rows]);
  if (lists.length === 0) return null;

  // One hidden category is named, not folded.
  const shown = open || lists.length <= SHOWN_CATEGORIES + 1 ? lists : lists.slice(0, SHOWN_CATEGORIES);
  const hidden = lists.length - shown.length;
  const lead =
    lists.length === 1
      ? `Required fields: top ${REQUIRED_FIELDS_PER_CATEGORY} by fill rate in `
      : `Required fields: top ${REQUIRED_FIELDS_PER_CATEGORY} by fill rate in each category. `;

  return (
    <p
      className="findability-last-checked"
      data-amazon-specs-required-list="fill-rate"
      data-amazon-specs-required-categories={lists.length}
    >
      {lead}
      {shown.map((list, index) => (
        <span key={list.category}>
          {index > 0 ? "; " : null}
          <CategoryTerm list={list} />
        </span>
      ))}
      {hidden > 0 ? (
        <>
          {"; "}
          <button
            type="button"
            className="amazon-specs-required-more"
            data-amazon-specs-required-more=""
            onClick={() => setOpen(true)}
          >
            Show {formatInt(hidden)} more {hidden === 1 ? "category" : "categories"}
          </button>
        </>
      ) : null}
      .
    </p>
  );
}
