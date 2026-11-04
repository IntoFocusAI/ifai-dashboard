"use client";

import { logout } from "@/app/auth/actions";
import { setActiveOrganization } from "@/app/auth/organization-actions";
import { SECURITY_PATH } from "@/app/(canvas)/dashboard/security/security-copy";
import type { CanvasUserMenu } from "@/lib/canvas-sdk/types";
import { ProfileSettingsModal } from "@/components/auth/ProfileSettingsModal";
import { Building2, Check, ChevronDown, LogOut, Moon, Settings, Shield, Sun, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "./user-menu.css";

type Props = CanvasUserMenu & {
  variant: "canvas" | "portal";
  lightTheme?: boolean;
  onThemeToggle?: () => void;
  showThemeToggle?: boolean;
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  profileOpen?: boolean;
  onProfileOpenChange?: (open: boolean) => void;
};

function emailLocalPart(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export function UserMenuDropdown({
  email,
  displayName,
  avatarUrl,
  organizationName,
  roleLabel,
  organizations = [],
  activeOrganizationId,
  variant,
  lightTheme = false,
  onThemeToggle,
  showThemeToggle = false,
  menuOpen: menuOpenControlled,
  onMenuOpenChange,
  profileOpen: profileOpenControlled,
  onProfileOpenChange,
}: Props) {
  const [openUncontrolled, setOpenUncontrolled] = useState(false);
  const [profileOpenUncontrolled, setProfileOpenUncontrolled] = useState(false);
  const open = menuOpenControlled ?? openUncontrolled;
  const profileOpen = profileOpenControlled ?? profileOpenUncontrolled;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const label = displayName?.trim() || emailLocalPart(email);

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(open) : value;
      onMenuOpenChange?.(next);
      if (menuOpenControlled === undefined) setOpenUncontrolled(next);
    },
    [menuOpenControlled, onMenuOpenChange, open],
  );

  const setProfileOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(profileOpen) : value;
      onProfileOpenChange?.(next);
      if (profileOpenControlled === undefined) setProfileOpenUncontrolled(next);
    },
    [onProfileOpenChange, profileOpen, profileOpenControlled],
  );

  const closeMenu = useCallback(() => setOpen(false), [setOpen]);
  const closeProfile = useCallback(() => setProfileOpen(false), [setProfileOpen]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (profileOpen) return;
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (profileOpen) return;
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, open, profileOpen]);

  const shellClass =
    variant === "portal" ? "user-menu user-menu-portal" : "user-menu user-menu-canvas";

  return (
    <div className={shellClass} ref={rootRef}>
      <button
        type="button"
        className={
          variant === "canvas" ? "user-menu-trigger hdr-btn" : "user-menu-trigger user-menu-trigger-portal"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        title={email}
        onClick={() => setOpen(!open)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="user-menu-avatar" width={20} height={20} />
        ) : (
          <User size={13} aria-hidden />
        )}
        <span className="user-menu-trigger-label">{label}</span>
        <ChevronDown size={12} className={`user-menu-chevron${open ? " open" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div className="user-menu-panel" id={menuId} role="menu">
          <div className="user-menu-email" title={email}>
            <span>{email}</span>
            {organizationName ? (
              <span className="user-menu-org">
                {organizationName}
                {roleLabel ? ` · ${roleLabel}` : ""}
              </span>
            ) : null}
          </div>

          {organizations.length > 0 ? (
            <div className="user-menu-org-picker" role="group" aria-label="Organizations">
              <p className="user-menu-org-picker-label">Organization</p>
              {organizations.map((org) => {
                const selected = org.id === activeOrganizationId;
                return (
                  <form key={org.id} action={setActiveOrganization}>
                    <input type="hidden" name="organizationId" value={org.id} />
                    <button
                      type="submit"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={`user-menu-item user-menu-org-option${selected ? " selected" : ""}`}
                      onClick={closeMenu}
                    >
                      <Building2 size={14} aria-hidden />
                      <span className="user-menu-org-option-name">{org.name}</span>
                      {selected ? <Check size={14} className="user-menu-org-check" aria-hidden /> : null}
                    </button>
                  </form>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            role="menuitem"
            className="user-menu-item"
            onClick={() => {
              closeMenu();
              setProfileOpen(true);
            }}
          >
            <Settings size={14} aria-hidden />
            <span>Profile settings</span>
          </button>

          {/* Leaving the page unmounts the menu. Closing it here would make the canvas URL
              sync replace the route with /dashboard and cancel the navigation. */}
          <Link
            href={lightTheme ? `${SECURITY_PATH}?theme=light` : SECURITY_PATH}
            role="menuitem"
            className="user-menu-item user-menu-item-link"
          >
            <Shield size={14} aria-hidden />
            <span>Security</span>
          </Link>

          {showThemeToggle && onThemeToggle ? (
            <button
              type="button"
              role="menuitem"
              className="user-menu-item"
              onClick={() => {
                onThemeToggle();
                closeMenu();
              }}
            >
              {lightTheme ? <Sun size={14} aria-hidden /> : <Moon size={14} aria-hidden />}
              <span>{lightTheme ? "Switch to dark mode" : "Switch to light mode"}</span>
            </button>
          ) : null}

          <form action={logout}>
            <button type="submit" role="menuitem" className="user-menu-item user-menu-item-danger">
              <LogOut size={14} aria-hidden />
              <span>Log out</span>
            </button>
          </form>
        </div>
      ) : null}

      <ProfileSettingsModal
        open={profileOpen}
        onClose={closeProfile}
        variant={variant}
        lightTheme={lightTheme}
        email={email}
        displayName={displayName?.trim() ?? ""}
        avatarUrl={avatarUrl ?? null}
        organizationName={organizationName ?? null}
        roleLabel={roleLabel ?? null}
      />
    </div>
  );
}
