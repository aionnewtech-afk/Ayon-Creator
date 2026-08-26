"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

/**
 * ★ Achado real (pedido direto do usuário — "eu quero que siga a identidade
 * visual da Ayon"): a marca é dark-first (fundo preto, dourado/prata
 * metálico) — `defaultTheme="dark"` é a experiência principal; light
 * continua disponível (`enableSystem`, toggle manual), nunca removido.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
