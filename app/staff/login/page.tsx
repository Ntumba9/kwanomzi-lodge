import { Card, CardBody } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import { PlaceholderImage } from "@/components/ui/PlaceholderImage";
import { business } from "@/lib/content/business";
import { siteImages } from "@/lib/content/images";
import { StaffLoginForm } from "./StaffLoginForm";

export default function StaffLoginPage() {
  return (
    <div className="flex min-h-screen">
      <section className="relative hidden w-1/2 shrink-0 overflow-hidden bg-ink-950 lg:flex lg:items-end">
        <PlaceholderImage label={siteImages.hero.alt} src={siteImages.hero.src} showLabel={false} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-950/40 to-transparent" />
        <div className="relative px-10 pb-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-lagoon-300">Staff Portal</p>
          <h1 className="mt-4 max-w-sm font-display text-3xl leading-tight text-mist-50">{business.tagline}</h1>
          <p className="mt-4 max-w-sm text-sm text-mist-100/80">
            Manage bookings, rooms and guests for {business.name}.
          </p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-mist-100 px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo variant="dark" />
            <p className="mt-3 text-sm text-ink-700/70">Staff sign in</p>
          </div>
          <Card>
            <CardBody className="py-8">
              <StaffLoginForm />
            </CardBody>
          </Card>
          <p className="mt-6 text-center text-xs text-ink-700/50">
            Authorized lodge staff only. Contact management if you need access.
          </p>
        </div>
      </section>
    </div>
  );
}
