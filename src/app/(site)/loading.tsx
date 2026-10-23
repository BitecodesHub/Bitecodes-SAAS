export default function Loading() {
  return (
    <div className="min-h-[70vh]" role="status" aria-label="Loading page">
      <div className="relative overflow-hidden">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto flex max-w-3xl animate-pulse flex-col items-center gap-5">
            <div className="bg-surface-2 h-7 w-28 rounded-full" />
            <div className="bg-surface-2 h-12 w-full max-w-2xl rounded-2xl" />
            <div className="bg-surface-2 h-6 w-full max-w-xl rounded-[14px]" />
          </div>
        </div>
      </div>
      <div className="container-page py-16 sm:py-20">
        <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="bg-surface-2 rounded-[24px] p-6">
              <div className="bg-background/80 size-11 rounded-[14px]" />
              <div className="bg-background/80 mt-5 h-6 w-2/3 rounded-[10px]" />
              <div className="bg-background/80 mt-3 h-4 w-full rounded-full" />
              <div className="bg-background/80 mt-2 h-4 w-4/5 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
