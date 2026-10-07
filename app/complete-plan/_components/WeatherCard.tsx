import { CloudRainIcon, CloudSunIcon, RefreshIcon, SunIcon } from "@/app/components/ui/Icons";
import type { Forecast } from "../sample-trip";
import SectionCard from "./SectionCard";

type Props = { summary: string; days: Forecast[] };

const SKY: Record<Forecast["sky"], React.ReactNode> = {
  sun: <SunIcon size={22} className="text-amber-400" />,
  "cloud-sun": <CloudSunIcon size={22} className="text-iris" />,
  rain: <CloudRainIcon size={22} className="text-iris" />,
};

export default function WeatherCard({ summary, days }: Props) {
  return (
    <SectionCard
      title="Weather"
      badge={<span className="self-end pb-0.5 text-xs text-ink-muted">{summary}</span>}
      aside={
        <button type="button" className="flex items-center gap-1.5 transition-colors hover:text-ink">
          <RefreshIcon size={13} />
          Refresh
        </button>
      }
    >
      <ul className="mt-3 grid grid-cols-5 gap-1 text-center">
        {days.map((day, index) => (
          // The first day is the one in focus until picking a day does something.
          <li key={day.day} className={`rounded-2xl px-1 py-2.5 ${index === 0 ? "bg-lavender-soft" : ""}`}>
            <p className="text-xs text-ink-muted">{day.day}</p>
            <div className="mt-1.5 flex justify-center">{SKY[day.sky]}</div>
            <p className="mt-1.5 text-sm font-bold text-ink">
              {day.high}° <span className="text-[0.65rem] font-normal text-ink-subtle">{day.low}°</span>
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
