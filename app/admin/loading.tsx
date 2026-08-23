import { SkeletonBlock } from "@/components/admin/ui";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-8 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-panel border border-border bg-taraWhite p-4">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-panel border border-border bg-taraWhite p-5">
        <SkeletonBlock className="h-4 w-40" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
