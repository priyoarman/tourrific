"use client";

import Link from "next/link";
import { useAccount } from "./account/AccountProvider";
import { UserIcon } from "./ui/Icons";
import Logo from "./ui/Logo";

const navLinks = [
  { label: "Destinations", href: "#destinations" },
  { label: "Occasions", href: "#trips" },
];

const navItemClass = "text-lg font-medium text-ink transition-colors hover:text-lavender";

export default function Header() {
  const { user, savedFlights, openAuth, openSavedTrips, logOut } = useAccount();
  const initial = (user?.name || user?.email || "").trim().charAt(0).toUpperCase();

  return (
    <header className="mx-auto flex w-full max-w-360 items-center justify-between px-5 py-5 sm:px-10 sm:py-6 lg:px-16">
      <Logo />

      <nav className="flex items-center gap-4 sm:gap-10">
        <ul className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link href={link.href} className={navItemClass}>
                {link.label}
              </Link>
            </li>
          ))}
          {user && (
            <li>
              <button type="button" onClick={openSavedTrips} className={navItemClass}>
                Saved trips
                {savedFlights.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-lavender-soft px-2 py-0.5 text-sm font-semibold">
                    {savedFlights.length}
                  </span>
                )}
              </button>
            </li>
          )}
          <li>
            {user ? (
              <button type="button" onClick={logOut} className={navItemClass}>
                Log Out
              </button>
            ) : (
              <button type="button" onClick={() => openAuth()} className={navItemClass}>
                Sign In
              </button>
            )}
          </li>
        </ul>

        <div className="hidden items-center gap-1 rounded-xl border border-lavender-soft bg-white/80 px-2 py-2.5 text-base font-medium text-ink sm:flex">
          {["kr", "EN", "°C"].map((option) => (
            <button
              key={option}
              type="button"
              className="rounded-lg px-2.5 transition-colors hover:text-lavender"
            >
              {option}
            </button>
          ))}
        </div>

        {/* The one account control that is also visible on phones, where the links above are hidden. */}
        <button
          type="button"
          onClick={user ? openSavedTrips : () => openAuth()}
          aria-label={user ? "Your saved trips and account" : "Sign in"}
          className={`flex size-11 items-center justify-center rounded-full border-2 text-lg font-bold text-ink transition-colors hover:border-lavender sm:size-12 ${
            user ? "border-lavender bg-lavender-soft" : "border-lavender/70 bg-white/80"
          }`}
        >
          {initial || <UserIcon size={22} />}
        </button>
      </nav>
    </header>
  );
}
