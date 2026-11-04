import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Dining & Ordering",
  description: "Browse menu, deals and order online",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FAFAF9",
};

export default function StorefrontRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#FAFAF9] text-[#1C1917] antialiased selection:bg-[#E11D48] selection:text-white font-sans">
      {children}
    </div>
  );
}
