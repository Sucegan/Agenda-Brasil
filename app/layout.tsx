import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";
import { InstallApp } from "@/components/install-app";
import { WebVitals } from "@/components/web-vitals";
import { NetworkStatus } from "@/components/network-status";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Agenda Brasil | Agendamentos Online",
  description: "Agendamentos online simples e profissionais, com agenda, lembretes, fila de espera e gestão para barbearias.",
  keywords: ["agendamento online", "agenda para barbearia", "barbearia", "reservas online", "Agenda Brasil"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  applicationName: "Agenda Brasil",
  category: "business",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Agenda Brasil",
    title: "Agenda Brasil | Agendamentos Online",
    description: "Agendamentos online, simples e profissionais.",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Agenda Brasil — agendamentos online, simples e profissionais" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agenda Brasil | Agendamentos Online",
    description: "Agendamentos online, simples e profissionais.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
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
