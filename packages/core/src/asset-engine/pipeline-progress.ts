import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@ayon/types";
import { PipelineRunRepository } from "../repositories/pipeline-run.repository";

/**
 * Progresso granular (arch. §14.9) — `stage`/`progress_percent` por etapa
 * de cada pipeline, mais uma estimativa aproximada de segundos restantes
 * (soma dos pesos das etapas seguintes). Pesos são ordem de grandeza
 * observada durante a validação real desta missão (narração ~poucos
 * segundos, seleção de cena/foto ~5-15s por chamada de LLM+busca,
 * composição ~10-90s de polling no Shotstack) — melhor esforço, nunca uma
 * medição histórica real (arch. §14.9: `null` também é um resultado válido,
 * mas uma estimativa aproximada é mais útil que nenhuma).
 */
interface StageWeight {
  stage: string;
  progressPercent: number;
  remainingSecondsFromHere: number;
}

// Só estágios genuinamente observáveis na fronteira de cada rota (n8n → API)
// entram aqui — "aplicando identidade visual" e "finalizando" acontecem
// dentro da mesma chamada de composição (branding é resolvido e repassado
// ao Video Render Provider numa única chamada, arch. §14.6), sem um ponto de
// atualização intermediário real; inventar uma escrita a mais no meio não
// tornaria o progresso mais verdadeiro, só mais granular na aparência.
const VIDEO_PIPELINE_STAGES: StageWeight[] = [
  { stage: "narrating", progressPercent: 20, remainingSecondsFromHere: 75 },
  { stage: "selecting_scenes", progressPercent: 45, remainingSecondsFromHere: 55 },
  { stage: "rendering", progressPercent: 70, remainingSecondsFromHere: 30 },
];

const PHOTO_PIPELINE_STAGES: StageWeight[] = [
  { stage: "selecting_photos", progressPercent: 20, remainingSecondsFromHere: 35 },
  { stage: "rendering", progressPercent: 55, remainingSecondsFromHere: 20 },
];

export type PipelineKind = "video" | "photo";

export async function markPipelineStage(
  db: SupabaseClient<Database>,
  pipelineRunId: string,
  kind: PipelineKind,
  stage: string,
): Promise<void> {
  const stages = kind === "video" ? VIDEO_PIPELINE_STAGES : PHOTO_PIPELINE_STAGES;
  const found = stages.find((s) => s.stage === stage);

  await new PipelineRunRepository(db).update(pipelineRunId, {
    status: "running",
    stage,
    progress_percent: found?.progressPercent ?? null,
    estimated_remaining_seconds: found?.remainingSecondsFromHere ?? null,
  });
}
