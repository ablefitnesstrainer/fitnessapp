import "./globals.css";
import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Able Fitness Coaching App",
  description: "Fitness coaching platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Able Fitness"
  },
  icons: {
    icon: "/able-logo-official.png",
    shortcut: "/able-logo-official.png",
    apple: "/able-logo-official.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#0f6adf"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
