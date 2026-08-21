import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: "Agenda Brasil | Agendamentos Online",
  description: "Sistema de agendamento de horários para barbearias e clientes.",
  icons: {
    icon: "/favicon.ico", 
  },
  applicationName: "Agenda Brasil",
  appleWebApp: {
    capable: true,
    title: "Agenda Brasil",
    statusBarStyle: "black-translucent",
  },
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
        {children}
      </body>
    </html>
  );
}
