import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { KitchenProvider } from "@/context/KitchenContext";
import { AppHeader } from "@/components/mobile/AppHeader";
import { NavigationBar } from "@/components/mobile/NavigationBar";
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
  title: "KitchFlow — Cloud Kitchen Operating System",
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
        <KitchenProvider>
          <AppHeader />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8">
            {children}
          </main>
          <NavigationBar />
          <ServiceWorkerRegister />
        </KitchenProvider>
      </body>
    </html>
  );
}
