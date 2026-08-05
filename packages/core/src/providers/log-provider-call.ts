import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProviderCapability } from "@ayon/types";
import { ProviderCallLogRepository } from "../repositories/provider-call-log.repository";
import { logger } from "../logger";

export interface LogProviderCallParams {
  serviceRoleDb: SupabaseClient<Database>;
  providerKey: string;
  capability: ProviderCapability;
  model?: string;
  endpoint?: string;
  organizationId?: string;
  requestId?: string;
  startedAt: Date;
  finishedAt: Date;
  ok: boolean;
  errorMessage?: string;
  tokensInput?: number;
  tokensOutput?: number;
  costEstimateCredits?: number;
}

/**
 * Instrumentação real de providers (architecture.md §15.7) — lógica de
 * gravação num único lugar; o ponto de chamada aparece em cada um dos 4
 * adapters reais (Anthropic/ElevenLabs/Pexels/Shotstack), em torno da
 * chamada de rede real, `try`/`finally`. Nunca lança — uma falha ao gravar
 * o log não pode derrubar a chamada real ao fornecedor.
 */
export async function logProviderCall(params: LogProviderCallParams): Promise<void> {
  try {
    const providerCallLogRepository = new ProviderCallLogRepository(params.serviceRoleDb);
    await providerCallLogRepository.record({
      provider_key: params.providerKey,
      capability: params.capability,
      model: params.model ?? null,
      endpoint: params.endpoint ?? null,
      organization_id: params.organizationId ?? null,
      request_id: params.requestId ?? null,
      started_at: params.startedAt.toISOString(),
      finished_at: params.finishedAt.toISOString(),
      latency_ms: params.finishedAt.getTime() - params.startedAt.getTime(),
      status: params.ok ? "success" : "error",
      error_message: params.errorMessage ?? null,
      tokens_input: params.tokensInput ?? null,
      tokens_output: params.tokensOutput ?? null,
      cost_estimate_credits: params.costEstimateCredits ?? null,
    });
  } catch (error) {
    logger.warn("providers.log_provider_call.failed", {
      providerKey: params.providerKey,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
