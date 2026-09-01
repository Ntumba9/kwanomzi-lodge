import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { business } from "@/lib/content/business";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // 700 added for the hero/brand typography treatment — see the hero <h1>
  // and Logo's "header" size in app/(guest)/page.tsx / components/Logo.tsx.
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Falls back to localhost in dev; NEXT_PUBLIC_APP_URL is already the same
// env var the Yoco checkout flow uses for its own redirect URLs, so this
// follows suit rather than introducing a second source of truth for the
// site's canonical origin.
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const description =
  "Boutique accommodation in KwaBushula, Lusikisiki. Considered comfort and genuine South African hospitality — check availability and book your stay directly.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${business.name} — Boutique Accommodation in Lusikisiki`,
    template: `%s — ${business.name}`,
  },
  description,
  keywords: ["KwaNomzi", "boutique lodge", "Lusikisiki accommodation", "Eastern Cape guest house", "KwaBushula"],
  openGraph: {
    title: `${business.name} — Boutique Accommodation in Lusikisiki`,
    description,
    url: siteUrl,
    siteName: business.name,
    images: [{ url: "/images/rooms/Deluxe king Room.png", width: 1600, height: 1067, alt: "A room at " + business.name }],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${business.name} — Boutique Accommodation in Lusikisiki`,
    description,
    images: ["/images/rooms/Deluxe king Room.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b0c0e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
