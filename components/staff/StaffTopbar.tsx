import Link from "next/link";
import { signOutAction } from "@/app/staff/actions";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/Badge";
import { hasPermission } from "@/lib/auth/permissions";
import { staffNavLinks } from "./staffNav";

interface StaffTopbarProps {
  userName: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  RECEPTION: "Reception",
  HOUSEKEEPING: "Housekeeping",
  READ_ONLY: "Read Only",
};

export function StaffTopbar({ userName, role }: StaffTopbarProps) {
  const links = staffNavLinks.filter((link) => hasPermission(role, link.permission));

  return (
    <header className="border-b border-mist-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/staff" className="md:hidden">
          <Logo variant="dark" />
        </Link>
        <div className="hidden md:block" />
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-700">{userName}</span>
          <Badge>{ROLE_LABELS[role] ?? role}</Badge>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full border border-mist-200 px-3.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-mist-100"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-mist-200 px-4 py-2 md:hidden">
        {links.map((link) => (
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
