"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export interface RoomImageSummary {
  id: number;
  url: string;
  altText: string | null;
  isPrimary: boolean;
}

/**
 * Real photo management for a room type — upload posts an actual file to
 * POST /api/staff/rooms/images (backed by Vercel Blob, see that route's
 * doc comment), never just adds a local object URL to component state.
 * router.refresh() re-fetches the server component's data after every
 * mutation so what's shown here always reflects the database, not
 * optimistic-only client state.
 */
export function RoomImageManager({ roomTypeId, images }: { roomTypeId: number; images: RoomImageSummary[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyImageId, setBusyImageId] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("roomTypeId", String(roomTypeId));
      formData.set("file", file);
      const res = await fetch("/api/staff/rooms/images", { method: "POST", body: formData });
      const body = (await res.json()) as { data?: unknown; error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Upload failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(imageId: number) {
    setError(null);
    setBusyImageId(imageId);
    try {
      const res = await fetch(`/api/staff/rooms/images?imageId=${imageId}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not remove the image.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the image.");
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleSetPrimary(imageId: number) {
    setError(null);
    setBusyImageId(imageId);
    try {
      const res = await fetch("/api/staff/rooms/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not set as primary.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set as primary.");
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/60">Photos</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((image) => (
            <div key={image.id} className="relative w-28 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are arbitrary external hosts, not worth next/image's static config here */}
              <img
                src={image.url}
                alt={image.altText ?? ""}
                className={`h-20 w-28 rounded-lg border object-cover ${image.isPrimary ? "border-lagoon-600" : "border-mist-200"}`}
              />
              {image.isPrimary && (
                <span className="absolute left-1 top-1 rounded bg-lagoon-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Primary
                </span>
              )}
              <div className="mt-1 flex items-center justify-between gap-1">
                {!image.isPrimary && (
                  <button
                    type="button"
                    disabled={busyImageId === image.id || isPending}
                    onClick={() => startTransition(() => handleSetPrimary(image.id))}
                    className="text-[11px] text-lagoon-600 hover:underline disabled:opacity-50"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyImageId === image.id || isPending}
                  onClick={() => startTransition(() => handleDelete(image.id))}
                  className="ml-auto text-[11px] text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id={`room-image-upload-${roomTypeId}`}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload photo"}
        </Button>
      </div>
    </div>
  );
}
