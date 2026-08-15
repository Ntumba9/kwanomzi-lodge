"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/staff/actions";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/permissions";
import { staffNavLinks } from "./staffNav";

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/staff") return pathname === "/staff";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StaffSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const links = staffNavLinks.filter((link) => hasPermission(role, link.permission));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-mist-200 bg-white px-4 py-6 md:flex">
      <Link href="/staff" className="mb-8 px-2">
        <Logo variant="dark" />
      </Link>
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-ink-700/50">Staff Portal</p>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active = isActiveLink(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-lagoon-600 text-mist-50" : "text-ink-700 hover:bg-mist-100 hover:text-ink-900",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOutAction} className="border-t border-mist-200 pt-3">
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-700 transition-colors hover:bg-mist-100 hover:text-ink-900"
        >
          Log out
        </button>
      </form>
    </aside>
  );
}
