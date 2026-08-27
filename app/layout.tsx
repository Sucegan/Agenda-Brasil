import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WebModeCleanup } from "./web-mode-cleanup";
import { WebVitals } from "@/components/web-vitals";
import { NetworkStatus } from "@/components/network-status";
import { PlatformNotice } from "@/components/platform-notice";
import { COPYRIGHT_NOTICE, RIGHTS_HOLDER } from "@/components/site-rights";
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenda-brasil.vercel.app"),
  title: "Agenda Brasil | Agendamentos Online",
  description: "Agendamentos online simples e profissionais, com agenda, lembretes, fila de espera e gestão para barbearias.",
  keywords: ["agendamento online", "agenda para barbearia", "barbearia", "reservas online", "Agenda Brasil"],
  authors: [{ name: RIGHTS_HOLDER }],
  creator: RIGHTS_HOLDER,
  publisher: RIGHTS_HOLDER,
  other: { copyright: COPYRIGHT_NOTICE },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
        <WebModeCleanup />
        <WebVitals />
        <NetworkStatus />
        <PlatformNotice />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
