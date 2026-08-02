"use client";

import { ErrorFallback } from "@ayon/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <ErrorFallback
            title="A aplicação encontrou um erro"
            description="Algo interrompeu o carregamento da página. Tente novamente — se persistir, recarregue a página."
            onRetry={reset}
          />
        </div>
      </body>
    </html>
  );
}
