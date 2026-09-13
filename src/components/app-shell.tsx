"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  RollerCoaster,
  History,
  Trophy,
  Settings,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Ticket,
} from "lucide-react";
import clsx from "clsx";
import { browserClient } from "@/lib/supabase/browser";
import { Brand } from "./brand";
import { Button, Notice } from "./ui";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/coasters", label: "Coaster catalogue", icon: RollerCoaster },
  { href: "/rides", label: "Ride history", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/settings", label: "Your settings", icon: Settings },
];
export function AppShell({
  name,
  userId,
  isAdmin,
  children,
}: {
  name: string;
  userId: string;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const { data } = browserClient().auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "SIGNED_OUT" ||
          (session?.user && session.user.id !== userId)
        )
          window.location.replace("/sign-in");
      },
    );
    // BFCache must revalidate the identity rather than restoring another session's screen.
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("pageshow", onShow);
    };
  }, [userId]);
  async function signOut() {
    setBusy(true);
    setError(false);
    const { error } = await browserClient().auth.signOut();
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    window.location.replace("/sign-in");
  }
  return (
    <div className="application">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="park-sidebar">
        <div className="park-masthead">
          <Brand href="/dashboard" />
          <button
            className="icon-button park-menu-toggle"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            aria-controls="app-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
        <p className="park-tagline">For the love of the ride.</p>
        <p className="park-nav-label">YOUR NEXT ADVENTURE</p>
        <nav
          id="app-navigation"
          className={clsx("park-navigation", menu && "park-navigation-open")}
          aria-label="Main navigation"
        >
          {links.map(({ href, label, icon: Icon }, index) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={clsx("park-nav-link", pathname === href && "active")}
              aria-current={pathname === href ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
              <span className="nav-number" aria-hidden="true">
                0{index + 1}
              </span>
            </Link>
          ))}
          {isAdmin && (
            <Link
              className={clsx(
                "park-nav-link",
                pathname.startsWith("/admin") && "active",
              )}
              href="/admin/coasters"
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <SlidersHorizontal size={19} aria-hidden="true" />
              Manage coasters
            </Link>
          )}
        </nav>
        <div className="park-sidebar-ticket" aria-hidden="true">
          <Ticket size={26} />
          <strong>Good days have loops.</strong>
          <span>Go find your happy place.</span>
        </div>
        <div className="park-account">
          <span className="avatar" aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <small>{isAdmin ? "Catalogue admin" : "Coaster enthusiast"}</small>
          </div>
          <Button
            variant="ghost"
            className="signout-button"
            aria-label="Sign out"
            title="Sign out"
            busy={busy}
            onClick={signOut}
          >
            <LogOut size={18} />
          </Button>
        </div>
        {error && <Notice>Sign out failed. Please try again.</Notice>}
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        {children}
        <footer className="app-footer">
          <span>One coaster. One credit. Every ride counts.</span>
          <span>SEE YOU IN THE FRONT ROW. ↗</span>
        </footer>
      </main>
    </div>
  );
}
