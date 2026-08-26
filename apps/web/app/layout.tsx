import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@ayon/ui";
import { appConfig } from "@/config/app";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: appConfig.name,
  description: appConfig.description,
  // ★ Achado real (pedido direto do usuário — "eu quero que siga a
  // identidade visual da Ayon, inclusive que tenha a logo"): ícone real da
  // marca (public/icon.png, recortado do brand board enviado).
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={appConfig.locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
