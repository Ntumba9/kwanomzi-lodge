"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/manage-booking", label: "Manage Booking" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-mist-200"
      >
        <MenuIcon open={open} />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-t border-mist-200 bg-mist-50 px-4 py-4 shadow-lg">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-800 hover:bg-mist-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <Button href="/book" size="md" className="mt-3 w-full" onClick={() => setOpen(false)}>
            Book Now
          </Button>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
