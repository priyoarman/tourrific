import { useId } from "react";
import type { Scene } from "../sample-trip";

type Props = { scene: Scene; className?: string };

/** Flat illustrations standing in for trip photos until real imagery is wired up. */
export default function SceneArt({ scene, className = "" }: Props) {
  const id = useId();
  const sky = `${id}-sky`;
  const sea = `${id}-sea`;
  const skyStops = SKIES[scene];

  return (
    <svg
      viewBox={scene === "island" ? "0 0 240 100" : "0 0 240 200"}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={`block size-full ${className}`}
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyStops[0]} />
          <stop offset="1" stopColor={skyStops[1]} />
        </linearGradient>
        <linearGradient id={sea} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fb6d3" />
          <stop offset="1" stopColor="#1b7fb8" />
        </linearGradient>
      </defs>
      <rect width="240" height="200" fill={`url(#${sky})`} />

      {scene === "island" && (
        <>
          <circle cx="197" cy="30" r="19" fill="#fde68a" opacity="0.5" />
          <circle cx="197" cy="30" r="13" fill="#fbbf24" />
          <path d="M-10 70c40-18 110-22 170-12 34 5 60 6 90 3v20H-10z" fill="#f1dcae" />
          <g fill="#fff">
            <rect x="36" y="50" width="12" height="14" rx="1" />
            <rect x="49" y="43" width="12" height="21" rx="1" />
            <rect x="62" y="52" width="14" height="12" rx="1" />
            <rect x="118" y="54" width="12" height="10" rx="1" />
            <rect x="131" y="50" width="13" height="14" rx="1" />
            <rect x="145" y="56" width="11" height="8" rx="1" />
          </g>
          <path d="M48.5 44a6.5 6.5 0 0 1 13 0z" fill="#3b5bdb" />
          <rect x="53.5" y="50" width="3" height="7" rx="1.5" fill="#3b5bdb" />
          <rect y="64" width="240" height="140" fill={`url(#${sea})`} />
          <path d="M94 80h14l-2.5 4h-9zM101 68v10h-6zM102.5 71v7h4.5z" fill="#fff" />
          <path d="M22 76h22M150 84h26M52 90h18" stroke="#fff" strokeLinecap="round" opacity="0.7" />
        </>
      )}

      {scene === "temple" && (
        <>
          <circle cx="186" cy="52" r="20" fill="#fcd34d" opacity="0.9" />
          <g fill="#fff">
            <path d="M120 44 62 68h116z" />
            <rect x="62" y="72" width="116" height="7" rx="2" />
            <rect x="68" y="83" width="10" height="56" rx="2" />
            <rect x="92" y="83" width="10" height="56" rx="2" />
            <rect x="115" y="83" width="10" height="56" rx="2" />
            <rect x="138" y="83" width="10" height="56" rx="2" />
            <rect x="162" y="83" width="10" height="56" rx="2" />
            <rect x="56" y="141" width="128" height="8" rx="2" />
          </g>
          <rect y="158" width="240" height="42" fill={`url(#${sea})`} />
        </>
      )}

      {scene === "lake" && (
        <>
          <path d="M-10 132c30-36 86-36 124-2z" fill="#6f9e63" />
          <path d="M96 132c34-40 110-44 154-6v8z" fill="#86ad6c" />
          <rect y="130" width="240" height="70" fill="#37b3c4" />
        </>
      )}

      {scene === "beach" && (
        <>
          <circle cx="182" cy="56" r="22" fill="#fbbf24" />
          <rect y="98" width="240" height="60" fill={`url(#${sea})`} />
          <path d="M-10 200v-44c50-22 110-26 170-12 34 8 60 8 90 2v54z" fill="#f1dcae" />
        </>
      )}

      {(scene === "lake" || scene === "beach") && (
        <path
          d="M44 122h76"
          transform={scene === "lake" ? "translate(20 36)" : undefined}
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />
      )}
    </svg>
  );
}

const SKIES: Record<Scene, [string, string]> = {
  island: ["#7cc4f5", "#d9eefc"],
  temple: ["#f9a67a", "#f48fa3"],
  lake: ["#7fd0c6", "#4aa9b4"],
  beach: ["#8ec5f2", "#d4e9f3"],
};
