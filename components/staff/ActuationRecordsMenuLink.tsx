"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { isStaffViewer } from "@/components/staff/staff-check";
import { activeClientKey, clientHref } from "@/lib/client/active-client";
import { ACTUATION_RECORDS_PATH } from "@/lib/fender-canvas/actuation-records";

/** The user-menu link to the staff Actuation records page (SC-03). Renders nothing for anyone else. */
export function ActuationRecordsMenuLink({ lightTheme = false }: { lightTheme?: boolean }) {
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
  const href = clientHref(activeClientKey(), ACTUATION_RECORDS_PATH);
  return (
    <Link
      href={lightTheme ? `${href}${href.includes("?") ? "&" : "?"}theme=light` : href}
      role="menuitem"
      className="user-menu-item user-menu-item-link"
      data-actuation-records-link=""
    >
      <ClipboardCheck size={14} aria-hidden />
      <span>Actuation records</span>
    </Link>
  );
}
