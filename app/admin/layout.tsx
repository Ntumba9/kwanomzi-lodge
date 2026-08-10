import type { ReactNode } from "react";

// Placeholder admin shell. Auth-gating and real navigation are added in
// Phase 3 (authentication) and Phase 4 (admin dashboard foundation).
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header>
        <strong>KwaNomzi Admin</strong>
      </header>
      {children}
    </div>
  );
}
