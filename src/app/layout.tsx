import React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { KitchenProvider } from "@/context/KitchenContext";
import { AppHeader } from "@/components/mobile/AppHeader";
import { NavigationBar } from "@/components/mobile/NavigationBar";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { LocalFirstSyncSupervisor } from "@/components/LocalFirstSyncSupervisor";
import { AppContentWrapper } from "@/components/AppContentWrapper";

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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="min-h-screen bg-background text-foreground antialiased font-sans">
        <QueryProvider>
          <KitchenProvider>
            <React.Suspense fallback={<div className="h-14 border-b border-border bg-background" />}>
              <AppHeader />
            </React.Suspense>
            <AppContentWrapper>
              {children}
            </AppContentWrapper>
            <React.Suspense fallback={null}>
              <NavigationBar />
            </React.Suspense>
            <React.Suspense fallback={null}>
              <LocalFirstSyncSupervisor />
            </React.Suspense>
            <ServiceWorkerRegister />
          </KitchenProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
