import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/ui/Icons";
import type { CalendarView, PlanView } from "../itinerary-view";
import SectionCard, { arrowClass } from "./SectionCard";

/** The "Trip plan" list under the month is left out when `plan` is null. */
type Props = { calendar: CalendarView; plan: PlanView | null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** `date` is YYYY-MM-DD. */
type Cell = { day: number; date: string; inMonth: boolean };

/** The month as whole Monday-to-Sunday weeks, padded with the neighbouring months' days. */
function monthCells(year: number, month: number): Cell[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay counts from Sunday; shift it so Monday is 0.
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const trailing = (7 - ((leading + daysInMonth) % 7)) % 7;

  // Date.UTC rolls a day past either end of the month over into the neighbouring one.
  const cell = (dayOfMonth: number): Cell => {
    const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
    return {
      day: date.getUTCDate(),
      date: date.toISOString().slice(0, 10),
      inMonth: dayOfMonth >= 1 && dayOfMonth <= daysInMonth,
    };
  };

  return Array.from({ length: leading + daysInMonth + trailing }, (_, i) => cell(i - leading + 1));
}

export default function TripCalendarCard({ calendar, plan }: Props) {
  const { start, end, today, activityDates } = calendar;
  // The month the trip starts in.
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  const title = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <SectionCard
      title={title}
      aside={
        <div className="flex gap-2.5">
          <button type="button" aria-label="Previous month" disabled className={arrowClass}>
            <ChevronLeftIcon size={15} />
          </button>
          <button type="button" aria-label="Next month" className={arrowClass}>
            <ChevronRightIcon size={15} />
          </button>
        </div>
      }
    >
      <div className="mt-3 grid grid-cols-7 text-center text-xs text-ink-muted">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      <ol className="mt-1 grid grid-cols-7 gap-y-0.5 text-center text-sm font-medium">
        {monthCells(year, month).map(({ day, date, inMonth }, index) => {
          // Marked in the neighbouring months' days too, so a trip into the next month shows where it ends.
          const isEnd = date === start || date === end;
          const inTrip = date > start && date < end;
          const column = index % 7;
          return (
            <li
              key={index}
              className={`relative flex h-9 items-center justify-center ${
                isEnd
                  ? "rounded-xl bg-iris font-bold text-white"
                  : inTrip
                    ? `bg-lavender-soft/70 text-ink ${column === 0 ? "rounded-l-xl" : ""} ${column === 6 ? "rounded-r-xl" : ""}`
                    : inMonth
                      ? "text-ink"
                      : "text-placeholder"
              } ${inMonth && date === today ? "rounded-xl ring-2 ring-iris ring-inset" : ""}`}
            >
              {day}
              {inTrip && activityDates.includes(date) && (
                <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-amber-400" />
              )}
            </li>
          );
        })}
      </ol>

      {plan && (
        <div className="mt-3 border-t border-lavender-soft/70 pt-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-ink">Trip plan</h3>
            <p className="text-xs text-ink-subtle">{plan.summary}</p>
          </div>
          <ul className="mt-2.5 space-y-2 text-sm">
            {plan.days.map((item) => (
              <li key={item.day} className="flex items-center gap-3">
                <span aria-hidden className={`h-4 w-1 rounded-full ${item.color}`} />
                <span className="w-14 font-semibold text-ink">{item.day}</span>
                <span className="truncate text-ink-muted">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
