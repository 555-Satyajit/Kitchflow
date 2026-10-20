'use client'

import React from 'react'
import { PackingView } from '@/components/packing/PackingView'
import { useKitchen } from '@/context/KitchenContext'

export default function PackingPage() {
  const { orders, handleToggleChecklistItem, handleCompletePacking } = useKitchen()

  return (
    <PackingView
      orders={orders}
      onToggleChecklistItem={handleToggleChecklistItem}
      onCompletePacking={handleCompletePacking}
    />
  )
}
