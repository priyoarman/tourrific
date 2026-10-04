"use client";

import { HeartIcon } from "@/app/components/ui/Icons";
import { useAccount } from "./AccountProvider";

/** Compact account buttons for the planner pages: saved trips, and Sign In or Log Out. */
export default function AccountControls() {
  const { user, savedFlights, openAuth, openSavedTrips, logOut } = useAccount();
  const pill =
    "rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-white hover:text-ink";

  if (!user) {
    return (
      <button type="button" onClick={() => openAuth()} className={pill}>
        Sign In
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openSavedTrips}
        aria-label={`Saved trips (${savedFlights.length})`}
        className={`flex items-center gap-1.5 ${pill}`}
      >
        <HeartIcon size={16} />
        {savedFlights.length}
      </button>
      <button type="button" onClick={logOut} className={pill}>
        Log Out
      </button>
    </>
  );
}
