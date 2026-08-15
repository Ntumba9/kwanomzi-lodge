import type { ReactNode } from "react";
import { auth } from "@/auth";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { StaffTopbar } from "@/components/staff/StaffTopbar";

/**
 * proxy.ts already redirects unauthenticated requests to /staff/login before
 * this layout ever renders. The session read here is for display (who's
 * logged in) and as defense-in-depth, not the primary access control.
 */
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // The login page itself renders under this same route group but has no
  // session and shouldn't get the dashboard chrome.
  if (!session?.user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-mist-50">
      <StaffSidebar role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffTopbar userName={session.user.name ?? session.user.email ?? "Staff"} role={session.user.role} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
