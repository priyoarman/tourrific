import type { RoadTripStop } from "@/app/lib/types";

// A stylised map: stops are projected from their real coordinates onto the
// canvas, so it can be swapped for a tile map (Leaflet, Mapbox) later.

const W = 400;
const H = 250;
const PAD = 40;

type Point = { x: number; y: number };

function project(stops: RoadTripStop[]): Point[] {
  // Shrink longitude by latitude so the shape isn't stretched sideways.
  const meanLat = stops.reduce((sum, s) => sum + s.lat, 0) / stops.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);
  const xs = stops.map((s) => s.lng * kx);
  const ys = stops.map((s) => -s.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const dx = Math.max(...xs) - minX || 1;
  const dy = Math.max(...ys) - minY || 1;
  const scale = Math.min((W - PAD * 2) / dx, (H - PAD * 2) / dy);
  const offsetX = (W - dx * scale) / 2;
  const offsetY = (H - dy * scale) / 2;
  return xs.map((x, i) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (ys[i] - minY) * scale }));
}

/** Catmull-Rom spline through the stops, so the road curves instead of zig-zagging. */
function roadPath(points: Point[]) {
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

type Props = {
  stops: RoadTripStop[];
  activeId: string;
  onSelect: (stopId: string) => void;
};

export default function RouteMap({ stops, activeId, onSelect }: Props) {
  const points = project(stops);
  const path = roadPath(points);

  return (
    <div className="relative aspect-8/5 overflow-hidden rounded-3xl border border-lavender-soft/70 bg-[#f4f1fb] shadow-[0_10px_30px_-18px_rgba(42,27,61,0.35)]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <pattern id="map-grid" width="25" height="25" patternUnits="userSpaceOnUse">
            <path d="M25 0H0V25" fill="none" stroke="#e4def5" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#map-grid)" />

        {/* Decorative terrain: water, parks and contour lines. */}
        <path d="M-10 190 C60 170 90 230 170 215 S300 250 410 205 V260 H-10Z" fill="#dbe9f8" />
        <ellipse cx="320" cy="60" rx="70" ry="42" fill="#dff0e0" />
        <ellipse cx="70" cy="70" rx="55" ry="34" fill="#e3f1df" />
        <g fill="none" stroke="#e2dcf3" strokeWidth="0.8">
          <ellipse cx="225" cy="110" rx="60" ry="32" />
          <ellipse cx="225" cy="110" rx="38" ry="19" />
          <ellipse cx="225" cy="110" rx="17" ry="8" />
        </g>

        {/* The road: a soft casing, the lavender surface and a dashed centre line. */}
        <path d={path} fill="none" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#a78bf3" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="4 5" strokeLinecap="round" />
      </svg>

      <ol aria-label="Stops on the map">
        {stops.map((stop, i) => {
          const { x, y } = points[i];
          const active = stop.id === activeId;
          const labelLeft = x > W * 0.62;
          return (
            <li
              key={stop.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${active ? "z-10" : ""}`}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
            >
              <button
                type="button"
                onClick={() => onSelect(stop.id)}
                aria-pressed={active}
                aria-label={`Stop ${i + 1}: ${stop.city}`}
                className={`flex size-8 items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-md transition-transform hover:scale-110 ${
                  active ? "scale-110 bg-lavender text-ink ring-4 ring-lavender/30" : "bg-ink text-white"
                }`}
              >
                {i + 1}
              </button>
              <span
                aria-hidden
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap shadow-sm ${
                  labelLeft ? "right-full mr-1.5" : "left-full ml-1.5"
                } ${active ? "bg-ink text-white" : "bg-white/90 text-ink"}`}
              >
                {stop.city}
              </span>
            </li>
          );
        })}
      </ol>

      <span
        aria-hidden
        className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-ink shadow-sm"
      >
        N
      </span>
    </div>
  );
}
