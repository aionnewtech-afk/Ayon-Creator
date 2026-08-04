import { timingSafeEqual } from "node:crypto";

export class InvalidN8nWebhookSecretError extends Error {
  constructor() {
    super("Segredo do webhook do n8n inválido ou ausente.");
    this.name = "InvalidN8nWebhookSecretError";
  }
}

/**
 * Autenticação por segredo compartilhado (architecture.md §9.1) para as
 * rotas internas do pipeline de vídeo (Fluxo 13) e o webhook de conclusão do
 * n8n — mesmo princípio já usado para o webhook do Mercado Pago, adaptado
 * porque o n8n não impõe um esquema de assinatura HMAC próprio como o
 * Mercado Pago. Comparação em tempo constante para não vazar o segredo por
 * timing.
 */
export function verifyN8nWebhookSecret(receivedSecret: string | null): void {
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!expectedSecret || !receivedSecret) throw new InvalidN8nWebhookSecretError();

  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(receivedSecret);
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new InvalidN8nWebhookSecretError();
  }
}
