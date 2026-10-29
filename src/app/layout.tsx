import React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { KitchenProvider } from "@/context/KitchenContext";
import { AppHeaderServer } from "@/components/mobile/app-header-server";
import { NavigationBarServer } from "@/components/mobile/navigation-bar-server";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KitchFlow • Cloud Kitchen Operating System",
  description: "Real-time operating system for multi-brand Indian cloud kitchens",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KitchFlow",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <QueryProvider>
          <KitchenProvider>
            <React.Suspense fallback={<div className="h-14 border-b border-border bg-background" />}>
              <AppHeaderServer />
            </React.Suspense>
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
              {children}
            </main>
            <React.Suspense fallback={null}>
              <NavigationBarServer />
            </React.Suspense>
            <ServiceWorkerRegister />
          </KitchenProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
