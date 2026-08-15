export function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mist-200 bg-mist-50 px-6 py-16 text-center">
      <p className="font-display text-lg text-ink-900">You don&rsquo;t have access to this page</p>
      <p className="max-w-sm text-sm text-ink-700/70">
        Your role doesn&rsquo;t include this area of the staff portal. Contact an owner or manager if you believe this
        is wrong.
      </p>
    </div>
  );
}
