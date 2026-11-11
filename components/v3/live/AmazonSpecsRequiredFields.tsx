"use client";

import "@/components/v3/live/page-found.css";
import { useEffect, useMemo, useState } from "react";
import type { AmazonSpecRowsRead } from "@/components/v3/live/FenderSpecPanel";
import { PartialFigureMark } from "@/components/v3/live/FigureTip";
import { formatInt } from "@/lib/fender-canvas/format";
import { loadAmazonProductTypes, type AmazonProductTypesRead } from "@/lib/findability/amazon-product-types";
import {
  productTypeCoverageLabel,
  productTypeCoveragePartial,
  productTypeListingLabel,
  productTypeRequiredTooltip,
  requiredFieldsByProductType,
  type ProductTypeCoverage,
} from "@/lib/findability/product-type-required-fields";
import {
  categoryListingLabel,
  categoryRequiredTooltip,
  REQUIRED_FIELDS_PER_CATEGORY,
  requiredSpecListsByCategory,
  type CategoryRequiredList,
} from "@/lib/findability/required-spec-fields";

/** Categories named before the rest fold behind "N more categories". */
const SHOWN_CATEGORIES = 4;

function useAmazonProductTypes(): AmazonProductTypesRead {
  const [read, setRead] = useState<AmazonProductTypesRead>({ phase: "loading" });
  useEffect(() => {
    let cancelled = false;
    void loadAmazonProductTypes().then((result) => {
      if (!cancelled) setRead(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return read;
}

function Term({
  title,
  desc,
  children,
  data,
}: {
  title: string;
  desc: string;
  children: string;
  data: Record<string, string>;
}) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={title}
      data-ifai-tooltip-desc={desc}
      tabIndex={0}
      aria-label={`${title}: ${desc}`}
      {...data}
    >
      {children}
    </span>
  );
}

function ProductTypeTerm({ coverage }: { coverage: ProductTypeCoverage }) {
  return (
    <span data-amazon-specs-product-type={coverage.list.productType}>
      <Term
        title={`Required fields for ${coverage.list.label}`}
        desc={productTypeRequiredTooltip(coverage)}
        data={{
          "data-amazon-specs-required-fields": coverage.list.fields.map((field) => field.field).join(";"),
          "data-amazon-specs-checked-fields": coverage.checked.map((field) => field.field).join(";"),
        }}
      >
        {productTypeListingLabel(coverage)}
      </Term>
      {", "}
      <PartialFigureMark partial={productTypeCoveragePartial(coverage)} testId="amazon-specs-unchecked-fields">
        <span data-amazon-specs-coverage={`${coverage.checked.length}/${coverage.list.fields.length}`}>
          {productTypeCoverageLabel(coverage)}
        </span>
      </PartialFigureMark>
    </span>
  );
}

function CategoryTerm({ list }: { list: CategoryRequiredList }) {
  return (
    <Term
      title={`${list.category} required fields`}
      desc={categoryRequiredTooltip(list)}
      data={{
        "data-amazon-specs-required-category": list.category,
        "data-amazon-specs-required-fields": list.fields.map((fill) => fill.field).join(";"),
      }}
    >
      {categoryListingLabel(list)}
    </Term>
  );
}

/** Listings whose Amazon product type has no list keep the top 10 by fill rate in their category. */
function CategoryFallback({ lists, others }: { lists: CategoryRequiredList[]; others: boolean }) {
  const [open, setOpen] = useState(false);
  if (lists.length === 0) return null;
  // One hidden category is named, not folded.
  const shown = open || lists.length <= SHOWN_CATEGORIES + 1 ? lists : lists.slice(0, SHOWN_CATEGORIES);
  const hidden = lists.length - shown.length;
  const rule = `top ${REQUIRED_FIELDS_PER_CATEGORY} by fill rate in ${lists.length === 1 ? "" : "each category. "}`;
  const lead = others ? `Other listings, required fields: ${rule}` : `Required fields: ${rule}`;

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

/**
 * Names the required fields Amazon Specs judges (D-05): the list for each listing's Amazon product
 * type, with how many of those fields the spec check records. Listings whose product type has no
 * list, or every listing when the product types cannot be read, keep the top 10 by fill rate in
 * their category.
 */
export function AmazonSpecsRequiredFields({ read }: { read: AmazonSpecRowsRead }) {
  const productTypes = useAmazonProductTypes();
  const rows = read.phase === "ready" ? read.rows : null;
  const split = useMemo(() => {
    if (!rows || productTypes.phase === "loading") return null;
    if (productTypes.phase === "unavailable") return { coverage: [], unlisted: rows };
    return requiredFieldsByProductType(rows, productTypes.types);
  }, [rows, productTypes]);
  const fallback = useMemo(() => (split ? requiredSpecListsByCategory(split.unlisted) : []), [split]);
  if (!split) return null;

  return (
    <>
      {split.coverage.length > 0 ? (
        <p
          className="findability-last-checked"
          data-amazon-specs-required-list="product-type"
          data-amazon-specs-product-types={split.coverage.length}
        >
          {"Required fields by Amazon product type: "}
          {split.coverage.map((coverage, index) => (
            <span key={coverage.list.productType}>
              {index > 0 ? "; " : null}
              <ProductTypeTerm coverage={coverage} />
            </span>
          ))}
          .
        </p>
      ) : null}
      <CategoryFallback lists={fallback} others={split.coverage.length > 0} />
    </>
  );
}
