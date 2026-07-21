export default function Loading() {
  return (
    <div className="min-h-[70vh]" role="status" aria-label="Loading page">
      <div className="border-border relative overflow-hidden border-b">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto flex max-w-3xl animate-pulse flex-col items-center gap-5">
            <div className="bg-muted h-7 w-28 rounded-full" />
            <div className="bg-muted h-12 w-full max-w-2xl rounded-2xl" />
            <div className="bg-muted h-6 w-full max-w-xl rounded-xl" />
          </div>
        </div>
      </div>
      <div className="container-page py-16 sm:py-20">
        <div className="grid animate-pulse gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="border-border rounded-2xl border p-6">
              <div className="bg-muted size-11 rounded-xl" />
              <div className="bg-muted mt-5 h-6 w-2/3 rounded-lg" />
              <div className="bg-muted mt-3 h-4 w-full rounded" />
              <div className="bg-muted mt-2 h-4 w-4/5 rounded" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
