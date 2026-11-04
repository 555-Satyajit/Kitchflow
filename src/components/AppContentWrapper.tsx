'use client'

import { usePathname } from 'next/navigation'

export function AppContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMenuRoute = pathname?.startsWith('/menu')

  if (isMenuRoute) {
    return <main className="min-h-screen w-full bg-stone-50 dark:bg-stone-950 p-0 m-0">{children}</main>
  }

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
      {children}
    </main>
  )
}

