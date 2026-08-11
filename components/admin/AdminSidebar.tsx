import Link from "next/link";
import { Logo } from "@/components/Logo";
import { adminNavLinks } from "./adminNav";

export function AdminSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-mist-200 bg-white px-4 py-6 md:flex">
      <Link href="/admin" className="mb-8 px-2">
        <Logo variant="dark" />
      </Link>
      <nav className="flex flex-col gap-1">
        {adminNavLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-mist-100 hover:text-ink-900"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
