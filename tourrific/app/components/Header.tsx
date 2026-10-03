import Link from "next/link";
import Logo from "./ui/Logo";

const navLinks = [
  { label: "Destinations", href: "#destinations" },
  { label: "Occasions", href: "#trips" },
  { label: "Sign In", href: "#" },
];

export default function Header() {
  return (
    <header className="mx-auto flex w-full max-w-360 items-center justify-between px-4 py-6 sm:px-10 lg:px-16">
      <Logo />

      <nav className="flex items-center gap-4 sm:gap-10">
        <ul className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-lg font-medium text-ink transition-colors hover:text-lavender"
              >
                {link.label}
              </Link>
            </li>
          ))}
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

        <button
          type="button"
          aria-label="Account"
          className="size-12 rounded-full border-2 border-lavender/70 bg-white/80 transition-colors hover:border-lavender"
        />
      </nav>
    </header>
  );
}
