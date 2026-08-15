import { Skeleton } from "@/components/ui/LoadingState";

export default function GuestLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 md:px-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-4 h-10 w-full max-w-md" />
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
