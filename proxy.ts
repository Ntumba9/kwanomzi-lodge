import { auth } from "@/auth";

/**
 * Next.js 16 renamed the middleware/interception file convention from
 * middleware.ts to proxy.ts (function renamed middleware -> proxy) — the
 * function signature Next invokes is unchanged, only the file/export name.
 * Auth.js's `auth()` wrapper still works here for exactly that reason.
 */
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/staff/login";

  if (!isLoginPage && !req.auth) {
    const loginUrl = new URL("/staff/login", req.nextUrl.origin);
    loginUrl.searchParams.set("from", pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/staff/:path*"],
};
