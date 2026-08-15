import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/Button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/manage-booking", label: "Manage Booking" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-mist-200/80 bg-mist-50/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="shrink-0">
          <Logo variant="dark" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-ink-700 hover:text-ink-900">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button href="/staff/login" size="md" variant="secondary">
            Staff Portal
          </Button>
          <Button href="/book" size="md">
            Book Now
          </Button>
        </div>

        <MobileNav />
      </div>
    </header>
  );
}
