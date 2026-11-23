"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { SITES_TO_REVIEW_PATH } from "@/lib/ai-search/site-review";
import { isStaffViewer } from "@/components/staff/staff-check";
import { activeClientKey, clientHref } from "@/lib/client/active-client";

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
