"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { SITES_TO_REVIEW_PATH } from "@/lib/ai-search/site-review";
import { activeClientKey, clientHref } from "@/lib/client/active-client";

const STAFF_CHECK_PATH = `${SITES_TO_REVIEW_PATH}/staff`;

let staffCheck: Promise<boolean> | null = null;

/**
 * Asks the server once per page load whether the signed-in user is IntoFocus staff (the same
 * session check the page makes). Any failure reads as not staff. This only hides the link; the
 * page, its CSV, and the save each check staff again on the server.
 */
function isStaffViewer(): Promise<boolean> {
  staffCheck ??= fetch(STAFF_CHECK_PATH, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { staff?: unknown } | null) => body?.staff === true)
    .catch(() => false);
  return staffCheck;
}

/** The user-menu link to the staff Sites to review list. Renders nothing for anyone else. */
export function SitesToReviewMenuLink({ lightTheme = false }: { lightTheme?: boolean }) {
  const [staff, setStaff] = useState(false);

  useEffect(() => {
    let live = true;
    void isStaffViewer().then((value) => {
      if (live) setStaff(value);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!staff) return null;
  const href = clientHref(activeClientKey(), SITES_TO_REVIEW_PATH);
  return (
    <Link
      href={lightTheme ? `${href}${href.includes("?") ? "&" : "?"}theme=light` : href}
      role="menuitem"
      className="user-menu-item user-menu-item-link"
      data-sites-review-link=""
    >
      <ListChecks size={14} aria-hidden />
      <span>Sites to review</span>
    </Link>
  );
}
