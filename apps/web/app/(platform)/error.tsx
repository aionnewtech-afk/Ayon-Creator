"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@ayon/ui";
import { logger } from "@ayon/core";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("platform.render_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <ErrorFallback
          title="Não foi possível carregar a plataforma"
          description="Houve um problema ao preparar sua conta ou carregar esta página. Você pode tentar novamente."
          onRetry={reset}
        />
      </div>
    </div>
  );
}
