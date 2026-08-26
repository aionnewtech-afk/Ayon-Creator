import Image from "next/image";
import { ThemeToggle } from "@ayon/ui";
import { appConfig } from "@/config/app";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        {/* ★ Achado real (pedido direto do usuário — "seguem as logos com
            fundo transparente pra fundo branco e preto"): 1 arquivo por
            tema, `dark:` troca sozinho. */}
        <Image
          src="/logo-horizontal-light.png"
          alt={appConfig.name}
          width={2172}
          height={724}
          className="h-8 w-auto dark:hidden"
          priority
        />
        <Image
          src="/logo-horizontal-dark.png"
          alt={appConfig.name}
          width={2172}
          height={724}
          className="hidden h-8 w-auto dark:block"
          priority
        />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
