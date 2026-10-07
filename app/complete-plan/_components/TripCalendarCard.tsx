import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/ui/Icons";
import { sampleTrip } from "../sample-trip";
import SectionCard, { arrowClass } from "./SectionCard";

type Props = { calendar: typeof sampleTrip.calendar; plan: typeof sampleTrip.plan };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Cell = { day: number; inMonth: boolean };

/** The month as whole Monday-to-Sunday weeks, padded with the neighbouring months' days. */
function monthCells(year: number, month: number): Cell[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysInPrevious = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  // getUTCDay counts from Sunday; shift it so Monday is 0.
  const leading = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const trailing = (7 - ((leading + daysInMonth) % 7)) % 7;

  return [
    ...Array.from({ length: leading }, (_, i) => ({ day: daysInPrevious - leading + i + 1, inMonth: false })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, inMonth: true })),
    ...Array.from({ length: trailing }, (_, i) => ({ day: i + 1, inMonth: false })),
  ];
}

export default function TripCalendarCard({ calendar, plan }: Props) {
  const { year, month, today, tripStart, tripEnd, activityDays } = calendar;
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
        {monthCells(year, month).map(({ day, inMonth }, index) => {
          const isEnd = inMonth && (day === tripStart || day === tripEnd);
          const inTrip = inMonth && day > tripStart && day < tripEnd;
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
              } ${inMonth && day === today ? "rounded-xl ring-2 ring-iris ring-inset" : ""}`}
            >
              {day}
              {inTrip && activityDays.includes(day) && (
                <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-amber-400" />
              )}
            </li>
          );
        })}
      </ol>

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
    </SectionCard>
  );
}
