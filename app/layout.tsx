import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";
import { InstallApp } from "@/components/install-app";
import { WebVitals } from "@/components/web-vitals";
import { NetworkStatus } from "@/components/network-status";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Agenda Brasil | Agendamentos Online",
  description: "Sistema de agendamento de horários para barbearias e clientes.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  applicationName: "Agenda Brasil",
  alternates: { canonical: "/" },
  appleWebApp: {
    capable: true,
    title: "Agenda Brasil",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        <WebVitals />
        <InstallApp />
        <NetworkStatus />
        {children}
      </body>
    </html>
  );
}
