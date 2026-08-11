import Link from "next/link";
import { signOutAction } from "@/app/admin/actions";
import { Logo } from "@/components/Logo";
import { adminNavLinks } from "./adminNav";

interface AdminTopbarProps {
  userName: string;
}

export function AdminTopbar({ userName }: AdminTopbarProps) {
  return (
    <header className="border-b border-mist-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/admin" className="md:hidden">
          <Logo variant="dark" />
        </Link>
        <div className="hidden md:block" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink-700">{userName}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full border border-mist-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-mist-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-mist-200 px-4 py-2 md:hidden">
        {adminNavLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-mist-100"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
