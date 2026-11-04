import { Skeleton } from '@/components/ui/skeleton'

export function StorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-stone-50/50 dark:bg-stone-950/50 flex flex-col max-w-md mx-auto pb-24 animate-pulse">
      {/* Brand Hero Skeleton */}
      <div className="p-4 space-y-3 pt-6 bg-white/70 dark:bg-stone-900/70 border-b border-border/40">
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-3.5 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </div>

      {/* Sticky Categories Skeleton */}
      <div className="p-3 flex gap-2 border-b border-border/30 bg-background/60">
        <Skeleton className="h-8 w-24 rounded-full shrink-0" />
        <Skeleton className="h-8 w-28 rounded-full shrink-0" />
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        <Skeleton className="h-8 w-32 rounded-full shrink-0" />
      </div>

      {/* Dish List Skeletons */}
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800/60 flex items-center justify-between gap-3 shadow-2xs"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3.5 h-3.5 rounded-xs" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
              <Skeleton className="h-3 w-48 rounded-xs" />
              <Skeleton className="h-4 w-16 rounded-md pt-1" />
            </div>
            <Skeleton className="w-18 h-18 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

