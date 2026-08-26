-- ★ Achado real (pedido direto do usuário — "e eu faço isso pelo heygen?",
-- depois de confirmar que troca de roupa por prompt não preserva a
-- identidade real): a alternativa que funciona de verdade é treinar um
-- NOVO "look" (ângulo/roupa diferente) dentro do MESMO avatar_group já
-- consentido, a partir de um vídeo real novo — nunca inferido por IA.
-- `avatar_look_id`/`avatar_name` (migration 0024) continuam sendo o look
-- principal/original; este array guarda os looks extras, cada um com seu
-- próprio ciclo de treinamento assíncrono.
alter table public.brands
  add column avatar_looks jsonb not null default '[]'::jsonb;
