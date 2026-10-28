"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount } from "@/app/components/account/AccountProvider";
import { BookmarkIcon, CheckIcon } from "@/app/components/ui/Icons";
import { ApiError } from "@/app/lib/api";
import { saveTrip } from "@/app/lib/trips";

type Props = {
  tripId: string;
  saved: boolean;
};

const buttonClass =
  "flex w-full items-center justify-center gap-2.5 rounded-full py-4 text-sm font-semibold transition-colors";

export default function SaveTripButton({ tripId, saved: savedBefore }: Props) {
  const { requireSignIn } = useAccount();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">(savedBefore ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!(await requireSignIn("Sign in to save this trip."))) return;

    setStatus("saving");
    try {
      await saveTrip(tripId);
      setStatus("saved");
      router.refresh();
    } catch (reason) {
      setStatus("idle");
      if (reason instanceof ApiError && reason.status === 401) {
        setError("Your session has expired. Please sign in and try again.");
      } else {
        setError(reason instanceof Error ? reason.message : "Couldn't save your trip. Please try again.");
      }
    }
  }

  if (status === "saved") {
    return (
      <p className={`${buttonClass} bg-emerald-100 text-emerald-800`}>
        <CheckIcon size={16} />
        Saved to your trips
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={save}
        disabled={status === "saving"}
        aria-describedby={error ? "save-trip-error" : undefined}
        className={`${buttonClass} bg-iris text-white hover:bg-iris/90 disabled:bg-iris/70`}
      >
        <BookmarkIcon size={16} />
        {status === "saving" ? "Saving…" : "Save trip"}
      </button>
      {error && (
        <p id="save-trip-error" role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
