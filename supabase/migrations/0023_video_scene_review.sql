-- ★ Achado real (pedido direto do usuário — "será se não era bom a gente
-- aprovar o prompt antes de gerar o vídeo? estamos andando em círculos"):
-- narração + seleção de cenas passam a rodar primeiro, o usuário revisa o
-- plano (texto de cada trecho + prévia de cada cena escolhida) e aprova
-- antes do render de verdade (Shotstack) acontecer — em vez de só poder
-- julgar depois de um render inteiro já ter rodado. Extensão aditiva, não
-- afeta nenhuma peça existente.

alter table public.content_pieces
  drop constraint content_pieces_status_check;

alter table public.content_pieces
  add constraint content_pieces_status_check
  check (status in ('draft', 'generating', 'scenes_ready_for_review', 'ready_for_review', 'approved', 'rejected', 'failed'));

-- Plano de cenas aprovável (áudio de narração + cenas escolhidas + texto de
-- cada trecho) — persistido depois de narrate+scenes, consumido só depois
-- da aprovação do usuário (render). Nullable: só existe entre o passo de
-- planejamento e a aprovação/rejeição.
alter table public.content_pieces
  add column pending_scene_plan jsonb;
