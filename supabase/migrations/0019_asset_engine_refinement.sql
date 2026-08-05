-- Missão 11 — Refinamento do Asset Engine (identidade visual, seleção de
-- voz/cena, geração automática de foto, progresso granular). Ver
-- docs/architecture.md §14, docs/database.md, docs/flows.md Fluxo 13/15.
-- Migration incremental — não recria nada de 0001-0018.

-- ---------------------------------------------------------------------------
-- brands — identidade visual como ativo permanente da marca (arch. §14.1).
-- Todos os campos nullable/opcionais: marca sem identidade visual gera
-- conteúdo normalmente, nunca bloqueia.
-- ---------------------------------------------------------------------------
alter table public.brands
  add column logo_storage_path text,
  add column primary_color_hex text,
  add column secondary_color_hex text,
  add column font_family text,
  add column visual_style text;

-- ---------------------------------------------------------------------------
-- campaigns — visual_brief: parâmetros de composição decididos por IA e
-- resolvidos 1x por campanha (cor de destaque, título curto, variante de
-- layout), reaproveitados por todas as peças/candidatos da mesma campanha
-- (arch. §14.4.3) — evita decisões estilísticas divergentes peça a peça.
-- ---------------------------------------------------------------------------
alter table public.campaigns
  add column visual_brief jsonb;

-- ---------------------------------------------------------------------------
-- content_pieces — novo production_mode `licensed_stock_photo` (geração
-- automática de stories/carousel/thumbnail via banco de fotos licenciadas +
-- composição, arch. §14.4) e `selected_version_id` (suporta múltiplas
-- opções geradas por rodada, arch. §14.4.2 — `null` preserva o
-- comportamento de sempre: a versão de version_number mais alto vence).
-- ---------------------------------------------------------------------------
alter table public.content_pieces
  drop constraint content_pieces_production_mode_check;

alter table public.content_pieces
  add constraint content_pieces_production_mode_check
  check (production_mode in ('ai_avatar', 'licensed_stock_video', 'licensed_stock_photo', 'own_media', 'hybrid', 'text_only'));

alter table public.content_pieces
  add column selected_version_id uuid references public.content_versions (id);

-- ---------------------------------------------------------------------------
-- pipeline_runs — progresso granular (arch. §14.9). Continua uma linha por
-- peça (não uma tabela de histórico de etapas) — as 3 colunas só registram
-- o estado atual da linha, atualizadas in-place pelo próprio pipeline.
-- ---------------------------------------------------------------------------
alter table public.pipeline_runs
  add column stage text,
  add column progress_percent integer,
  add column estimated_remaining_seconds integer;

-- ---------------------------------------------------------------------------
-- credit_pricing — novo trigger_reason `image_generation` (arch. §14.4),
-- separado de `video_generation`: cadeia de fornecedores mais simples e
-- mais barata (Pexels Photos + 1 render Shotstack, contra os 3 fornecedores
-- do vídeo). VALORES PLACEHOLDER — ajustar por UPDATE numa migration
-- futura, nunca editando esta (mesmo padrão de `video_generation`).
-- ---------------------------------------------------------------------------
insert into public.credit_pricing (trigger_reason, tier, credits)
values
  ('image_generation', 'economico', 5),
  ('image_generation', 'balanceado', 10),
  ('image_generation', 'premium', 18);
