"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";

export function ManageBookingForm() {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/book/${encodeURIComponent(reference.trim())}?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <TextField
        label="Booking reference"
        placeholder="KWZ-20260810-7F3K9Q"
        required
        value={reference}
        onChange={(e) => setReference(e.target.value)}
      />
      <TextField
        label="Email used when booking"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" size="lg">
        Find My Booking
      </Button>
    </form>
  );
}
