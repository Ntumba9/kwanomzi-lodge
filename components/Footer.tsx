import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { business } from "@/lib/content/business";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/book", label: "Book Now" },
  { href: "/manage-booking", label: "Manage Booking" },
];

export function Footer() {
  return (
    <footer className="border-t border-mist-200 bg-ink-950 text-mist-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8">
        <div className="md:col-span-1">
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm italic text-stone-400">{business.tagline}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-100/50">Location &amp; Contact</p>
          <ul className="mt-3 space-y-1.5 text-sm text-mist-100/70">
            <li>{business.address.line1}</li>
            <li>{business.address.line2}</li>
            <li>
              <a href={`tel:${business.phone.replace(/\s+/g, "")}`} className="hover:text-mist-50">
                {business.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${business.email}`} className="hover:text-mist-50">
                {business.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-100/50">Quick Links</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-mist-100/70 hover:text-mist-50">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end md:justify-center">
          <p className="text-sm text-mist-100/70 md:text-right">Ready for a stay at KwaNomzi?</p>
          <Button href="/book" size="md">
            Book Now
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 border-t border-mist-100/10 px-4 py-5 text-center text-xs text-mist-100/50 md:flex-row md:justify-between md:px-8">
        <p>
          © {new Date().getFullYear()} {business.name}. All rights reserved.
        </p>
        <Link href="/staff/login" className="text-mist-100/50 hover:text-mist-100/80">
          Staff Portal
        </Link>
      </div>
    </footer>
  );
}
