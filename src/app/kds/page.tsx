'use client'

import React from 'react'
import { KDSView } from '@/components/kds/KDSView'
import { useKitchen } from '@/context/KitchenContext'

export default function KDSPage() {
  const { orders, handleToggleStationItem, handleMarkOrderReady, userRole } = useKitchen()

  return (
    <KDSView
      orders={orders}
      onToggleStationItem={handleToggleStationItem}
      onMarkOrderReady={handleMarkOrderReady}
      userRole={userRole}
    />
  )
}
