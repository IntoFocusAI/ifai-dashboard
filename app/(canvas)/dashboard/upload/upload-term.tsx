import type { ReactNode } from "react";

/** Dotted definition. The page tooltip reads these attributes. No native title. */
export function UploadTerm({
  term,
  desc,
  children,
}: {
  term: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <span
      className="ifai-term"
      data-ifai-tooltip-title={term}
      data-ifai-tooltip-desc={desc}
      tabIndex={0}
      aria-label={`${term}: ${desc}`}
    >
      {children}
    </span>
  );
}
