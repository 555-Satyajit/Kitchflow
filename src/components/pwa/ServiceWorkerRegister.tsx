'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('KitchFlow PWA service worker registered:', registration.scope)
          })
          .catch((error) => {
            console.error('Service worker registration failed:', error)
          })
      })
    }
  }, [])

  return null
}
