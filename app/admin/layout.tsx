import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

/**
 * proxy.ts already redirects unauthenticated requests to /admin/login before
 * this layout ever renders. The session read here is for display (who's
 * logged in) and as defense-in-depth, not the primary access control.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  // The login page itself renders under this same route group but has no
  // session and shouldn't get the dashboard chrome.
  if (!session?.user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-mist-50">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar userName={session.user.name ?? session.user.email ?? "Admin"} />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
