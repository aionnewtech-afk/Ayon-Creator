-- ★ Achado real (pedido direto do usuário — "iniciar o avatar do porta voz
-- da empresa"): novo Avatar Provider (HeyGen, "ai_avatar" já previsto em
-- `PRODUCTION_MODES` desde o design original mas nunca implementado) — um
-- "digital twin" treinado a partir de um vídeo real do porta-voz da marca,
-- com consentimento explícito da HeyGen (obrigatório por eles antes de
-- treinar em cima da imagem/voz de uma pessoa real). Colunas nullable, sem
-- avatar nenhum a marca segue funcionando normalmente (mesmo espírito
-- adaptativo de `reference_image_paths`, migration 0022) — o avatar só
-- entra em uso quando `avatar_ready = true`.
alter table public.brands
  add column avatar_group_id text,
  add column avatar_look_id text,
  add column avatar_name text,
  add column avatar_training_video_path text,
  add column avatar_consent_status text,
  add column avatar_training_status text,
  add column avatar_ready boolean not null default false;
