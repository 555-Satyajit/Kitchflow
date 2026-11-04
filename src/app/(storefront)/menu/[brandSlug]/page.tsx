import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getStorefrontBrandAndMenu } from '@/features/storefront/storefront-queries'
import { StorefrontClientView } from '@/features/storefront/components/storefront-client-view'
import { StorefrontSkeleton } from '@/features/storefront/components/skeletons/storefront-skeleton'

interface StorefrontPageProps {
  params: Promise<{
    brandSlug: string
  }>
  searchParams: Promise<{
    table?: string
  }>
}

export default async function StorefrontPage({
  params,
  searchParams,
}: StorefrontPageProps) {
  const { brandSlug } = await params
  const { table } = await searchParams

  const data = await getStorefrontBrandAndMenu(brandSlug)

  if (!data) {
    return notFound()
  }

  return (
    <Suspense fallback={<StorefrontSkeleton />}>
      <StorefrontClientView
        brand={data.brand}
        dishes={data.dishes}
        initialTable={table}
      />
    </Suspense>
  )
}

