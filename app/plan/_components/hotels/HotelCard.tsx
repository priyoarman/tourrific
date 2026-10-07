import { MapPinIcon } from "@/app/components/ui/Icons";
import SelectButton from "@/app/components/ui/SelectButton";
import { formatNights, formatPrice } from "@/app/lib/format";
import type { Hotel } from "@/app/lib/types";
import ReviewScore from "./ReviewScore";
import StarRating from "./StarRating";

type Props = {
  hotel: Hotel;
  nights: number;
  selected: boolean;
  onSelect: () => void;
};

export default function HotelCard({ hotel, nights, selected, onSelect }: Props) {
  const distance = hotel.distanceKm === null ? "" : `${hotel.distanceKm} km from centre`;
  const location = [hotel.area, distance].filter(Boolean).join(" · ");

  return (
    <li
      className={`overflow-hidden rounded-3xl border bg-white shadow-[0_10px_30px_-18px_rgba(42,27,61,0.35)] transition-colors ${
        selected ? "border-lavender ring-2 ring-lavender/40" : "border-lavender-soft/70"
      }`}
    >
      {/* Placeholder artwork until real hotel photos are available. */}
      <div className={`relative h-40 bg-linear-to-br ${hotel.gradient}`}>
        {hotel.rating !== null && (
          <div className="absolute top-3 left-3">
            <ReviewScore rating={hotel.rating} reviewCount={hotel.reviewCount} />
          </div>
        )}
        {hotel.freeCancellation && (
          <span className="absolute right-3 bottom-3 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            Free cancellation
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-ink">{hotel.name}</h3>
            {hotel.stars !== null && (
              <div className="mt-1 flex items-center gap-2">
                <StarRating stars={hotel.stars} />
              </div>
            )}
            {location && (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-ink-muted">
                <MapPinIcon size={15} />
                {location}
              </p>
            )}
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-2xl font-bold text-ink">{formatPrice(hotel.nightlyPrice)}</span>
            <span className="text-xs text-ink-muted">per night</span>
          </p>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <ul className="flex flex-wrap gap-1.5">
            {hotel.amenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full bg-lavender-soft/50 px-2.5 py-1 text-xs font-medium text-ink"
              >
                {amenity}
              </li>
            ))}
          </ul>
          <p className="shrink-0 text-xs text-ink-muted">
            {formatPrice(hotel.nightlyPrice * nights)} for {formatNights(nights)}
          </p>
        </div>

        <div className="mt-4">
          <SelectButton selected={selected} onClick={onSelect} label={`${hotel.name}, ${formatPrice(hotel.nightlyPrice)} per night`} />
        </div>
      </div>
    </li>
  );
}
